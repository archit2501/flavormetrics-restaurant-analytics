import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const router = Router();
const prisma = new PrismaClient();

// GET /api/orders - List orders
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const querySchema = z.object({
      restaurantId: z.string().uuid(),
      startDate: z.string().datetime().optional(),
      endDate: z.string().datetime().optional(),
      status: z.string().optional(),
      limit: z.coerce.number().min(1).max(100).default(50),
      offset: z.coerce.number().min(0).default(0),
    });

    const params = querySchema.parse(req.query);

    const where: any = { restaurantId: params.restaurantId };

    if (params.startDate || params.endDate) {
      where.closedAt = {};
      if (params.startDate) where.closedAt.gte = new Date(params.startDate);
      if (params.endDate) where.closedAt.lte = new Date(params.endDate);
    }

    if (params.status) {
      where.status = params.status;
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        orderBy: { closedAt: 'desc' },
        take: params.limit,
        skip: params.offset,
        include: {
          _count: {
            select: { orderItems: true },
          },
        },
      }),
      prisma.order.count({ where }),
    ]);

    res.json({
      success: true,
      data: orders,
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

// GET /api/orders/:id - Order details
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        orderItems: {
          include: {
            menuItem: true,
          },
        },
        customer: {
          select: { name: true, email: true },
        },
        server: {
          select: { name: true },
        },
      },
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found',
      });
    }

    res.json({
      success: true,
      data: order,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/orders/summary - Daily/weekly/monthly summary
router.get('/summary/:restaurantId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { restaurantId } = req.params;

    const querySchema = z.object({
      period: z.enum(['today', 'week', 'month']).default('today'),
    });

    const { period } = querySchema.parse(req.query);

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

    const orders = await prisma.order.findMany({
      where: {
        restaurantId,
        closedAt: { gte: startDate },
        status: 'closed',
      },
    });

    // By order type
    const byType = new Map<string, { count: number; revenue: number }>();
    orders.forEach((o) => {
      const type = o.orderType || 'dine-in';
      const existing = byType.get(type) || { count: 0, revenue: 0 };
      byType.set(type, {
        count: existing.count + 1,
        revenue: existing.revenue + Number(o.total || 0),
      });
    });

    // By hour (for today only)
    const byHour = new Map<number, { count: number; revenue: number }>();
    if (period === 'today') {
      orders.forEach((o) => {
        const hour = o.closedAt?.getHours() || 0;
        const existing = byHour.get(hour) || { count: 0, revenue: 0 };
        byHour.set(hour, {
          count: existing.count + 1,
          revenue: existing.revenue + Number(o.total || 0),
        });
      });
    }

    const totalRevenue = orders.reduce((s, o) => s + Number(o.total || 0), 0);
    const totalOrders = orders.length;
    const totalGuests = orders.reduce((s, o) => s + (o.guests || 0), 0);

    res.json({
      success: true,
      data: {
        period,
        totals: {
          orders: totalOrders,
          revenue: Math.round(totalRevenue * 100) / 100,
          guests: totalGuests,
          avgCheck: totalOrders > 0 ? Math.round((totalRevenue / totalOrders) * 100) / 100 : 0,
        },
        byType: Array.from(byType.entries()).map(([type, data]) => ({
          type,
          ...data,
          revenue: Math.round(data.revenue * 100) / 100,
        })),
        byHour: period === 'today'
          ? Array.from({ length: 24 }, (_, hour) => ({
              hour,
              ...(byHour.get(hour) || { count: 0, revenue: 0 }),
            }))
          : undefined,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
