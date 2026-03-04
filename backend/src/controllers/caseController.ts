// ============================================
// Court Access — Case Controller
// ============================================

import type { Request, Response, NextFunction } from 'express';
import { createCase, listCases, getCaseById } from '../services/caseService.js';

export async function handleCreateCase(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) { res.status(401).json({ error: 'Authentication required' }); return; }
    const { title, caseNumber } = req.body;
    if (!title) { res.status(400).json({ error: 'title is required' }); return; }
    const result = await createCase({
      tenantId: req.user.tenantId,
      title,
      caseNumber,
    });
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

export async function handleListCases(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) { res.status(401).json({ error: 'Authentication required' }); return; }
    const result = await listCases(req.user.tenantId);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function handleGetCase(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) { res.status(401).json({ error: 'Authentication required' }); return; }
    const result = await getCaseById(req.params.id, req.user.tenantId);
    res.json(result);
  } catch (error) {
    next(error);
  }
}
