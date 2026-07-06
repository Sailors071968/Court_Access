// ============================================================================
// Domain C — Client validation constants
// ============================================================================

export const CLIENT_STATUSES = ['prospect', 'intake', 'active', 'inactive', 'closed'] as const;
export const RETENTION_STATUSES = ['pending', 'retained', 'declined'] as const;
export const COMMUNICATION_PREFERENCES = ['email', 'phone', 'sms', 'mail'] as const;

export type ClientStatus = (typeof CLIENT_STATUSES)[number];
export type RetentionStatus = (typeof RETENTION_STATUSES)[number];

export interface ContactEntry {
  name: string;
  relationship?: string;
  phone?: string;
  email?: string;
}

export interface AddressEntry {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  zip: string;
  country?: string;
  from?: string;
  to?: string;
}

export interface CreateClientBody {
  firstName: string;
  lastName: string;
  middleName?: string;
  dateOfBirth?: string;
  status?: string;
  email?: string;
  phone?: string;
  phoneAlt?: string;
  alternateContacts?: ContactEntry[];
  emergencyContacts?: ContactEntry[];
  addressHistory?: AddressEntry[];
  communicationPreference?: string;
  language?: string;
  notes?: string;
  intakeDate?: string;
  retentionStatus?: string;
}

export interface UpdateClientBody extends Partial<CreateClientBody> {
  retainedAt?: string;
}

export function validateClientStatus(status: string): boolean {
  return CLIENT_STATUSES.includes(status as ClientStatus);
}

export function validateRetentionStatus(status: string): boolean {
  return RETENTION_STATUSES.includes(status as RetentionStatus);
}

export function validateCommunicationPreference(pref: string): boolean {
  return COMMUNICATION_PREFERENCES.includes(pref as (typeof COMMUNICATION_PREFERENCES)[number]);
}

export function formatClientName(client: { firstName: string; lastName: string; middleName?: string | null }): string {
  return [client.firstName, client.middleName, client.lastName].filter(Boolean).join(' ');
}
