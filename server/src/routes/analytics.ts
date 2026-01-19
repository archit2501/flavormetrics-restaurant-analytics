import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import redis from '../utils/redis';

const router = Router();
const prisma = new PrismaClient();

// GET /api/analytics/dashboard - Overview metrics
router.get('/dashboard/:restaurantId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { restaurantId } = req.params;

    const querySchema = z.object({
      period: z.enum(['today', 'week', 'month']).default('today'),
    });

    const { period } = querySchema.parse(req.query);

    // Calculate date range
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
    }

    // Get orders for period
    const orders = await prisma.order.findMany({
      where: {
        restaurantId,
        closedAt: { gte: startDate },
        status: 'closed',
      },
    });

    // Calculate metrics
    const totalRevenue = orders.reduce((s, o) => s + Number(o.total || 0), 0);
    const totalOrders = orders.length;
    const totalGuests = orders.reduce((s, o) => s + (o.guests || 0), 0);
    const avgCheck = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    const avgCheckPerGuest = totalGuests > 0 ? totalRevenue / totalGuests : 0;

    // Get previous period for comparison
    const periodDuration = now.getTime() - startDate.getTime();
    const prevStartDate = new Date(startDate.getTime() - periodDuration);

    const prevOrders = await prisma.order.findMany({
      where: {
        restaurantId,
        closedAt: {
          gte: prevStartDate,
          lt: startDate,
        },
        status: 'closed',
      },
    });

    const prevRevenue = prevOrders.reduce((s, o) => s + Number(o.total || 0), 0);
    const revenueChange = prevRevenue > 0
      ? ((totalRevenue - prevRevenue) / prevRevenue) * 100
      : 0;

    // Get labor cost (simplified)
    const shifts = await prisma.shift.findMany({
      where: {
        restaurantId,
        scheduledStart: { gte: startDate },
      },
      include: {
        staff: true,
      },
    });

    const laborCost = shifts.reduce((s, shift) => {
      const hours = shift.actualEnd && shift.actualStart
        ? (shift.actualEnd.getTime() - shift.actualStart.getTime()) / (1000 * 60 * 60)
        : (shift.scheduledEnd.getTime() - shift.scheduledStart.getTime()) / (1000 * 60 * 60);
      return s + hours * Number(shift.staff?.hourlyRate || 15);
    }, 0);

    const laborCostPercent = totalRevenue > 0 ? (laborCost / totalRevenue) * 100 : 0;

    // Get food cost from order items
    const orderItems = await prisma.orderItem.findMany({
      where: {
        order: {
          restaurantId,
          closedAt: { gte: startDate },
          status: 'closed',
        },
        isVoid: false,
      },
      include: {
        menuItem: true,
      },
    });

    const foodCost = orderItems.reduce((s, oi) => {
      return s + Number(oi.menuItem?.cost || 0) * oi.quantity;
    }, 0);

    const foodCostPercent = totalRevenue > 0 ? (foodCost / totalRevenue) * 100 : 0;

    res.json({
      success: true,
      data: {
        period,
        revenue: {
          total: Math.round(totalRevenue * 100) / 100,
          change: Math.round(revenueChange * 10) / 10,
          trend: revenueChange > 0 ? 'up' : revenueChange < 0 ? 'down' : 'flat',
        },
        orders: {
          total: totalOrders,
          avgCheck: Math.round(avgCheck * 100) / 100,
          avgCheckPerGuest: Math.round(avgCheckPerGuest * 100) / 100,
        },
        guests: {
          total: totalGuests,
          avgPerOrder: totalOrders > 0 ? Math.round((totalGuests / totalOrders) * 10) / 10 : 0,
        },
        costs: {
          food: Math.round(foodCost * 100) / 100,
          foodPercent: Math.round(foodCostPercent * 10) / 10,
          labor: Math.round(laborCost * 100) / 100,
          laborPercent: Math.round(laborCostPercent * 10) / 10,
          primePercent: Math.round((foodCostPercent + laborCostPercent) * 10) / 10,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/analytics/sales - Sales analytics
router.get('/sales/:restaurantId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { restaurantId } = req.params;

    const querySchema = z.object({
      startDate: z.string().datetime(),
      endDate: z.string().datetime(),
      groupBy: z.enum(['hour', 'day', 'week', 'month']).default('day'),
    });

    const params = querySchema.parse(req.query);

    const orders = await prisma.order.findMany({
      where: {
        restaurantId,
        closedAt: {
          gte: new Date(params.startDate),
          lte: new Date(params.endDate),
        },
        status: 'closed',
      },
      orderBy: { closedAt: 'asc' },
    });

    // Group by period
    const grouped = new Map<string, { revenue: number; orders: number; guests: number }>();

    orders.forEach((o) => {
      let bucket: string;
      const date = o.closedAt!;

      switch (params.groupBy) {
        case 'hour':
          bucket = date.toISOString().slice(0, 13) + ':00';
          break;
        case 'day':
          bucket = date.toISOString().slice(0, 10);
          break;
        case 'week':
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          bucket = weekStart.toISOString().slice(0, 10);
          break;
        case 'month':
          bucket = date.toISOString().slice(0, 7);
          break;
      }

      const existing = grouped.get(bucket) || { revenue: 0, orders: 0, guests: 0 };
      grouped.set(bucket, {
        revenue: existing.revenue + Number(o.total || 0),
        orders: existing.orders + 1,
        guests: existing.guests + (o.guests || 0),
      });
    });

    const trend = Array.from(grouped.entries())
      .map(([period, data]) => ({
        period,
        revenue: Math.round(data.revenue * 100) / 100,
        orders: data.orders,
        guests: data.guests,
        avgCheck: data.orders > 0 ? Math.round((data.revenue / data.orders) * 100) / 100 : 0,
      }))
      .sort((a, b) => a.period.localeCompare(b.period));

    // Calculate totals
    const totals = {
      revenue: trend.reduce((s, t) => s + t.revenue, 0),
      orders: trend.reduce((s, t) => s + t.orders, 0),
      guests: trend.reduce((s, t) => s + t.guests, 0),
    };

    res.json({
      success: true,
      data: {
        trend,
        totals: {
          ...totals,
          avgCheck: totals.orders > 0 ? Math.round((totals.revenue / totals.orders) * 100) / 100 : 0,
        },
        groupBy: params.groupBy,
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/analytics/food-cost - Food cost analysis
router.get('/food-cost/:restaurantId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { restaurantId } = req.params;

    const querySchema = z.object({
      startDate: z.string().datetime(),
      endDate: z.string().datetime(),
    });

    const params = querySchema.parse(req.query);

    // Get order items with menu item costs
    const orderItems = await prisma.orderItem.findMany({
      where: {
        order: {
          restaurantId,
          closedAt: {
            gte: new Date(params.startDate),
            lte: new Date(params.endDate),
          },
          status: 'closed',
        },
        isVoid: false,
      },
      include: {
        menuItem: true,
      },
    });

    // Calculate by category
    const byCategory = new Map<string, { revenue: number; cost: number; quantity: number }>();

    orderItems.forEach((oi) => {
      const category = oi.menuItem?.category || 'Other';
      const revenue = Number(oi.unitPrice) * oi.quantity;
      const cost = Number(oi.menuItem?.cost || 0) * oi.quantity;

      const existing = byCategory.get(category) || { revenue: 0, cost: 0, quantity: 0 };
      byCategory.set(category, {
        revenue: existing.revenue + revenue,
        cost: existing.cost + cost,
        quantity: existing.quantity + oi.quantity,
      });
    });

    const categoryAnalysis = Array.from(byCategory.entries())
      .map(([category, data]) => ({
        category,
        revenue: Math.round(data.revenue * 100) / 100,
        cost: Math.round(data.cost * 100) / 100,
        quantity: data.quantity,
        costPercent: data.revenue > 0
          ? Math.round((data.cost / data.revenue) * 1000) / 10
          : 0,
        margin: Math.round((data.revenue - data.cost) * 100) / 100,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    // Get waste data
    const waste = await prisma.wasteLog.findMany({
      where: {
        restaurantId,
        loggedAt: {
          gte: new Date(params.startDate),
          lte: new Date(params.endDate),
        },
      },
    });

    const totalWasteCost = waste.reduce((s, w) => s + Number(w.cost || 0), 0);

    // Totals
    const totalRevenue = categoryAnalysis.reduce((s, c) => s + c.revenue, 0);
    const totalCost = categoryAnalysis.reduce((s, c) => s + c.cost, 0);

    // Theoretical vs actual (simplified - actual would need inventory counts)
    const theoreticalCostPercent = totalRevenue > 0 ? (totalCost / totalRevenue) * 100 : 0;
    const actualCostPercent = totalRevenue > 0 ? ((totalCost + totalWasteCost) / totalRevenue) * 100 : 0;

    res.json({
      success: true,
      data: {
        summary: {
          totalRevenue: Math.round(totalRevenue * 100) / 100,
          totalCost: Math.round(totalCost * 100) / 100,
          totalWaste: Math.round(totalWasteCost * 100) / 100,
          theoreticalCostPercent: Math.round(theoreticalCostPercent * 10) / 10,
          actualCostPercent: Math.round(actualCostPercent * 10) / 10,
          variance: Math.round((actualCostPercent - theoreticalCostPercent) * 10) / 10,
        },
        byCategory: categoryAnalysis,
        recommendations: generateFoodCostRecommendations(categoryAnalysis, actualCostPercent),
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/analytics/labor - Labor metrics
router.get('/labor/:restaurantId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { restaurantId } = req.params;

    const querySchema = z.object({
      startDate: z.string().datetime(),
      endDate: z.string().datetime(),
    });

    const params = querySchema.parse(req.query);

    // Get shifts
    const shifts = await prisma.shift.findMany({
      where: {
        restaurantId,
        scheduledStart: {
          gte: new Date(params.startDate),
          lte: new Date(params.endDate),
        },
      },
      include: {
        staff: true,
      },
    });

    // Calculate labor metrics
    const byRole = new Map<string, { hours: number; cost: number; shifts: number }>();

    shifts.forEach((shift) => {
      const role = shift.role || 'Other';
      const hours = shift.actualEnd && shift.actualStart
        ? (shift.actualEnd.getTime() - shift.actualStart.getTime()) / (1000 * 60 * 60)
        : (shift.scheduledEnd.getTime() - shift.scheduledStart.getTime()) / (1000 * 60 * 60);
      const cost = hours * Number(shift.staff?.hourlyRate || 15);

      const existing = byRole.get(role) || { hours: 0, cost: 0, shifts: 0 };
      byRole.set(role, {
        hours: existing.hours + hours,
        cost: existing.cost + cost,
        shifts: existing.shifts + 1,
      });
    });

    const roleBreakdown = Array.from(byRole.entries())
      .map(([role, data]) => ({
        role,
        hours: Math.round(data.hours * 10) / 10,
        cost: Math.round(data.cost * 100) / 100,
        shifts: data.shifts,
        avgHoursPerShift: data.shifts > 0
          ? Math.round((data.hours / data.shifts) * 10) / 10
          : 0,
      }))
      .sort((a, b) => b.cost - a.cost);

    // Get revenue for labor cost %
    const orders = await prisma.order.findMany({
      where: {
        restaurantId,
        closedAt: {
          gte: new Date(params.startDate),
          lte: new Date(params.endDate),
        },
        status: 'closed',
      },
    });

    const totalRevenue = orders.reduce((s, o) => s + Number(o.total || 0), 0);
    const totalLaborCost = roleBreakdown.reduce((s, r) => s + r.cost, 0);
    const totalHours = roleBreakdown.reduce((s, r) => s + r.hours, 0);

    const laborCostPercent = totalRevenue > 0 ? (totalLaborCost / totalRevenue) * 100 : 0;
    const salesPerLaborHour = totalHours > 0 ? totalRevenue / totalHours : 0;

    res.json({
      success: true,
      data: {
        summary: {
          totalHours: Math.round(totalHours * 10) / 10,
          totalCost: Math.round(totalLaborCost * 100) / 100,
          laborCostPercent: Math.round(laborCostPercent * 10) / 10,
          salesPerLaborHour: Math.round(salesPerLaborHour * 100) / 100,
          totalRevenue: Math.round(totalRevenue * 100) / 100,
        },
        byRole: roleBreakdown,
        benchmark: {
          targetLaborPercent: 30,
          status: laborCostPercent <= 30 ? 'good' : laborCostPercent <= 35 ? 'warning' : 'high',
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

function generateFoodCostRecommendations(
  categories: any[],
  actualCostPercent: number
): string[] {
  const recommendations: string[] = [];

  if (actualCostPercent > 32) {
    recommendations.push(
      'Food cost is above industry benchmark (32%). Review portion sizes and vendor pricing.'
    );
  }

  const highCostCategories = categories.filter((c) => c.costPercent > 35);
  if (highCostCategories.length > 0) {
    recommendations.push(
      `High cost categories: ${highCostCategories.map((c) => c.category).join(', ')}. Consider menu price adjustments.`
    );
  }

  if (recommendations.length === 0) {
    recommendations.push('Food cost is within target range. Continue monitoring.');
  }

  return recommendations;
}

export default router;
