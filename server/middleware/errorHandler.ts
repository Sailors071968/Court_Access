// ============================================
// Court Access — Error Handler Middleware
// ============================================

import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { logger } from '../utils/loggingUtils.js';

export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;

  constructor(message: string, statusCode: number, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export function errorHandler(
  error: FastifyError,
  _request: FastifyRequest,
  reply: FastifyReply
): void {
  logger.error('Request error', {
    message: error.message,
    statusCode: error.statusCode,
    stack: error.stack,
  });

  if (error instanceof AppError) {
    reply.status(error.statusCode).send({
      error: error.message,
      statusCode: error.statusCode,
    });
    return;
  }

  // Fastify validation errors
  if (error.validation) {
    reply.status(400).send({
      error: 'Validation failed',
      details: error.validation,
      statusCode: 400,
    });
    return;
  }

  // Default 500
  reply.status(500).send({
    error: 'Internal server error',
    statusCode: 500,
  });
}
