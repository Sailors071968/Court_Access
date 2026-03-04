// ============================================
// Court Access — Analytics Controller
// ============================================

import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database.js';

export async function handleGetDashboardMetrics(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) { res.status(401).json({ error: 'Authentication required' }); return; }
    const tenantId = req.user.tenantId;

    const [casesTotal, documentsTotal, documentsProcessing, analysisCompletedToday] = await Promise.all([
      prisma.case.count({ where: { tenantId } }),
      prisma.document.count({
        where: { case: { tenantId } },
      }),
      prisma.document.count({
        where: { case: { tenantId }, analysisStatus: 'processing' },
      }),
      prisma.document.count({
        where: {
          case: { tenantId },
          analysisStatus: 'completed',
          uploadedAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
      }),
    ]);

    res.json({
      cases_total: casesTotal,
      documents_total: documentsTotal,
      documents_processing: documentsProcessing,
      analysis_completed_today: analysisCompletedToday,
    });
  } catch (error) {
    next(error);
  }
}
