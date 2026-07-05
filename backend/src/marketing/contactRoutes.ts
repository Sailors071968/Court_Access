// ============================================================================
// Public Contact API — Program 0 Production Website
// Persists contact form submissions to GovernmentLead table
// ============================================================================

import type { FastifyInstance, FastifyReply } from 'fastify';
import { createGovernmentLead } from '../models/governmentLead.js';

interface ContactBody {
  name?: string;
  organization?: string;
  role?: string;
  email?: string;
  agencyType?: string;
  message?: string;
}

export async function registerContactRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/contact', async (request, reply: FastifyReply) => {
    const body = request.body as ContactBody;

    if (!body.name?.trim() || !body.email?.trim() || !body.message?.trim()) {
      return reply.code(400).send({ error: 'Name, email, and message are required.' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.email.trim())) {
      return reply.code(400).send({ error: 'Invalid email address.' });
    }

    try {
      const lead = await createGovernmentLead({
        agencyName: body.organization?.trim() || 'Individual',
        contactName: body.name.trim(),
        role: body.role?.trim() || 'Contact Form',
        email: body.email.trim().toLowerCase(),
        county: '',
        status: 'new',
        notes: body.message.trim(),
        agencyType: body.agencyType?.trim() || 'Other',
        seatEstimate: 0,
      });

      return reply.code(201).send({
        success: true,
        id: lead.id,
        message: 'Your message has been received. We will respond within 2 business days.',
      });
    } catch (err) {
      request.log.error({ err }, 'Contact form submission failed');
      return reply.code(500).send({ error: 'Unable to submit contact form. Please email support@courtaccess.net.' });
    }
  });
}
