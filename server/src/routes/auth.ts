import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';

const router = Router();
const prisma = new PrismaClient();

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      email: z.string().email(),
      password: z.string().min(1),
    });

    const { email, password } = schema.parse(req.body);

    const staff = await prisma.staff.findUnique({
      where: { email },
      include: {
        restaurant: {
          select: { id: true, name: true },
        },
      },
    });

    if (!staff || !staff.isActive) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials',
      });
    }

    const isValid = await bcrypt.compare(password, staff.password);
    if (!isValid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials',
      });
    }

    const token = jwt.sign(
      {
        userId: staff.id,
        email: staff.email,
        role: staff.role,
        restaurantId: staff.restaurantId,
      },
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: staff.id,
          email: staff.email,
          firstName: staff.firstName,
          lastName: staff.lastName,
          role: staff.role,
          restaurant: staff.restaurant,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      email: z.string().email(),
      password: z.string().min(8),
      firstName: z.string().min(1),
      lastName: z.string().min(1),
      restaurantId: z.string().uuid(),
      role: z.enum(['OWNER', 'MANAGER', 'HOST', 'SERVER', 'BARTENDER', 'KITCHEN', 'BUSSER']).optional(),
      hourlyRate: z.number().positive().optional(),
    });

    const input = schema.parse(req.body);

    // Check if email exists
    const existing = await prisma.staff.findUnique({
      where: { email: input.email },
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        error: 'Email already registered',
      });
    }

    const hashedPassword = await bcrypt.hash(input.password, 12);

    const staff = await prisma.staff.create({
      data: {
        email: input.email,
        password: hashedPassword,
        firstName: input.firstName,
        lastName: input.lastName,
        restaurantId: input.restaurantId,
        role: input.role || 'SERVER',
        hourlyRate: input.hourlyRate || 15.0,
      },
      include: {
        restaurant: {
          select: { id: true, name: true },
        },
      },
    });

    const token = jwt.sign(
      {
        userId: staff.id,
        email: staff.email,
        role: staff.role,
        restaurantId: staff.restaurantId,
      },
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: '24h' }
    );

    res.status(201).json({
      success: true,
      data: {
        token,
        user: {
          id: staff.id,
          email: staff.email,
          firstName: staff.firstName,
          lastName: staff.lastName,
          role: staff.role,
          restaurant: staff.restaurant,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/auth/me
router.get('/me', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'No token provided',
      });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') as any;

    const staff = await prisma.staff.findUnique({
      where: { id: decoded.userId },
      include: {
        restaurant: {
          select: { id: true, name: true, timezone: true },
        },
      },
    });

    if (!staff || !staff.isActive) {
      return res.status(401).json({
        success: false,
        error: 'User not found',
      });
    }

    res.json({
      success: true,
      data: {
        id: staff.id,
        email: staff.email,
        firstName: staff.firstName,
        lastName: staff.lastName,
        role: staff.role,
        restaurant: staff.restaurant,
      },
    });
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({
        success: false,
        error: 'Invalid token',
      });
    }
    next(error);
  }
});

// POST /api/auth/change-password
router.post('/change-password', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'No token provided',
      });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') as any;

    const schema = z.object({
      currentPassword: z.string(),
      newPassword: z.string().min(8),
    });

    const { currentPassword, newPassword } = schema.parse(req.body);

    const staff = await prisma.staff.findUnique({
      where: { id: decoded.userId },
    });

    if (!staff) {
      return res.status(401).json({
        success: false,
        error: 'User not found',
      });
    }

    const isValid = await bcrypt.compare(currentPassword, staff.password);
    if (!isValid) {
      return res.status(401).json({
        success: false,
        error: 'Current password is incorrect',
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await prisma.staff.update({
      where: { id: decoded.userId },
      data: { password: hashedPassword },
    });

    res.json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({
        success: false,
        error: 'Invalid token',
      });
    }
    next(error);
  }
});

export default router;
