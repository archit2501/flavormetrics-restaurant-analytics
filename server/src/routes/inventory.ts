import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const router = Router();
const prisma = new PrismaClient();

// GET /api/inventory - Current inventory
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const querySchema = z.object({
      restaurantId: z.string().uuid(),
      category: z.string().optional(),
      lowStock: z.enum(['true', 'false']).optional(),
    });

    const params = querySchema.parse(req.query);

    const where: any = { restaurantId: params.restaurantId };
    if (params.category) where.category = params.category;

    let items = await prisma.inventoryItem.findMany({
      where,
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });

    // Filter low stock if requested
    if (params.lowStock === 'true') {
      items = items.filter(
        (i) => Number(i.currentQuantity) <= Number(i.reorderPoint || 0)
      );
    }

    // Calculate inventory value
    const totalValue = items.reduce(
      (s, i) => s + Number(i.currentQuantity) * Number(i.unitCost || 0),
      0
    );

    res.json({
      success: true,
      data: {
        items,
        summary: {
          totalItems: items.length,
          totalValue: Math.round(totalValue * 100) / 100,
          lowStockCount: items.filter(
            (i) => Number(i.currentQuantity) <= Number(i.reorderPoint || 0)
          ).length,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/inventory/count - Submit inventory count
router.post('/count', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      items: z.array(z.object({
        id: z.string().uuid(),
        quantity: z.number().min(0),
      })),
    });

    const { items } = schema.parse(req.body);

    const updates = [];
    for (const item of items) {
      const updated = await prisma.inventoryItem.update({
        where: { id: item.id },
        data: { currentQuantity: item.quantity },
      });
      updates.push(updated);
    }

    res.json({
      success: true,
      data: {
        updated: updates.length,
        items: updates,
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/inventory/alerts - Low stock alerts
router.get('/alerts/:restaurantId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { restaurantId } = req.params;

    const items = await prisma.inventoryItem.findMany({
      where: { restaurantId },
    });

    const alerts = items
      .filter((i) => Number(i.currentQuantity) <= Number(i.reorderPoint || 0))
      .map((i) => ({
        id: i.id,
        name: i.name,
        category: i.category,
        currentQuantity: Number(i.currentQuantity),
        reorderPoint: Number(i.reorderPoint),
        parLevel: Number(i.parLevel),
        unit: i.unit,
        vendor: i.vendor,
        orderQuantity: Number(i.parLevel) - Number(i.currentQuantity),
        estimatedCost: (Number(i.parLevel) - Number(i.currentQuantity)) * Number(i.unitCost || 0),
        urgency: Number(i.currentQuantity) === 0
          ? 'critical'
          : Number(i.currentQuantity) < Number(i.reorderPoint || 0) * 0.5
          ? 'high'
          : 'medium',
      }))
      .sort((a, b) => {
        const urgencyOrder: Record<string, number> = { critical: 0, high: 1, medium: 2 };
        return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
      });

    res.json({
      success: true,
      data: {
        alerts,
        summary: {
          critical: alerts.filter((a) => a.urgency === 'critical').length,
          high: alerts.filter((a) => a.urgency === 'high').length,
          medium: alerts.filter((a) => a.urgency === 'medium').length,
          totalOrderValue: Math.round(
            alerts.reduce((s, a) => s + a.estimatedCost, 0) * 100
          ) / 100,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/waste - Waste log
router.get('/waste/:restaurantId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { restaurantId } = req.params;

    const querySchema = z.object({
      startDate: z.string().datetime().optional(),
      endDate: z.string().datetime().optional(),
      limit: z.coerce.number().min(1).max(100).default(50),
    });

    const params = querySchema.parse(req.query);

    const where: any = { restaurantId };

    if (params.startDate || params.endDate) {
      where.loggedAt = {};
      if (params.startDate) where.loggedAt.gte = new Date(params.startDate);
      if (params.endDate) where.loggedAt.lte = new Date(params.endDate);
    }

    const waste = await prisma.wasteLog.findMany({
      where,
      orderBy: { loggedAt: 'desc' },
      take: params.limit,
      include: {
        inventoryItem: {
          select: { name: true, category: true },
        },
        menuItem: {
          select: { name: true, category: true },
        },
        loggedByStaff: {
          select: { name: true },
        },
      },
    });

    // Aggregate by reason
    const byReason = new Map<string, { count: number; cost: number }>();
    waste.forEach((w) => {
      const reason = w.reason || 'other';
      const existing = byReason.get(reason) || { count: 0, cost: 0 };
      byReason.set(reason, {
        count: existing.count + 1,
        cost: existing.cost + Number(w.cost || 0),
      });
    });

    const totalCost = waste.reduce((s, w) => s + Number(w.cost || 0), 0);

    res.json({
      success: true,
      data: {
        waste: waste.map((w) => ({
          id: w.id,
          itemName: w.inventoryItem?.name || w.menuItem?.name || 'Unknown',
          category: w.inventoryItem?.category || w.menuItem?.category,
          quantity: Number(w.quantity),
          unit: w.unit,
          reason: w.reason,
          cost: Math.round(Number(w.cost || 0) * 100) / 100,
          loggedBy: w.loggedByStaff?.name,
          loggedAt: w.loggedAt,
        })),
        summary: {
          totalCost: Math.round(totalCost * 100) / 100,
          byReason: Array.from(byReason.entries()).map(([reason, data]) => ({
            reason,
            count: data.count,
            cost: Math.round(data.cost * 100) / 100,
            percentage: totalCost > 0
              ? Math.round((data.cost / totalCost) * 1000) / 10
              : 0,
          })),
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/waste - Log waste
router.post('/waste', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      restaurantId: z.string().uuid(),
      inventoryItemId: z.string().uuid().optional(),
      menuItemId: z.string().uuid().optional(),
      quantity: z.number().positive(),
      unit: z.string(),
      reason: z.enum(['spoilage', 'overproduction', 'accident', 'expired', 'other']),
      cost: z.number().optional(),
      loggedBy: z.string().uuid().optional(),
    });

    const input = schema.parse(req.body);

    // Calculate cost if not provided
    let cost = input.cost;
    if (!cost) {
      if (input.inventoryItemId) {
        const item = await prisma.inventoryItem.findUnique({
          where: { id: input.inventoryItemId },
        });
        cost = input.quantity * Number(item?.unitCost || 0);
      } else if (input.menuItemId) {
        const item = await prisma.menuItem.findUnique({
          where: { id: input.menuItemId },
        });
        cost = input.quantity * Number(item?.cost || 0);
      }
    }

    const waste = await prisma.wasteLog.create({
      data: {
        restaurantId: input.restaurantId,
        inventoryItemId: input.inventoryItemId,
        menuItemId: input.menuItemId,
        quantity: input.quantity,
        unit: input.unit,
        reason: input.reason,
        cost,
        loggedBy: input.loggedBy,
      },
    });

    // Update inventory quantity if inventory item
    if (input.inventoryItemId) {
      await prisma.inventoryItem.update({
        where: { id: input.inventoryItemId },
        data: {
          currentQuantity: {
            decrement: input.quantity,
          },
        },
      });
    }

    res.status(201).json({
      success: true,
      data: waste,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
