// ============================================
// Court Access — User Service
// ============================================

import { eq, and } from 'drizzle-orm';
import { db } from '../config/database.js';
import { users } from '../models/schema.js';
import { AppError } from '../middleware/errorHandler.js';

/**
 * Get user profile by ID (tenant-scoped).
 */
export async function getUserProfile(userId: string, tenantId: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(and(eq(users.id, userId), eq(users.tenantId, tenantId)))
    .limit(1);

  if (!user) {
    throw new AppError('User not found', 404);
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    tenantId: user.tenantId,
    phone: user.phone,
    smsEnabled: user.smsEnabled,
    createdAt: user.createdAt,
  };
}

/**
 * Update user profile (tenant-scoped).
 */
export async function updateUserProfile(
  userId: string,
  tenantId: string,
  updates: { name?: string; phone?: string; smsEnabled?: boolean }
) {
  const [user] = await db
    .select()
    .from(users)
    .where(and(eq(users.id, userId), eq(users.tenantId, tenantId)))
    .limit(1);

  if (!user) {
    throw new AppError('User not found', 404);
  }

  const updateData: Record<string, unknown> = {};
  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.phone !== undefined) updateData.phone = updates.phone;
  if (updates.smsEnabled !== undefined) updateData.smsEnabled = updates.smsEnabled;

  if (Object.keys(updateData).length === 0) {
    return user;
  }

  const [updated] = await db
    .update(users)
    .set(updateData)
    .where(and(eq(users.id, userId), eq(users.tenantId, tenantId)))
    .returning();

  return {
    id: updated.id,
    email: updated.email,
    name: updated.name,
    role: updated.role,
    tenantId: updated.tenantId,
    phone: updated.phone,
    smsEnabled: updated.smsEnabled,
    createdAt: updated.createdAt,
  };
}

/**
 * List all users for a tenant (admin only).
 */
export async function listTenantUsers(tenantId: string) {
  const result = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.tenantId, tenantId));

  return result;
}
