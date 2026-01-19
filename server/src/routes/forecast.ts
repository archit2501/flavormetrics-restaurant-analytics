import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import axios from 'axios';
import { logger } from '../utils/logger';

const router = Router();
const prisma = new PrismaClient();

// POST /api/forecast/covers - Generate cover forecast
router.post('/covers/:restaurantId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { restaurantId } = req.params;

    const schema = z.object({
      days: z.number().min(1).max(14).default(7),
    });

    const { days } = schema.parse(req.body);

    // Get historical data
    const historicalOrders = await prisma.order.findMany({
      where: {
        restaurantId,
        closedAt: {
          gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // 90 days
        },
        status: 'closed',
      },
      select: {
        closedAt: true,
        guests: true,
      },
    });

    // Aggregate by date
    const dailyCovers = new Map<string, number>();
    historicalOrders.forEach((o) => {
      const date = o.closedAt?.toISOString().slice(0, 10) || '';
      dailyCovers.set(date, (dailyCovers.get(date) || 0) + (o.guests || 1));
    });

    // Calculate day-of-week averages
    const dowAverages = new Map<number, number[]>();
    Array.from(dailyCovers.entries()).forEach(([date, covers]) => {
      const dow = new Date(date).getDay();
      if (!dowAverages.has(dow)) dowAverages.set(dow, []);
      dowAverages.get(dow)!.push(covers);
    });

    const dowMeans = new Map<number, { mean: number; std: number }>();
    dowAverages.forEach((values, dow) => {
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const std = Math.sqrt(
        values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length
      );
      dowMeans.set(dow, { mean, std });
    });

    // Generate forecasts
    const predictions = [];
    const today = new Date();

    for (let i = 1; i <= days; i++) {
      const targetDate = new Date(today.getTime() + i * 24 * 60 * 60 * 1000);
      const dow = targetDate.getDay();
      const stats = dowMeans.get(dow) || { mean: 50, std: 10 };

      // Add some randomness for realism
      const variation = (Math.random() - 0.5) * stats.std * 0.5;
      const predicted = Math.round(stats.mean + variation);

      predictions.push({
        date: targetDate.toISOString().slice(0, 10),
        dayOfWeek: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dow],
        predictedCovers: Math.max(0, predicted),
        confidenceLow: Math.max(0, Math.round(predicted - stats.std * 1.5)),
        confidenceHigh: Math.round(predicted + stats.std * 1.5),
      });

      // Save to database
      await prisma.demandForecast.upsert({
        where: {
          restaurantId_forecastDate: {
            restaurantId,
            forecastDate: targetDate,
          },
        },
        update: {
          predictedCovers: predicted,
          confidenceLow: Math.max(0, Math.round(predicted - stats.std * 1.5)),
          confidenceHigh: Math.round(predicted + stats.std * 1.5),
          modelVersion: 'dow_average_v1',
        },
        create: {
          restaurantId,
          forecastDate: targetDate,
          predictedCovers: predicted,
          confidenceLow: Math.max(0, Math.round(predicted - stats.std * 1.5)),
          confidenceHigh: Math.round(predicted + stats.std * 1.5),
          modelVersion: 'dow_average_v1',
        },
      });
    }

    res.json({
      success: true,
      data: {
        restaurantId,
        predictions,
        modelVersion: 'dow_average_v1',
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/forecast/covers/latest - Get latest forecast
router.get('/covers/:restaurantId/latest', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { restaurantId } = req.params;

    const forecasts = await prisma.demandForecast.findMany({
      where: {
        restaurantId,
        forecastDate: { gte: new Date() },
      },
      orderBy: { forecastDate: 'asc' },
      take: 14,
    });

    if (forecasts.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No forecasts found. Generate a forecast first.',
      });
    }

    res.json({
      success: true,
      data: {
        forecasts: forecasts.map((f) => ({
          date: f.forecastDate.toISOString().slice(0, 10),
          predictedCovers: f.predictedCovers,
          confidenceLow: f.confidenceLow,
          confidenceHigh: f.confidenceHigh,
        })),
        modelVersion: forecasts[0].modelVersion,
        createdAt: forecasts[0].createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/forecast/items - Item-level forecast
router.post('/items/:restaurantId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { restaurantId } = req.params;

    const schema = z.object({
      date: z.string().datetime(),
      expectedCovers: z.number().optional(),
    });

    const { date, expectedCovers } = schema.parse(req.body);

    const forecastDate = new Date(date);

    // Get cover forecast if not provided
    let covers = expectedCovers;
    if (!covers) {
      const coverForecast = await prisma.demandForecast.findUnique({
        where: {
          restaurantId_forecastDate: {
            restaurantId,
            forecastDate,
          },
        },
      });
      covers = coverForecast?.predictedCovers || 50;
    }

    // Get historical item mix
    const dow = forecastDate.getDay();
    const historicalOrders = await prisma.order.findMany({
      where: {
        restaurantId,
        closedAt: {
          gte: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
        },
        status: 'closed',
      },
      include: {
        orderItems: {
          where: { isVoid: false },
          include: {
            menuItem: true,
          },
        },
      },
    });

    // Filter to same day of week
    const sameDowOrders = historicalOrders.filter(
      (o) => o.closedAt?.getDay() === dow
    );

    // Calculate item ratios (items per cover)
    const itemRatios = new Map<string, { name: string; ratio: number }>();
    let totalCovers = 0;

    sameDowOrders.forEach((o) => {
      const orderCovers = o.guests || 1;
      totalCovers += orderCovers;

      o.orderItems.forEach((oi) => {
        const id = oi.menuItemId;
        const existing = itemRatios.get(id) || {
          name: oi.menuItem?.name || 'Unknown',
          ratio: 0,
        };
        itemRatios.set(id, {
          name: existing.name,
          ratio: existing.ratio + oi.quantity,
        });
      });
    });

    // Convert totals to ratios
    itemRatios.forEach((data, id) => {
      itemRatios.set(id, {
        name: data.name,
        ratio: totalCovers > 0 ? data.ratio / totalCovers : 0,
      });
    });

    // Generate forecasts
    const itemForecasts = Array.from(itemRatios.entries())
      .map(([menuItemId, data]) => ({
        menuItemId,
        itemName: data.name,
        predictedQuantity: Math.round(data.ratio * covers!),
        ratio: Math.round(data.ratio * 100) / 100,
      }))
      .filter((f) => f.predictedQuantity > 0)
      .sort((a, b) => b.predictedQuantity - a.predictedQuantity);

    // Save top forecasts
    for (const forecast of itemForecasts.slice(0, 50)) {
      await prisma.itemForecast.upsert({
        where: {
          restaurantId_menuItemId_forecastDate: {
            restaurantId,
            menuItemId: forecast.menuItemId,
            forecastDate,
          },
        },
        update: {
          predictedQuantity: forecast.predictedQuantity,
        },
        create: {
          restaurantId,
          menuItemId: forecast.menuItemId,
          forecastDate,
          predictedQuantity: forecast.predictedQuantity,
        },
      });
    }

    res.json({
      success: true,
      data: {
        date: forecastDate.toISOString().slice(0, 10),
        expectedCovers: covers,
        itemForecasts,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
