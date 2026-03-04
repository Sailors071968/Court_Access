// ============================================
// Court Access — API Hooks
// React hooks for data fetching from real backend
// ============================================

import { useState, useEffect, useCallback } from 'react';
import apiClient from '../services/apiClient';

// ---- Generic fetch hook ----
interface UseApiState<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useApi<T>(url: string | null): UseApiState<T> {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(!!url);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!url) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiClient.get(url);
      setData(res.data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Request failed';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [url]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, isLoading, error, refetch: fetchData };
}

// ---- Cases ----
export interface ApiCase {
  id: string;
  tenantId: string;
  title: string;
  caseNumber: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export function useCases() {
  return useApi<ApiCase[]>('/cases');
}

export function useCase(caseId: string | undefined) {
  return useApi<ApiCase>(caseId ? `/cases/${caseId}` : null);
}

// ---- Documents ----
export interface ApiDocument {
  id: string;
  caseId: string;
  fileName: string;
  fileHashSha256: string;
  fileHashSha3256: string;
  storagePath: string;
  uploadedBy: string | null;
  uploadedAt: string;
  analysisStatus: string;
  extractedText: string | null;
}

export function useDocuments(caseId: string | undefined) {
  return useApi<ApiDocument[]>(caseId ? `/documents/case/${caseId}` : null);
}

export function useDocumentStatus(documentId: string | undefined) {
  const [status, setStatus] = useState<string>('pending');

  useEffect(() => {
    if (!documentId) return;
    let active = true;

    const poll = async () => {
      try {
        const res = await apiClient.get(`/documents/${documentId}/status`);
        if (active) {
          setStatus(res.data.analysisStatus);
          if (res.data.analysisStatus !== 'completed' && res.data.analysisStatus !== 'failed') {
            setTimeout(poll, 3000);
          }
        }
      } catch {
        // stop polling on error
      }
    };

    poll();
    return () => { active = false; };
  }, [documentId]);

  return status;
}

// ---- Dashboard Metrics ----
export interface DashboardMetrics {
  cases_total: number;
  documents_total: number;
  documents_processing: number;
  analysis_completed_today: number;
}

export function useDashboardMetrics() {
  return useApi<DashboardMetrics>('/analytics/dashboard');
}

// ---- Document Upload ----
export function useDocumentUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = async (caseId: string, file: File) => {
    setIsUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await apiClient.post(`/documents/case/${caseId}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res.data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed';
      setError(message);
      throw err;
    } finally {
      setIsUploading(false);
    }
  };

  return { upload, isUploading, error };
}

// ---- User Preferences ----
export interface UserPreferences {
  id: string;
  email: string;
  name: string;
  role: string;
  phone: string | null;
  smsEnabled: boolean;
}

export function useUserPreferences() {
  const state = useApi<UserPreferences>('/auth/me');

  const updatePreferences = async (data: { name?: string; phone?: string; smsEnabled?: boolean }) => {
    const res = await apiClient.patch('/users/me', data);
    state.refetch();
    return res.data;
  };

  return { ...state, updatePreferences };
}

// ---- Case Creation ----
export async function createCase(data: { title: string; caseNumber?: string }) {
  const res = await apiClient.post('/cases', data);
  return res.data;
}
