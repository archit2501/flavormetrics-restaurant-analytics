import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const router = Router();
const prisma = new PrismaClient();

// GET /api/customers - List customers
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const querySchema = z.object({
      restaurantId: z.string().uuid(),
      segment: z.string().optional(),
      sortBy: z.enum(['lastVisit', 'totalSpent', 'totalVisits', 'churnRisk']).default('lastVisit'),
      sortOrder: z.enum(['asc', 'desc']).default('desc'),
      limit: z.coerce.number().min(1).max(100).default(50),
      offset: z.coerce.number().min(0).default(0),
    });

    const params = querySchema.parse(req.query);

    const where: any = { restaurantId: params.restaurantId };
    if (params.segment) {
      where.rfmSegment = params.segment;
    }

    const orderBy: any = {};
    orderBy[params.sortBy] = params.sortOrder;

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        orderBy,
        take: params.limit,
        skip: params.offset,
      }),
      prisma.customer.count({ where }),
    ]);

    res.json({
      success: true,
      data: customers,
      pagination: {
        total,
        limit: params.limit,
        offset: params.offset,
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/customers/segments - RFM segments
router.get('/segments/:restaurantId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { restaurantId } = req.params;

    // Get segment counts
    const segments = await prisma.customer.groupBy({
      by: ['rfmSegment'],
      where: { restaurantId },
      _count: true,
      _sum: {
        totalSpent: true,
        totalVisits: true,
      },
      _avg: {
        avgCheck: true,
        churnRisk: true,
      },
    });

    // Define segment metadata
    const segmentInfo: Record<string, { description: string; action: string; color: string }> = {
      'Champions': {
        description: 'Best customers - recent, frequent, high spenders',
        action: 'Reward and retain with VIP treatment',
        color: '#10B981',
      },
      'Loyal': {
        description: 'Regular customers with good spending',
        action: 'Upsell premium items, loyalty program',
        color: '#3B82F6',
      },
      'Potential Loyalists': {
        description: 'Recent customers who could become loyal',
        action: 'Encourage repeat visits with incentives',
        color: '#8B5CF6',
      },
      'At Risk': {
        description: 'Good customers who haven\'t visited recently',
        action: 'Send win-back offers immediately',
        color: '#F59E0B',
      },
      'Lost': {
        description: 'Former customers who stopped visiting',
        action: 'Strong win-back campaign or survey',
        color: '#EF4444',
      },
    };

    const enrichedSegments = segments.map((s) => ({
      segment: s.rfmSegment || 'Unknown',
      count: s._count,
      totalSpent: Math.round(Number(s._sum.totalSpent || 0) * 100) / 100,
      totalVisits: s._sum.totalVisits || 0,
      avgCheck: Math.round(Number(s._avg.avgCheck || 0) * 100) / 100,
      avgChurnRisk: Math.round(Number(s._avg.churnRisk || 0) * 100) / 100,
      ...segmentInfo[s.rfmSegment || ''],
    }));

    // Total customers
    const totalCustomers = segments.reduce((s, seg) => s + seg._count, 0);

    res.json({
      success: true,
      data: {
        segments: enrichedSegments,
        totalCustomers,
        distribution: enrichedSegments.map((s) => ({
          segment: s.segment,
          percentage: totalCustomers > 0
            ? Math.round((s.count / totalCustomers) * 1000) / 10
            : 0,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/customers/at-risk - Churn-risk customers
router.get('/at-risk/:restaurantId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { restaurantId } = req.params;

    const querySchema = z.object({
      minRisk: z.coerce.number().min(0).max(1).default(0.5),
      limit: z.coerce.number().min(1).max(100).default(50),
    });

    const params = querySchema.parse(req.query);

    const customers = await prisma.customer.findMany({
      where: {
        restaurantId,
        churnRisk: { gte: params.minRisk },
      },
      orderBy: { churnRisk: 'desc' },
      take: params.limit,
    });

    // Calculate days since last visit
    const enriched = customers.map((c) => {
      const daysSinceVisit = c.lastVisit
        ? Math.floor((Date.now() - c.lastVisit.getTime()) / (1000 * 60 * 60 * 24))
        : null;

      return {
        ...c,
        daysSinceLastVisit: daysSinceVisit,
        churnRiskPercent: Math.round(Number(c.churnRisk) * 100),
        lifetimeValue: Math.round(Number(c.lifetimeValue || 0) * 100) / 100,
        recommendedAction: getChurnAction(Number(c.churnRisk), daysSinceVisit),
      };
    });

    res.json({
      success: true,
      data: {
        customers: enriched,
        summary: {
          total: enriched.length,
          avgChurnRisk: Math.round(
            (enriched.reduce((s, c) => s + Number(c.churnRisk), 0) / enriched.length) * 100
          ),
          totalAtRiskValue: Math.round(
            enriched.reduce((s, c) => s + c.lifetimeValue, 0) * 100
          ) / 100,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/customers/:id - Customer profile
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const customer = await prisma.customer.findUnique({
      where: { id },
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        error: 'Customer not found',
      });
    }

    // Get order history
    const orders = await prisma.order.findMany({
      where: { customerId: id },
      orderBy: { closedAt: 'desc' },
      take: 20,
      include: {
        orderItems: {
          include: {
            menuItem: {
              select: { name: true, category: true },
            },
          },
        },
      },
    });

    // Calculate favorite items
    const itemCounts = new Map<string, { name: string; count: number }>();
    orders.forEach((o) => {
      o.orderItems.forEach((oi) => {
        const name = oi.menuItem?.name || 'Unknown';
        const existing = itemCounts.get(name) || { name, count: 0 };
        itemCounts.set(name, { name, count: existing.count + oi.quantity });
      });
    });

    const favoriteItems = Array.from(itemCounts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Visit frequency
    const visitDates = orders
      .filter((o) => o.closedAt)
      .map((o) => o.closedAt!.getTime());

    let avgDaysBetweenVisits = null;
    if (visitDates.length > 1) {
      const gaps = [];
      for (let i = 1; i < visitDates.length; i++) {
        gaps.push((visitDates[i - 1] - visitDates[i]) / (1000 * 60 * 60 * 24));
      }
      avgDaysBetweenVisits = Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length);
    }

    res.json({
      success: true,
      data: {
        customer: {
          ...customer,
          churnRiskPercent: Math.round(Number(customer.churnRisk) * 100),
        },
        insights: {
          favoriteItems,
          avgDaysBetweenVisits,
          daysSinceLastVisit: customer.lastVisit
            ? Math.floor((Date.now() - customer.lastVisit.getTime()) / (1000 * 60 * 60 * 24))
            : null,
        },
        recentOrders: orders.slice(0, 10).map((o) => ({
          id: o.id,
          date: o.closedAt,
          total: Number(o.total),
          items: o.orderItems.length,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
});

function getChurnAction(churnRisk: number, daysSinceVisit: number | null): string {
  if (churnRisk >= 0.8) {
    return 'Urgent: Send personalized win-back offer with significant discount';
  }
  if (churnRisk >= 0.6) {
    return 'Send re-engagement email with special offer';
  }
  if (daysSinceVisit && daysSinceVisit > 60) {
    return 'Add to win-back campaign list';
  }
  return 'Monitor - no immediate action needed';
}

export default router;
