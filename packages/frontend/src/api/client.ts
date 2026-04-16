import type { UploadResponse, PlanRequest, PlanResponse } from '@gala-planner/shared';

function normalizeBaseUrl(value: string | undefined): string {
  if (!value || value === '/') {
    return '';
  }

  return value.endsWith('/') ? value.slice(0, -1) : value;
}

const runtimeBasePath =
  typeof window !== 'undefined' ? (window.__APP_BASE_PATH__ ?? import.meta.env.BASE_URL) : import.meta.env.BASE_URL;

const API_BASE = normalizeBaseUrl(import.meta.env.VITE_API_URL || runtimeBasePath);

export async function uploadFile(file: File): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await fetch(`${API_BASE}/api/upload`, {
      method: 'POST',
      body: formData,
    });

    const data = await response.json();
    return data;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Upload failed',
    };
  }
}

export async function generatePlan(request: PlanRequest): Promise<PlanResponse> {
  try {
    const response = await fetch(`${API_BASE}/api/plan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Plan generation failed',
    };
  }
}
