// ============================================
// Court Access — Auth Controller
// ============================================

import type { Request, Response, NextFunction } from 'express';
import { registerUser, loginUser, getCurrentUser } from '../services/authService.js';

export async function handleRegister(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password, name, role, organizationName } = req.body;
    if (!email || !password || !name) {
      res.status(400).json({ error: 'email, password, and name are required' });
      return;
    }
    const result = await registerUser({ email, password, name, role, organizationName });
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

export async function handleLogin(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: 'email and password are required' });
      return;
    }
    const result = await loginUser({ email, password });
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function handleLogout(_req: Request, res: Response) {
  res.json({ message: 'Logged out' });
}

export async function handleMe(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    const user = await getCurrentUser(req.user.userId);
    res.json(user);
  } catch (error) {
    next(error);
  }
}
