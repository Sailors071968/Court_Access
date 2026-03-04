// ============================================
// Court Access — Validation Utilities
// ============================================

import { z } from 'zod';

export const emailSchema = z.string().email().max(255);
export const passwordSchema = z.string().min(8).max(128);
export const nameSchema = z.string().min(1).max(255);
export const roleSchema = z.enum(['client', 'staff', 'admin']);
export const uuidSchema = z.string().uuid();

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: nameSchema,
  role: roleSchema.optional().default('client'),
  organizationName: z.string().min(1).max(255).optional(),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1),
});

export const createCaseSchema = z.object({
  caseName: z.string().min(1).max(500),
  caseNumber: z.string().max(100).optional(),
  jurisdiction: z.string().max(500).optional(),
  court: z.string().max(500).optional(),
  judge: z.string().max(255).optional(),
});

export const ALLOWED_FILE_TYPES = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'] as const;
export const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.txt'] as const;

export function isAllowedFileType(mimetype: string): boolean {
  return (ALLOWED_FILE_TYPES as readonly string[]).includes(mimetype);
}

export function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot === -1) return '';
  return filename.substring(lastDot);
}
