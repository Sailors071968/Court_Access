// ============================================
// Court Access — Auth Service
// ============================================

import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { eq } from 'drizzle-orm';
import { db } from '../config/database.js';
import { users, tenants } from '../models/schema.js';
import { env } from '../config/env.js';
import { AppError } from '../middleware/errorHandler.js';
import { logger } from '../utils/loggingUtils.js';
import type { JwtPayload } from '../middleware/authMiddleware.js';

const SALT_ROUNDS = 12;

export interface RegisterInput {
  email: string;
  password: string;
  name: string;
  role?: string;
  organizationName?: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    tenantId: string;
  };
}

/**
 * Register a new user. Creates tenant if organizationName provided.
 */
export async function registerUser(input: RegisterInput): Promise<AuthResponse> {
  // Check if user already exists
  const existing = await db.select().from(users).where(eq(users.email, input.email)).limit(1);
  if (existing.length > 0) {
    throw new AppError('Email already registered', 409);
  }

  // Create tenant
  const [tenant] = await db
    .insert(tenants)
    .values({
      organizationName: input.organizationName || `${input.name}'s Organization`,
    })
    .returning();

  // Hash password
  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

  // Create user
  const [user] = await db
    .insert(users)
    .values({
      tenantId: tenant.id,
      email: input.email,
      passwordHash,
      name: input.name,
      role: input.role || 'client',
    })
    .returning();

  logger.info('User registered', { userId: user.id, tenantId: tenant.id });

  const token = generateToken({
    userId: user.id,
    tenantId: tenant.id,
    role: user.role,
  });

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      tenantId: tenant.id,
    },
  };
}

/**
 * Authenticate user with email + password.
 */
export async function loginUser(input: LoginInput): Promise<AuthResponse> {
  const [user] = await db.select().from(users).where(eq(users.email, input.email)).limit(1);
  if (!user) {
    throw new AppError('Invalid credentials', 401);
  }

  const validPassword = await bcrypt.compare(input.password, user.passwordHash);
  if (!validPassword) {
    throw new AppError('Invalid credentials', 401);
  }

  logger.info('User logged in', { userId: user.id });

  const token = generateToken({
    userId: user.id,
    tenantId: user.tenantId,
    role: user.role,
  });

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      tenantId: user.tenantId,
    },
  };
}

/**
 * Get current user profile.
 */
export async function getCurrentUser(userId: string) {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
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

function generateToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as string,
  } as jwt.SignOptions);
}
