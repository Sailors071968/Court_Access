// ============================================
// Court Access — Provider Manager (CRUD Operations)
// Manages API provider lifecycle: add, update, enable/disable, list, delete.
// ============================================

import { PrismaClient } from '@prisma/client';
import { encrypt, decrypt, maskApiKey } from './credentialEncryption.js';
import type {
  AddProviderRequest,
  UpdateProviderRequest,
  AddCredentialRequest,
  ProviderSummary,
  CredentialSummary,
  ProviderType,
} from './types.js';

// ---------------------------------------------------------------------------
// Provider Manager
// ---------------------------------------------------------------------------

export class ProviderManager {
  constructor(private readonly prisma: PrismaClient) {}

  // -------------------------------------------------------------------------
  // Provider CRUD
  // -------------------------------------------------------------------------

  /**
   * Add a new API provider to the registry.
   */
  async addProvider(request: AddProviderRequest): Promise<ProviderSummary> {
    const provider = await this.prisma.apiProvider.create({
      data: {
        name: request.name,
        providerType: request.providerType,
        baseUrl: request.baseUrl,
        documentationUrl: request.documentationUrl ?? null,
      },
      include: { _count: { select: { credentials: true } } },
    });

    return this.toProviderSummary(provider);
  }

  /**
   * Update an existing provider.
   */
  async updateProvider(id: string, request: UpdateProviderRequest): Promise<ProviderSummary> {
    const data: Record<string, unknown> = {};
    if (request.enabled !== undefined) data.enabled = request.enabled;
    if (request.baseUrl !== undefined) data.baseUrl = request.baseUrl;
    if (request.documentationUrl !== undefined) data.documentationUrl = request.documentationUrl;

    const provider = await this.prisma.apiProvider.update({
      where: { id },
      data,
      include: { _count: { select: { credentials: true } } },
    });

    return this.toProviderSummary(provider);
  }

  /**
   * Enable or disable a provider.
   */
  async setEnabled(id: string, enabled: boolean): Promise<ProviderSummary> {
    return this.updateProvider(id, { enabled });
  }

  /**
   * List all providers with credential counts.
   */
  async listProviders(): Promise<ProviderSummary[]> {
    const providers = await this.prisma.apiProvider.findMany({
      include: { _count: { select: { credentials: true } } },
      orderBy: { name: 'asc' },
    });

    return providers.map((p) => this.toProviderSummary(p));
  }

  /**
   * Get a single provider by ID.
   */
  async getProvider(id: string): Promise<ProviderSummary | null> {
    const provider = await this.prisma.apiProvider.findUnique({
      where: { id },
      include: { _count: { select: { credentials: true } } },
    });

    return provider ? this.toProviderSummary(provider) : null;
  }

  /**
   * Get a provider by name.
   */
  async getProviderByName(name: string): Promise<ProviderSummary | null> {
    const provider = await this.prisma.apiProvider.findUnique({
      where: { name },
      include: { _count: { select: { credentials: true } } },
    });

    return provider ? this.toProviderSummary(provider) : null;
  }

  /**
   * Delete a provider and all associated credentials/logs.
   */
  async deleteProvider(id: string): Promise<void> {
    await this.prisma.apiProvider.delete({ where: { id } });
  }

  // -------------------------------------------------------------------------
  // Credential CRUD
  // -------------------------------------------------------------------------

  /**
   * Add an encrypted credential for a provider.
   */
  async addCredential(providerId: string, request: AddCredentialRequest): Promise<CredentialSummary> {
    const encryptedKey = encrypt(request.apiKey);

    const credential = await this.prisma.apiCredential.create({
      data: {
        providerId,
        apiKeyEncrypted: encryptedKey,
        environment: request.environment ?? 'production',
        rateLimitPerMinute: request.rateLimitPerMinute ?? 60,
      },
    });

    return this.toCredentialSummary(credential, request.apiKey);
  }

  /**
   * Rotate (replace) a credential's API key.
   * Deactivates the old credential and creates a new one.
   */
  async rotateCredential(providerId: string, credentialId: string, newApiKey: string): Promise<CredentialSummary> {
    return this.prisma.$transaction(async (tx) => {
      // Deactivate the old credential, scoped to the correct provider
      const oldCred = await tx.apiCredential.update({
        where: { id: credentialId, providerId },
        data: { isActive: false },
      });

      // Create the new credential with the same config
      const encryptedKey = encrypt(newApiKey);
      const newCred = await tx.apiCredential.create({
        data: {
          providerId,
          apiKeyEncrypted: encryptedKey,
          environment: oldCred.environment,
          rateLimitPerMinute: oldCred.rateLimitPerMinute,
        },
      });

      return this.toCredentialSummary(newCred, newApiKey);
    });
  }

  /**
   * List credentials for a provider (masked keys).
   */
  async listCredentials(providerId: string): Promise<CredentialSummary[]> {
    const credentials = await this.prisma.apiCredential.findMany({
      where: { providerId },
      orderBy: { createdAt: 'desc' },
    });

    return credentials.map((c) => {
      const decryptedKey = decrypt(c.apiKeyEncrypted);
      return this.toCredentialSummary(c, decryptedKey);
    });
  }

  /**
   * Resolve the active credential for a provider (returns decrypted key).
   */
  async resolveActiveCredential(providerId: string): Promise<{ apiKey: string; rateLimitPerMinute: number } | null> {
    const credential = await this.prisma.apiCredential.findFirst({
      where: { providerId, isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!credential) return null;

    const apiKey = decrypt(credential.apiKeyEncrypted);
    return { apiKey, rateLimitPerMinute: credential.rateLimitPerMinute };
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private toProviderSummary(
    provider: {
      id: string;
      name: string;
      providerType: string;
      baseUrl: string;
      documentationUrl: string | null;
      enabled: boolean;
      healthStatus: string;
      lastHealthCheck: Date | null;
      createdAt: Date;
      updatedAt: Date;
      _count: { credentials: number };
    },
  ): ProviderSummary {
    return {
      id: provider.id,
      name: provider.name,
      providerType: provider.providerType as ProviderType,
      baseUrl: provider.baseUrl,
      documentationUrl: provider.documentationUrl,
      enabled: provider.enabled,
      healthStatus: provider.healthStatus as ProviderSummary['healthStatus'],
      lastHealthCheck: provider.lastHealthCheck?.toISOString() ?? null,
      credentialCount: provider._count.credentials,
      createdAt: provider.createdAt.toISOString(),
      updatedAt: provider.updatedAt.toISOString(),
    };
  }

  private toCredentialSummary(
    credential: {
      id: string;
      providerId: string;
      environment: string;
      rateLimitPerMinute: number;
      lastValidatedAt: Date | null;
      isActive: boolean;
      createdAt: Date;
    },
    plainKey: string,
  ): CredentialSummary {
    return {
      id: credential.id,
      providerId: credential.providerId,
      environment: credential.environment,
      rateLimitPerMinute: credential.rateLimitPerMinute,
      lastValidatedAt: credential.lastValidatedAt?.toISOString() ?? null,
      isActive: credential.isActive,
      maskedKey: maskApiKey(plainKey),
      createdAt: credential.createdAt.toISOString(),
    };
  }
}
