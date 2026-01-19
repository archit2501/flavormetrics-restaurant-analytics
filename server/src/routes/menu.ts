import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import redis from '../utils/redis';

const router = Router();
const prisma = new PrismaClient();

// GET /api/menu - List menu items
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const querySchema = z.object({
      restaurantId: z.string().uuid(),
      category: z.string().optional(),
      active: z.enum(['true', 'false']).optional(),
    });

    const params = querySchema.parse(req.query);

    const where: any = { restaurantId: params.restaurantId };
    if (params.category) where.category = params.category;
    if (params.active !== undefined) where.isActive = params.active === 'true';

    const items = await prisma.menuItem.findMany({
      where,
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });

    // Group by category
    const categories = [...new Set(items.map((i) => i.category))];
    const grouped = categories.map((cat) => ({
      category: cat,
      items: items.filter((i) => i.category === cat),
    }));

    res.json({
      success: true,
      data: {
        items,
        grouped,
        totalItems: items.length,
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/menu/engineering - Menu engineering analysis
router.get('/engineering', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const querySchema = z.object({
      restaurantId: z.string().uuid(),
      startDate: z.string().datetime(),
      endDate: z.string().datetime(),
    });

    const params = querySchema.parse(req.query);

    // Get menu items with sales data
    const items = await prisma.menuItem.findMany({
      where: { restaurantId: params.restaurantId, isActive: true },
    });

    // Get order items for the period
    const orderItems = await prisma.orderItem.findMany({
      where: {
        order: {
          restaurantId: params.restaurantId,
          closedAt: {
            gte: new Date(params.startDate),
            lte: new Date(params.endDate),
          },
        },
        isVoid: false,
      },
      include: {
        menuItem: true,
      },
    });

    // Calculate metrics for each item
    const itemMetrics = new Map<string, {
      quantity: number;
      revenue: number;
      cost: number;
      profit: number;
    }>();

    orderItems.forEach((oi) => {
      const existing = itemMetrics.get(oi.menuItemId) || {
        quantity: 0,
        revenue: 0,
        cost: 0,
        profit: 0,
      };

      const revenue = Number(oi.unitPrice) * oi.quantity;
      const cost = (oi.menuItem?.cost || 0) * oi.quantity;

      itemMetrics.set(oi.menuItemId, {
        quantity: existing.quantity + oi.quantity,
        revenue: existing.revenue + revenue,
        cost: existing.cost + Number(cost),
        profit: existing.profit + (revenue - Number(cost)),
      });
    });

    // Calculate averages for classification
    const allMetrics = Array.from(itemMetrics.values());
    const avgQuantity = allMetrics.reduce((s, m) => s + m.quantity, 0) / allMetrics.length || 1;
    const avgProfit = allMetrics.reduce((s, m) => s + m.profit, 0) / allMetrics.length || 1;

    // Classify items using BCG matrix methodology
    const analysis = items.map((item) => {
      const metrics = itemMetrics.get(item.id) || {
        quantity: 0,
        revenue: 0,
        cost: 0,
        profit: 0,
      };

      const contributionMargin = metrics.revenue > 0
        ? ((metrics.revenue - metrics.cost) / metrics.revenue) * 100
        : 0;

      const popularity = metrics.quantity / avgQuantity;
      const profitability = metrics.profit / avgProfit;

      // Classification: Star, Plowhorse, Puzzle, Dog
      let classification: string;
      if (popularity >= 1 && profitability >= 1) {
        classification = 'Star'; // High popularity, high profitability
      } else if (popularity >= 1 && profitability < 1) {
        classification = 'Plowhorse'; // High popularity, low profitability
      } else if (popularity < 1 && profitability >= 1) {
        classification = 'Puzzle'; // Low popularity, high profitability
      } else {
        classification = 'Dog'; // Low popularity, low profitability
      }

      return {
        id: item.id,
        name: item.name,
        category: item.category,
        price: Number(item.price),
        cost: Number(item.cost) || 0,
        quantitySold: metrics.quantity,
        revenue: Math.round(metrics.revenue * 100) / 100,
        profit: Math.round(metrics.profit * 100) / 100,
        contributionMargin: Math.round(contributionMargin * 10) / 10,
        popularityIndex: Math.round(popularity * 100) / 100,
        profitabilityIndex: Math.round(profitability * 100) / 100,
        classification,
      };
    });

    // Group by classification
    const summary = {
      stars: analysis.filter((a) => a.classification === 'Star'),
      plowhorses: analysis.filter((a) => a.classification === 'Plowhorse'),
      puzzles: analysis.filter((a) => a.classification === 'Puzzle'),
      dogs: analysis.filter((a) => a.classification === 'Dog'),
    };

    // Generate recommendations
    const recommendations = generateMenuRecommendations(analysis);

    res.json({
      success: true,
      data: {
        analysis,
        summary: {
          starCount: summary.stars.length,
          plowhorseCount: summary.plowhorses.length,
          puzzleCount: summary.puzzles.length,
          dogCount: summary.dogs.length,
        },
        recommendations,
        period: {
          start: params.startDate,
          end: params.endDate,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/menu/:id/performance - Item performance
router.get('/:id/performance', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const querySchema = z.object({
      days: z.coerce.number().min(7).max(365).default(30),
    });

    const { days } = querySchema.parse(req.query);

    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const item = await prisma.menuItem.findUnique({
      where: { id },
    });

    if (!item) {
      return res.status(404).json({
        success: false,
        error: 'Menu item not found',
      });
    }

    // Get daily sales
    const orderItems = await prisma.orderItem.findMany({
      where: {
        menuItemId: id,
        isVoid: false,
        order: {
          closedAt: { gte: startDate },
        },
      },
      include: {
        order: {
          select: { closedAt: true },
        },
      },
    });

    // Aggregate by day
    const dailySales = new Map<string, { quantity: number; revenue: number }>();

    orderItems.forEach((oi) => {
      const date = oi.order.closedAt?.toISOString().slice(0, 10) || '';
      const existing = dailySales.get(date) || { quantity: 0, revenue: 0 };
      dailySales.set(date, {
        quantity: existing.quantity + oi.quantity,
        revenue: existing.revenue + Number(oi.unitPrice) * oi.quantity,
      });
    });

    const trend = Array.from(dailySales.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const totalQuantity = trend.reduce((s, d) => s + d.quantity, 0);
    const totalRevenue = trend.reduce((s, d) => s + d.revenue, 0);

    res.json({
      success: true,
      data: {
        item: {
          id: item.id,
          name: item.name,
          category: item.category,
          price: Number(item.price),
          cost: Number(item.cost),
        },
        performance: {
          totalQuantity,
          totalRevenue: Math.round(totalRevenue * 100) / 100,
          avgDailyQuantity: Math.round((totalQuantity / days) * 10) / 10,
          avgDailyRevenue: Math.round((totalRevenue / days) * 100) / 100,
        },
        trend,
        period: { days, startDate: startDate.toISOString() },
      },
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/menu/:id - Update menu item
router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const schema = z.object({
      name: z.string().optional(),
      description: z.string().optional(),
      price: z.number().positive().optional(),
      cost: z.number().positive().optional(),
      isActive: z.boolean().optional(),
      prepTimeMinutes: z.number().optional(),
    });

    const input = schema.parse(req.body);

    const item = await prisma.menuItem.update({
      where: { id },
      data: input,
    });

    res.json({
      success: true,
      data: item,
    });
  } catch (error) {
    next(error);
  }
});

function generateMenuRecommendations(analysis: any[]): string[] {
  const recommendations: string[] = [];

  const dogs = analysis.filter((a) => a.classification === 'Dog');
  const plowhorses = analysis.filter((a) => a.classification === 'Plowhorse');
  const puzzles = analysis.filter((a) => a.classification === 'Puzzle');

  if (dogs.length > 0) {
    const worstDog = dogs.sort((a, b) => a.profit - b.profit)[0];
    recommendations.push(
      `Consider removing "${worstDog.name}" from the menu - low sales and low profitability.`
    );
  }

  if (plowhorses.length > 0) {
    const topPlowhorse = plowhorses.sort((a, b) => b.quantitySold - a.quantitySold)[0];
    recommendations.push(
      `"${topPlowhorse.name}" is popular but has low margin (${topPlowhorse.contributionMargin}%). Consider reducing portion size or increasing price by 5-10%.`
    );
  }

  if (puzzles.length > 0) {
    const topPuzzle = puzzles.sort((a, b) => b.profit - a.profit)[0];
    recommendations.push(
      `"${topPuzzle.name}" is highly profitable but underselling. Consider featuring it as a special or training servers to recommend it.`
    );
  }

  if (recommendations.length === 0) {
    recommendations.push('Menu is well-balanced. Continue monitoring performance.');
  }

  return recommendations;
}

export default router;
