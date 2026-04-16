import { randomUUID } from 'crypto';
import type { ParseResult } from '@gala-planner/shared';
import { parseCsv } from './csv-parser.js';
import { parseXlsx } from './xlsx-parser.js';
import { parsePdf } from './pdf-parser.js';

export type SupportedMimeType =
  | 'text/csv'
  | 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  | 'application/pdf';

/**
 * Parse a file and return the structured result.
 */
export async function parseFile(
  buffer: Buffer,
  fileName: string,
  mimeType: string
): Promise<ParseResult> {
  if (mimeType === 'application/pdf') {
    return parsePdf(buffer, fileName);
  }

  if (mimeType === 'text/csv') {
    return parseCsv(buffer, fileName);
  }

  if (mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
    return parseXlsx(buffer, fileName);
  }

  return {
    id: randomUUID(),
    fileName,
    uploadedAt: new Date().toISOString(),
    services: [],
    stations: [],
    locomotives: [],
    issues: [
      {
        severity: 'error',
        message: `Unsupported file type: ${mimeType}`,
        lineage: { fileName },
      },
    ],
  };
}

export { parseCsv } from './csv-parser.js';
export { parseXlsx } from './xlsx-parser.js';
export { parsePdf } from './pdf-parser.js';
