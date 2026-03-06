// ============================================
// Court Access — Phases 76-81: Public Records Request System
// Request tracking, timeline, document storage, templates, communication queue
// ============================================

import express from 'express';
import crypto from 'crypto';
import prisma from '../services/prismaClient.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { sendEmail } from '../services/emailService.js';

const router = express.Router();

// ---------------------------------------------------------------------------
// Phase 76: GET /api/records-requests — List requests (tenant-isolated)
// ---------------------------------------------------------------------------

router.get('/', authenticate, async (req, res) => {
  try {
    const tenantId = req.user.id;
    const { status, agencyId, caseId, page = '1', limit = '50' } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = { tenantId };
    if (status) where.status = status;
    if (agencyId) where.agencyId = agencyId;
    if (caseId) where.caseId = caseId;

    const [requests, total] = await Promise.all([
      prisma.publicRecordsRequest.findMany({
        where,
        include: {
          agency: {
            select: { agencyName: true, state: true, city: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit),
        skip,
      }),
      prisma.publicRecordsRequest.count({ where }),
    ]);

    res.json({
      requests,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
    });
  } catch (err) {
    console.error('[Records] List error:', err.message);
    res.status(500).json({ error: 'Failed to list records requests' });
  }
});

// ---------------------------------------------------------------------------
// Phase 76: GET /api/records-requests/:requestId — Get single request
// ---------------------------------------------------------------------------

router.get('/:requestId', authenticate, async (req, res) => {
  try {
    const { requestId } = req.params;
    const tenantId = req.user.id;

    const request = await prisma.publicRecordsRequest.findFirst({
      where: { id: requestId, tenantId },
      include: {
        agency: true,
      },
    });

    if (!request) {
      return res.status(404).json({ error: 'Records request not found' });
    }

    res.json({ request });
  } catch (err) {
    console.error('[Records] Get error:', err.message);
    res.status(500).json({ error: 'Failed to fetch records request' });
  }
});

// ---------------------------------------------------------------------------
// Phase 76: POST /api/records-requests — Create new records request
// ---------------------------------------------------------------------------

router.post('/', authenticate, async (req, res) => {
  try {
    const tenantId = req.user.id;
    const {
      agencyId, caseId, requestType, deliveryMethod,
      requestContent, templateId, notes,
    } = req.body;

    if (!agencyId || !requestType) {
      return res.status(400).json({ error: 'agencyId and requestType are required' });
    }

    const validTypes = ['public_records', 'body_camera', 'dispatch_logs', 'policy_manual', 'incident_report'];
    if (!validTypes.includes(requestType)) {
      return res.status(400).json({ error: `Invalid requestType. Must be one of: ${validTypes.join(', ')}` });
    }

    // Verify agency exists and belongs to tenant
    const agency = await prisma.lawEnforcementAgency.findFirst({
      where: { id: agencyId, tenantId },
    });

    if (!agency) {
      return res.status(404).json({ error: 'Agency not found' });
    }

    // Phase 78: Hash the outgoing request for immutability
    const requestDocumentHash = requestContent
      ? crypto.createHash('sha256').update(requestContent).digest('hex')
      : null;

    const request = await prisma.publicRecordsRequest.create({
      data: {
        agencyId,
        tenantId,
        caseId: caseId || null,
        requestType,
        deliveryMethod: deliveryMethod || 'email',
        requestContent: requestContent || '',
        requestDocumentHash,
        templateId: templateId || null,
        notes: notes || '',
        status: 'submitted',
        staffApproved: false,
      },
      include: {
        agency: {
          select: { agencyName: true, state: true },
        },
      },
    });

    // Phase 77: Generate timeline event for request submission
    if (caseId) {
      await prisma.timelineEvent.create({
        data: {
          caseId,
          timestamp: new Date(),
          sourceType: 'records_request',
          eventType: 'records_request_submitted',
          eventDescription: `Public records request submitted to ${agency.agencyName} (${requestType})`,
          metadata: {
            requestId: request.id,
            agencyId,
            requestType,
          },
        },
      });
    }

    console.log(JSON.stringify({
      event: 'records_request_created',
      requestId: request.id,
      agencyId,
      requestType,
      tenantId,
      timestamp: new Date().toISOString(),
    }));

    res.status(201).json({ request });
  } catch (err) {
    console.error('[Records] Create error:', err.message);
    res.status(500).json({ error: 'Failed to create records request' });
  }
});

// ---------------------------------------------------------------------------
// Phase 76: PATCH /api/records-requests/:requestId — Update request status
// ---------------------------------------------------------------------------

router.patch('/:requestId', authenticate, async (req, res) => {
  try {
    const { requestId } = req.params;
    const tenantId = req.user.id;
    const { status, notes } = req.body;

    const validStatuses = ['submitted', 'acknowledged', 'fulfilled', 'partial_response', 'denied', 'no_response'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }

    const data = {};
    if (status) data.status = status;
    if (notes !== undefined) data.notes = notes;
    if (status === 'fulfilled' || status === 'partial_response') {
      data.responseReceivedDate = new Date();
    }

    const result = await prisma.publicRecordsRequest.updateMany({
      where: { id: requestId, tenantId },
      data,
    });

    if (result.count === 0) {
      return res.status(404).json({ error: 'Records request not found' });
    }

    // Phase 77: Generate timeline event for status change
    const request = await prisma.publicRecordsRequest.findFirst({
      where: { id: requestId },
      include: { agency: { select: { agencyName: true } } },
    });

    if (request && request.caseId && status) {
      await prisma.timelineEvent.create({
        data: {
          caseId: request.caseId,
          timestamp: new Date(),
          sourceType: 'records_request',
          eventType: `records_request_${status}`,
          eventDescription: `Records request to ${request.agency.agencyName}: ${status.replace(/_/g, ' ')}`,
          metadata: {
            requestId,
            status,
          },
        },
      });
    }

    res.json({ updated: true, count: result.count });
  } catch (err) {
    console.error('[Records] Update error:', err.message);
    res.status(500).json({ error: 'Failed to update records request' });
  }
});

// ---------------------------------------------------------------------------
// Phase 79: POST /api/records-requests/:requestId/response — Upload response doc
// ---------------------------------------------------------------------------

router.post('/:requestId/response', authenticate, async (req, res) => {
  try {
    const { requestId } = req.params;
    const tenantId = req.user.id;
    const { responseContent } = req.body;

    if (!responseContent) {
      return res.status(400).json({ error: 'responseContent is required' });
    }

    // Phase 79: Hash the response document for integrity verification
    const responseHash = crypto.createHash('sha256').update(responseContent).digest('hex');

    const result = await prisma.publicRecordsRequest.updateMany({
      where: { id: requestId, tenantId },
      data: {
        responseHash,
        responseReceivedDate: new Date(),
        status: 'fulfilled',
      },
    });

    if (result.count === 0) {
      return res.status(404).json({ error: 'Records request not found' });
    }

    // Phase 77: Timeline event for response receipt
    const request = await prisma.publicRecordsRequest.findFirst({
      where: { id: requestId },
      include: { agency: { select: { agencyName: true } } },
    });

    if (request && request.caseId) {
      await prisma.timelineEvent.create({
        data: {
          caseId: request.caseId,
          timestamp: new Date(),
          sourceType: 'records_request',
          eventType: 'records_response_received',
          eventDescription: `Response received from ${request.agency.agencyName} (hash: ${responseHash.substring(0, 12)}...)`,
          metadata: {
            requestId,
            responseHash,
          },
        },
      });
    }

    console.log(JSON.stringify({
      event: 'records_response_received',
      requestId,
      responseHash,
      timestamp: new Date().toISOString(),
    }));

    res.json({ updated: true, responseHash });
  } catch (err) {
    console.error('[Records] Response upload error:', err.message);
    res.status(500).json({ error: 'Failed to upload response' });
  }
});

// ---------------------------------------------------------------------------
// Phase 81: POST /api/records-requests/:requestId/approve — Staff approval
// ---------------------------------------------------------------------------

router.post('/:requestId/approve', authenticate, requireRole('admin', 'staff'), async (req, res) => {
  try {
    const { requestId } = req.params;
    const tenantId = req.user.id;

    const result = await prisma.publicRecordsRequest.updateMany({
      where: { id: requestId, tenantId, staffApproved: false },
      data: {
        staffApproved: true,
        staffApprovedBy: req.user.id,
        staffApprovedAt: new Date(),
      },
    });

    if (result.count === 0) {
      return res.status(404).json({ error: 'Records request not found or already approved' });
    }

    res.json({ approved: true });
  } catch (err) {
    console.error('[Records] Approve error:', err.message);
    res.status(500).json({ error: 'Failed to approve request' });
  }
});

// ---------------------------------------------------------------------------
// Phase 81: POST /api/records-requests/:requestId/send — Send via email queue
// ---------------------------------------------------------------------------

router.post('/:requestId/send', authenticate, requireRole('admin', 'staff'), async (req, res) => {
  try {
    const { requestId } = req.params;
    const tenantId = req.user.id;

    const request = await prisma.publicRecordsRequest.findFirst({
      where: { id: requestId, tenantId },
      include: { agency: true },
    });

    if (!request) {
      return res.status(404).json({ error: 'Records request not found' });
    }

    if (!request.staffApproved) {
      return res.status(400).json({ error: 'Request must be staff-approved before sending' });
    }

    if (!request.agency.emailRecordsDivision) {
      return res.status(400).json({ error: 'Agency has no records division email address' });
    }

    // Queue the email send via EmailService (Phase 81)
    const emailResult = await sendEmail({
      to: request.agency.emailRecordsDivision,
      subject: `Public Records Request — ${request.requestType.replace(/_/g, ' ')}`,
      body: request.requestContent,
      emailType: 'transactional',
      metadata: {
        requestId: request.id,
        agencyId: request.agencyId,
        requestType: request.requestType,
      },
    });

    res.json({ sent: emailResult.success, emailResult });
  } catch (err) {
    console.error('[Records] Send error:', err.message);
    res.status(500).json({ error: 'Failed to send records request' });
  }
});

// ---------------------------------------------------------------------------
// Phase 80: GET /api/records-requests/templates — List templates
// ---------------------------------------------------------------------------

router.get('/templates/list', authenticate, async (req, res) => {
  try {
    const tenantId = req.user.id;

    const templates = await prisma.recordsRequestTemplate.findMany({
      where: { tenantId },
      orderBy: { templateName: 'asc' },
    });

    res.json({ templates });
  } catch (err) {
    console.error('[Records] Templates error:', err.message);
    res.status(500).json({ error: 'Failed to list templates' });
  }
});

// ---------------------------------------------------------------------------
// Phase 80: POST /api/records-requests/templates — Create/seed template
// ---------------------------------------------------------------------------

router.post('/templates', authenticate, requireRole('admin', 'staff'), async (req, res) => {
  try {
    const tenantId = req.user.id;
    const { templateName, displayName, content, mergeFields } = req.body;

    if (!templateName || !content) {
      return res.status(400).json({ error: 'templateName and content are required' });
    }

    const template = await prisma.recordsRequestTemplate.upsert({
      where: {
        tenantId_templateName: { tenantId, templateName },
      },
      update: {
        displayName: displayName || templateName,
        content,
        mergeFields: mergeFields || [],
      },
      create: {
        tenantId,
        templateName,
        displayName: displayName || templateName,
        content,
        mergeFields: mergeFields || [
          'agency_name', 'records_email', 'records_phone', 'county', 'state',
        ],
      },
    });

    res.status(201).json({ template });
  } catch (err) {
    console.error('[Records] Template create error:', err.message);
    res.status(500).json({ error: 'Failed to create template' });
  }
});

// ---------------------------------------------------------------------------
// Phase 80: POST /api/records-requests/templates/render — Render template with merge fields
// ---------------------------------------------------------------------------

router.post('/templates/render', authenticate, async (req, res) => {
  try {
    const tenantId = req.user.id;
    const { templateName, mergeData } = req.body;

    if (!templateName) {
      return res.status(400).json({ error: 'templateName is required' });
    }

    const template = await prisma.recordsRequestTemplate.findUnique({
      where: {
        tenantId_templateName: { tenantId, templateName },
      },
    });

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // Replace merge fields: {{field_name}} -> value
    let rendered = template.content;
    if (mergeData && typeof mergeData === 'object') {
      for (const [key, value] of Object.entries(mergeData)) {
        rendered = rendered.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(value));
      }
    }

    res.json({ rendered, templateName: template.templateName });
  } catch (err) {
    console.error('[Records] Template render error:', err.message);
    res.status(500).json({ error: 'Failed to render template' });
  }
});

// ---------------------------------------------------------------------------
// Phase 80: POST /api/records-requests/templates/seed — Seed default templates
// ---------------------------------------------------------------------------

router.post('/templates/seed', authenticate, requireRole('admin', 'staff'), async (req, res) => {
  try {
    const tenantId = req.user.id;

    const defaultTemplates = [
      {
        templateName: 'public_records',
        displayName: 'Public Records Request',
        content: `Dear {{agency_name}} Records Division,\n\nPursuant to [State Public Records Act], I am requesting the following records:\n\n[DESCRIBE RECORDS REQUESTED]\n\nPlease direct any questions or correspondence to:\n{{requester_name}}\n{{requester_email}}\n{{requester_phone}}\n\nThank you for your prompt attention to this request.\n\nSincerely,\n{{requester_name}}`,
      },
      {
        templateName: 'body_camera',
        displayName: 'Body Camera Request',
        content: `Dear {{agency_name}} Records Division,\n\nPursuant to [State Public Records Act], I am requesting all body-worn camera footage from the following incident:\n\nDate: {{incident_date}}\nLocation: {{incident_location}}\nIncident/Report Number: {{incident_number}}\nOfficer(s) Involved: {{officer_names}}\n\nPlease provide the footage in its original format.\n\nSincerely,\n{{requester_name}}`,
      },
      {
        templateName: 'dispatch_logs',
        displayName: 'Dispatch Logs Request',
        content: `Dear {{agency_name}} Records Division,\n\nPursuant to [State Public Records Act], I am requesting all dispatch/CAD logs for:\n\nDate Range: {{date_range}}\nIncident/Report Number: {{incident_number}}\nLocation: {{incident_location}}\n\nPlease include all call notes, unit assignments, and timestamps.\n\nSincerely,\n{{requester_name}}`,
      },
      {
        templateName: 'policy_manual',
        displayName: 'Policy Manual Request',
        content: `Dear {{agency_name}} Records Division,\n\nPursuant to [State Public Records Act], I am requesting a copy of the following department policies:\n\n{{policy_sections}}\n\nPlease provide the most current version of each policy.\n\nSincerely,\n{{requester_name}}`,
      },
      {
        templateName: 'incident_report',
        displayName: 'Incident Report Request',
        content: `Dear {{agency_name}} Records Division,\n\nPursuant to [State Public Records Act], I am requesting the following incident/police report:\n\nReport Number: {{incident_number}}\nDate of Incident: {{incident_date}}\nLocation: {{incident_location}}\n\nPlease include all supplemental reports, witness statements, and attachments.\n\nSincerely,\n{{requester_name}}`,
      },
    ];

    const mergeFields = ['agency_name', 'records_email', 'records_phone', 'county', 'state',
      'requester_name', 'requester_email', 'requester_phone', 'incident_date',
      'incident_location', 'incident_number', 'officer_names', 'date_range', 'policy_sections'];

    const results = [];
    for (const tmpl of defaultTemplates) {
      const result = await prisma.recordsRequestTemplate.upsert({
        where: {
          tenantId_templateName: { tenantId, templateName: tmpl.templateName },
        },
        update: {
          displayName: tmpl.displayName,
          content: tmpl.content,
          mergeFields,
          isDefault: true,
        },
        create: {
          tenantId,
          templateName: tmpl.templateName,
          displayName: tmpl.displayName,
          content: tmpl.content,
          mergeFields,
          isDefault: true,
        },
      });
      results.push(result);
    }

    res.json({ seeded: results.length, templates: results });
  } catch (err) {
    console.error('[Records] Seed templates error:', err.message);
    res.status(500).json({ error: 'Failed to seed templates' });
  }
});

export default router;
