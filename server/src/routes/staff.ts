import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const router = Router();
const prisma = new PrismaClient();

// GET /api/staff - List staff
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const querySchema = z.object({
      restaurantId: z.string().uuid(),
      role: z.string().optional(),
      active: z.enum(['true', 'false']).optional(),
    });

    const params = querySchema.parse(req.query);

    const where: any = { restaurantId: params.restaurantId };
    if (params.role) where.role = params.role;
    if (params.active !== undefined) where.isActive = params.active === 'true';

    const staff = await prisma.staff.findMany({
      where,
      orderBy: { name: 'asc' },
    });

    res.json({
      success: true,
      data: staff,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/staff/:id/performance - Staff metrics
router.get('/:id/performance', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const querySchema = z.object({
      days: z.coerce.number().min(7).max(90).default(30),
    });

    const { days } = querySchema.parse(req.query);

    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const staff = await prisma.staff.findUnique({
      where: { id },
    });

    if (!staff) {
      return res.status(404).json({
        success: false,
        error: 'Staff member not found',
      });
    }

    // Get shifts
    const shifts = await prisma.shift.findMany({
      where: {
        staffId: id,
        scheduledStart: { gte: startDate },
      },
    });

    // Calculate hours worked
    const totalHours = shifts.reduce((sum, s) => {
      const hours = s.actualEnd && s.actualStart
        ? (s.actualEnd.getTime() - s.actualStart.getTime()) / (1000 * 60 * 60)
        : (s.scheduledEnd.getTime() - s.scheduledStart.getTime()) / (1000 * 60 * 60);
      return sum + hours;
    }, 0);

    // Get orders for servers
    let salesMetrics = null;
    if (staff.role === 'server') {
      const orders = await prisma.order.findMany({
        where: {
          serverId: id,
          closedAt: { gte: startDate },
          status: 'closed',
        },
      });

      const totalSales = orders.reduce((s, o) => s + Number(o.total || 0), 0);
      const totalTips = orders.reduce((s, o) => s + Number(o.tip || 0), 0);
      const totalGuests = orders.reduce((s, o) => s + (o.guests || 0), 0);

      salesMetrics = {
        totalOrders: orders.length,
        totalSales: Math.round(totalSales * 100) / 100,
        totalTips: Math.round(totalTips * 100) / 100,
        avgCheck: orders.length > 0 ? Math.round((totalSales / orders.length) * 100) / 100 : 0,
        avgTipPercent: totalSales > 0 ? Math.round((totalTips / totalSales) * 1000) / 10 : 0,
        salesPerHour: totalHours > 0 ? Math.round((totalSales / totalHours) * 100) / 100 : 0,
        guestsServed: totalGuests,
      };
    }

    res.json({
      success: true,
      data: {
        staff: {
          id: staff.id,
          name: staff.name,
          role: staff.role,
          hourlyRate: Number(staff.hourlyRate),
        },
        period: { days, startDate: startDate.toISOString() },
        labor: {
          shiftsWorked: shifts.length,
          totalHours: Math.round(totalHours * 10) / 10,
          avgHoursPerShift: shifts.length > 0
            ? Math.round((totalHours / shifts.length) * 10) / 10
            : 0,
        },
        sales: salesMetrics,
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/staff/schedule - Weekly schedule
router.get('/schedule/:restaurantId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { restaurantId } = req.params;

    const querySchema = z.object({
      weekStart: z.string().datetime(),
    });

    const { weekStart } = querySchema.parse(req.query);

    const startDate = new Date(weekStart);
    const endDate = new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000);

    const shifts = await prisma.shift.findMany({
      where: {
        restaurantId,
        scheduledStart: {
          gte: startDate,
          lt: endDate,
        },
      },
      include: {
        staff: {
          select: { id: true, name: true, role: true, hourlyRate: true },
        },
      },
      orderBy: [{ scheduledStart: 'asc' }, { role: 'asc' }],
    });

    // Group by day
    const byDay = new Map<string, any[]>();
    for (let i = 0; i < 7; i++) {
      const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
      byDay.set(date.toISOString().slice(0, 10), []);
    }

    shifts.forEach((s) => {
      const date = s.scheduledStart.toISOString().slice(0, 10);
      const dayShifts = byDay.get(date) || [];
      dayShifts.push({
        id: s.id,
        staffId: s.staffId,
        staffName: s.staff?.name,
        role: s.role,
        start: s.scheduledStart.toISOString(),
        end: s.scheduledEnd.toISOString(),
        hours: (s.scheduledEnd.getTime() - s.scheduledStart.getTime()) / (1000 * 60 * 60),
        status: s.status,
      });
      byDay.set(date, dayShifts);
    });

    // Calculate totals
    const totalHours = shifts.reduce((sum, s) => {
      return sum + (s.scheduledEnd.getTime() - s.scheduledStart.getTime()) / (1000 * 60 * 60);
    }, 0);

    const totalCost = shifts.reduce((sum, s) => {
      const hours = (s.scheduledEnd.getTime() - s.scheduledStart.getTime()) / (1000 * 60 * 60);
      return sum + hours * Number(s.staff?.hourlyRate || 15);
    }, 0);

    res.json({
      success: true,
      data: {
        weekStart: startDate.toISOString().slice(0, 10),
        weekEnd: new Date(endDate.getTime() - 1).toISOString().slice(0, 10),
        schedule: Array.from(byDay.entries()).map(([date, dayShifts]) => ({
          date,
          shifts: dayShifts,
          totalHours: dayShifts.reduce((s, sh) => s + sh.hours, 0),
        })),
        summary: {
          totalShifts: shifts.length,
          totalHours: Math.round(totalHours * 10) / 10,
          estimatedCost: Math.round(totalCost * 100) / 100,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/staff/schedule/optimize - AI scheduling
router.post('/schedule/optimize/:restaurantId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { restaurantId } = req.params;

    const schema = z.object({
      weekStart: z.string().datetime(),
      constraints: z.object({
        maxHoursPerEmployee: z.number().default(40),
        minHoursPerShift: z.number().default(4),
        maxHoursPerShift: z.number().default(10),
      }).optional(),
    });

    const { weekStart, constraints } = schema.parse(req.body);

    const startDate = new Date(weekStart);

    // Get cover forecasts
    const forecasts = await prisma.demandForecast.findMany({
      where: {
        restaurantId,
        forecastDate: {
          gte: startDate,
          lt: new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000),
        },
      },
    });

    // Get available staff
    const staff = await prisma.staff.findMany({
      where: { restaurantId, isActive: true },
    });

    // Simple optimization: schedule based on forecasted covers
    const recommendations = [];
    const staffHours = new Map<string, number>();

    for (const forecast of forecasts) {
      const covers = forecast.predictedCovers || 50;
      const date = forecast.forecastDate;

      // Calculate staff needed (simplified)
      const serversNeeded = Math.ceil(covers / 20); // 20 covers per server
      const cooksNeeded = Math.ceil(covers / 40); // 40 covers per cook

      const dayRecommendation = {
        date: date.toISOString().slice(0, 10),
        expectedCovers: covers,
        staffing: {
          servers: serversNeeded,
          cooks: cooksNeeded,
          total: serversNeeded + cooksNeeded + 1, // +1 for host/manager
        },
        suggestedShifts: [] as any[],
      };

      // Assign servers
      const servers = staff.filter((s) => s.role === 'server');
      for (let i = 0; i < serversNeeded && i < servers.length; i++) {
        const server = servers[i];
        const currentHours = staffHours.get(server.id) || 0;

        if (currentHours < (constraints?.maxHoursPerEmployee || 40)) {
          dayRecommendation.suggestedShifts.push({
            staffId: server.id,
            staffName: server.name,
            role: 'server',
            start: `${date.toISOString().slice(0, 10)}T11:00:00`,
            end: `${date.toISOString().slice(0, 10)}T20:00:00`,
            hours: 9,
          });
          staffHours.set(server.id, currentHours + 9);
        }
      }

      recommendations.push(dayRecommendation);
    }

    res.json({
      success: true,
      data: {
        weekStart: startDate.toISOString().slice(0, 10),
        recommendations,
        summary: {
          totalShiftsRecommended: recommendations.reduce(
            (s, r) => s + r.suggestedShifts.length, 0
          ),
          staffUtilization: Object.fromEntries(staffHours),
        },
        note: 'These are AI-generated recommendations. Please review and adjust as needed.',
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
