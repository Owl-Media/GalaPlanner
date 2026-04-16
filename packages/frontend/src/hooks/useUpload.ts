import { useState, useCallback } from 'react';
import type { ParseResult } from '@gala-planner/shared';
import { uploadFile } from '../api/client';
import { randomUUID } from '../utils/uuid';

export interface UseUploadState {
  isUploading: boolean;
  error: string | null;
}

export interface UseUploadReturn extends UseUploadState {
  upload: (file: File) => Promise<ParseResult | null>;
  createBlank: () => ParseResult;
  resetError: () => void;
}

export function useUpload(): UseUploadReturn {
  const [state, setState] = useState<UseUploadState>({
    isUploading: false,
    error: null,
  });

  const upload = useCallback(async (file: File) => {
    setState({ isUploading: true, error: null });

    const response = await uploadFile(file);

    if (response.success && response.data) {
      setState({ isUploading: false, error: null });
      return response.data;
    } else {
      setState({
        isUploading: false,
        error: response.error || 'Upload failed',
      });
      return null;
    }
  }, []);

  const createBlank = useCallback(() => {
    return {
      id: randomUUID(),
      fileName: 'New Timetable',
      uploadedAt: new Date().toISOString(),
      services: [],
      stations: [],
      locomotives: [],
      issues: [],
    };
  }, []);

  const resetError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  return { ...state, upload, createBlank, resetError };
}
