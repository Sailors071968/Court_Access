// ============================================
// Court Access — User Controller
// ============================================

import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database.js';

export async function handleGetUsers(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) { res.status(401).json({ error: 'Authentication required' }); return; }
    const users = await prisma.user.findMany({
      where: { tenantId: req.user.tenantId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });
    res.json(users);
  } catch (error) {
    next(error);
  }
}

export async function handleUpdateUser(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) { res.status(401).json({ error: 'Authentication required' }); return; }
    const { name, phone, smsEnabled } = req.body;

    const updated = await prisma.user.update({
      where: { id: req.user.userId },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(phone !== undefined ? { phone } : {}),
        ...(smsEnabled !== undefined ? { smsEnabled } : {}),
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        phone: true,
        smsEnabled: true,
        createdAt: true,
      },
    });
    res.json(updated);
  } catch (error) {
    next(error);
  }
}
