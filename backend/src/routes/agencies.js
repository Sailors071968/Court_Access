// ============================================
// Court Access — Phases 70-75: Law Enforcement Agency Intelligence
// Agency database, state selector, discovery, review queue
// ============================================

import express from 'express';
import prisma from '../services/prismaClient.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = express.Router();

// ---------------------------------------------------------------------------
// US States List (Phase 71)
// ---------------------------------------------------------------------------

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA',
  'HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
  'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
  'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY',
];

const AGENCY_TYPES = [
  'state_police',
  'county_sheriff',
  'city_police',
  'regional_task_force',
  'transit_police',
  'university_police',
  'other',
];

// ---------------------------------------------------------------------------
// Phase 71: GET /api/agencies/states — Get all 50 states
// ---------------------------------------------------------------------------

router.get('/states', authenticate, requireRole('admin', 'staff'), async (_req, res) => {
  res.json({ states: US_STATES });
});

// ---------------------------------------------------------------------------
// Phase 70: GET /api/agencies — List agencies (with filters)
// ---------------------------------------------------------------------------

router.get('/', authenticate, async (req, res) => {
  try {
    const { state, agencyType, status, search, page = '1', limit = '50' } = req.query;
    const tenantId = req.user.id;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = { tenantId };
    if (state) where.state = state;
    if (agencyType) where.agencyType = agencyType;
    if (status) where.verificationStatus = status;
    if (search) {
      where.OR = [
        { agencyName: { contains: search, mode: 'insensitive' } },
        { city: { contains: search, mode: 'insensitive' } },
        { county: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [agencies, total] = await Promise.all([
      prisma.lawEnforcementAgency.findMany({
        where,
        orderBy: { agencyName: 'asc' },
        take: parseInt(limit),
        skip,
      }),
      prisma.lawEnforcementAgency.count({ where }),
    ]);

    res.json({
      agencies,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
    });
  } catch (err) {
    console.error('[Agencies] List error:', err.message);
    res.status(500).json({ error: 'Failed to list agencies' });
  }
});

// ---------------------------------------------------------------------------
// Phase 75: GET /api/agencies/queue/review — Staff review queue
// MUST be registered BEFORE /:agencyId to avoid Express param shadowing
// ---------------------------------------------------------------------------

router.get('/queue/review', authenticate, requireRole('admin', 'staff'), async (req, res) => {
  try {
    const tenantId = req.user.id;
    const { state } = req.query;

    const where = {
      tenantId,
      verificationStatus: { in: ['pending', 'needs_review'] },
    };
    if (state) where.state = state;

    const agencies = await prisma.lawEnforcementAgency.findMany({
      where,
      orderBy: { discoveredAt: 'desc' },
    });

    res.json({ agencies, count: agencies.length });
  } catch (err) {
    console.error('[Agencies] Review queue error:', err.message);
    res.status(500).json({ error: 'Failed to fetch review queue' });
  }
});

// ---------------------------------------------------------------------------
// Phase 70: GET /api/agencies/stats/summary — Agency statistics
// MUST be registered BEFORE /:agencyId to avoid Express param shadowing
// ---------------------------------------------------------------------------

router.get('/stats/summary', authenticate, requireRole('admin', 'staff'), async (req, res) => {
  try {
    const tenantId = req.user.id;

    const [byState, byType, byStatus, total] = await Promise.all([
      prisma.lawEnforcementAgency.groupBy({
        by: ['state'],
        where: { tenantId },
        _count: { id: true },
      }),
      prisma.lawEnforcementAgency.groupBy({
        by: ['agencyType'],
        where: { tenantId },
        _count: { id: true },
      }),
      prisma.lawEnforcementAgency.groupBy({
        by: ['verificationStatus'],
        where: { tenantId },
        _count: { id: true },
      }),
      prisma.lawEnforcementAgency.count({ where: { tenantId } }),
    ]);

    res.json({
      total,
      byState: byState.reduce((acc, s) => { acc[s.state] = s._count.id; return acc; }, {}),
      byType: byType.reduce((acc, s) => { acc[s.agencyType] = s._count.id; return acc; }, {}),
      byStatus: byStatus.reduce((acc, s) => { acc[s.verificationStatus] = s._count.id; return acc; }, {}),
    });
  } catch (err) {
    console.error('[Agencies] Stats error:', err.message);
    res.status(500).json({ error: 'Failed to fetch agency stats' });
  }
});

// ---------------------------------------------------------------------------
// Phase 70: GET /api/agencies/:agencyId — Get single agency
// ---------------------------------------------------------------------------

router.get('/:agencyId', authenticate, async (req, res) => {
  try {
    const { agencyId } = req.params;
    const tenantId = req.user.id;

    const agency = await prisma.lawEnforcementAgency.findFirst({
      where: { id: agencyId, tenantId },
      include: {
        recordsRequests: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!agency) {
      return res.status(404).json({ error: 'Agency not found' });
    }

    res.json({ agency });
  } catch (err) {
    console.error('[Agencies] Get error:', err.message);
    res.status(500).json({ error: 'Failed to fetch agency' });
  }
});

// ---------------------------------------------------------------------------
// Phase 72: POST /api/agencies/discover — Trigger agency discovery for a state
// ---------------------------------------------------------------------------

router.post('/discover', authenticate, requireRole('admin', 'staff'), async (req, res) => {
  try {
    const { state } = req.body;
    const tenantId = req.user.id;

    if (!state || !US_STATES.includes(state)) {
      return res.status(400).json({ error: 'Valid US state abbreviation required' });
    }

    // Queue a discovery job
    const job = await prisma.emailJob.create({
      data: {
        emailType: 'processing_alert',
        recipient: 'system',
        payload: {
          type: 'agency_discovery',
          state,
          tenantId,
          requestedAt: new Date().toISOString(),
        },
        status: 'queued',
      },
    });

    console.log(JSON.stringify({
      event: 'agency_discovery_queued',
      state,
      tenantId,
      jobId: job.id,
      timestamp: new Date().toISOString(),
    }));

    res.json({
      queued: true,
      state,
      jobId: job.id,
      message: `Agency discovery job queued for ${state}`,
    });
  } catch (err) {
    console.error('[Agencies] Discovery error:', err.message);
    res.status(500).json({ error: 'Failed to queue discovery job' });
  }
});

// ---------------------------------------------------------------------------
// Phase 70: POST /api/agencies — Create agency (manual or from discovery)
// ---------------------------------------------------------------------------

router.post('/', authenticate, requireRole('admin', 'staff'), async (req, res) => {
  try {
    const tenantId = req.user.id;
    const {
      agencyName, agencyType, state, county, city, address,
      phoneMain, phoneRecordsDivision, emailRecordsDivision,
      website, recordsRequestUrl, dataSource,
    } = req.body;

    if (!agencyName || !state) {
      return res.status(400).json({ error: 'agencyName and state are required' });
    }

    if (agencyType && !AGENCY_TYPES.includes(agencyType)) {
      return res.status(400).json({ error: `Invalid agencyType. Must be one of: ${AGENCY_TYPES.join(', ')}` });
    }

    const agency = await prisma.lawEnforcementAgency.create({
      data: {
        tenantId,
        agencyName,
        agencyType: agencyType || 'other',
        state,
        county: county || '',
        city: city || '',
        address: address || '',
        phoneMain: phoneMain || '',
        phoneRecordsDivision: phoneRecordsDivision || '',
        emailRecordsDivision: emailRecordsDivision || '',
        website: website || '',
        recordsRequestUrl: recordsRequestUrl || '',
        dataSource: dataSource || 'manual_entry',
        verificationStatus: 'pending',
      },
    });

    // Phase 73: Check for missing critical fields
    const missingFields = [];
    if (!phoneRecordsDivision) missingFields.push('phoneRecordsDivision');
    if (!emailRecordsDivision) missingFields.push('emailRecordsDivision');
    if (!recordsRequestUrl) missingFields.push('recordsRequestUrl');

    if (missingFields.length > 0) {
      console.log(JSON.stringify({
        event: 'agency_missing_fields',
        agencyId: agency.id,
        agencyName,
        state,
        missingFields,
        timestamp: new Date().toISOString(),
      }));
    }

    // Phase 74: New agency alert
    console.log(JSON.stringify({
      event: 'new_agency_discovered',
      agencyId: agency.id,
      agencyName,
      state,
      dataSource: dataSource || 'manual_entry',
      timestamp: new Date().toISOString(),
    }));

    res.status(201).json({
      agency,
      missingFields: missingFields.length > 0 ? missingFields : undefined,
    });
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'Agency with this name already exists in this state for this tenant' });
    }
    console.error('[Agencies] Create error:', err.message);
    res.status(500).json({ error: 'Failed to create agency' });
  }
});

// ---------------------------------------------------------------------------
// Phase 75: PATCH /api/agencies/:agencyId — Staff review (approve/edit/reject)
// ---------------------------------------------------------------------------

router.patch('/:agencyId', authenticate, requireRole('admin', 'staff'), async (req, res) => {
  try {
    const { agencyId } = req.params;
    const tenantId = req.user.id;
    const updates = req.body;

    // Only allow valid fields
    const allowedFields = [
      'agencyName', 'agencyType', 'state', 'county', 'city', 'address',
      'phoneMain', 'phoneRecordsDivision', 'emailRecordsDivision',
      'website', 'recordsRequestUrl', 'verificationStatus',
    ];

    const data = {};
    for (const key of allowedFields) {
      if (updates[key] !== undefined) {
        data[key] = updates[key];
      }
    }

    if (data.verificationStatus === 'approved') {
      data.lastVerifiedAt = new Date();
    }

    const result = await prisma.lawEnforcementAgency.updateMany({
      where: { id: agencyId, tenantId },
      data,
    });

    if (result.count === 0) {
      return res.status(404).json({ error: 'Agency not found' });
    }

    res.json({ updated: true, count: result.count });
  } catch (err) {
    console.error('[Agencies] Update error:', err.message);
    res.status(500).json({ error: 'Failed to update agency' });
  }
});

export default router;
