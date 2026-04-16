import ExcelJS from 'exceljs';
import { randomUUID } from 'crypto';
import type {
  ParseResult,
  ParseIssue,
  Service,
  Station,
  Locomotive,
  LocomotiveType,
} from '@gala-planner/shared';

const COLUMN_MAPPINGS: Record<string, string[]> = {
  train: ['train', 'service', 'train number', 'service number', 'no', 'number'],
  locomotive: ['locomotive', 'loco', 'engine', 'traction'],
  type: ['type', 'traction type', 'loco type'],
  origin: ['origin', 'from', 'departure station', 'dep station', 'start'],
  destination: ['destination', 'to', 'arrival station', 'arr station', 'end'],
  depart: ['depart', 'departure', 'dep', 'departs', 'departure time'],
  arrive: ['arrive', 'arrival', 'arr', 'arrives', 'arrival time'],
  day: ['day', 'date', 'running date'],
  notes: ['notes', 'note', 'remarks', 'comment', 'comments'],
};

type RowData = Record<string, unknown>;

function normalizeColumnName(name: string): string {
  const lower = String(name).toLowerCase().trim();
  for (const [standard, variants] of Object.entries(COLUMN_MAPPINGS)) {
    if (variants.includes(lower)) {
      return standard;
    }
  }
  return lower;
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function parseExcelSerialDate(value: number): string | null {
  const wholeDays = Math.floor(value);
  if (!Number.isFinite(wholeDays) || wholeDays <= 0) {
    return null;
  }

  // Excel stores dates as days since 1899-12-30.
  const epoch = Date.UTC(1899, 11, 30);
  return formatDate(new Date(epoch + wholeDays * 24 * 60 * 60 * 1000));
}

function unwrapCellValue(value: ExcelJS.CellValue | undefined): unknown {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'object') {
    if ('richText' in value) {
      return value.richText.map((part) => part.text).join('');
    }
    if ('text' in value && typeof value.text === 'string') {
      return value.text;
    }
    if ('result' in value) {
      return unwrapCellValue(value.result);
    }
    if ('hyperlink' in value && typeof value.hyperlink === 'string') {
      return value.hyperlink;
    }
  }

  return '';
}

function parseTime(value: unknown): string | null {
  if (value === null || value === undefined) return null;

  if (value instanceof Date) {
    return `${value.getHours().toString().padStart(2, '0')}:${value.getMinutes().toString().padStart(2, '0')}`;
  }

  if (typeof value === 'number') {
    const totalMinutes = Math.round((value % 1) * 24 * 60);
    const hours = Math.floor(totalMinutes / 60) % 24;
    const mins = totalMinutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  }

  const timeStr = String(value).trim();
  if (!timeStr) return null;

  const match = timeStr.match(/^(\d{1,2}):(\d{2})$/);
  if (match) {
    const hours = match[1].padStart(2, '0');
    const mins = match[2];
    return `${hours}:${mins}`;
  }

  const compactMatch = timeStr.match(/^(\d{2})(\d{2})$/);
  if (compactMatch) {
    return `${compactMatch[1]}:${compactMatch[2]}`;
  }

  return null;
}

function parseLocomotiveType(typeStr: string): LocomotiveType {
  const lower = String(typeStr || '').toLowerCase().trim();
  if (lower.includes('steam')) return 'steam';
  if (lower.includes('diesel')) return 'diesel';
  if (lower.includes('electric')) return 'electric';
  return 'other';
}

function generateStationId(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

function generateLocoId(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

function parseDate(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return formatDate(new Date());
  }

  if (value instanceof Date) {
    return formatDate(value);
  }

  if (typeof value === 'number') {
    return parseExcelSerialDate(value) ?? formatDate(new Date());
  }

  const dateStr = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }

  const parsed = new Date(dateStr);
  if (!Number.isNaN(parsed.getTime())) {
    return formatDate(parsed);
  }

  return formatDate(new Date());
}

function extractRows(worksheet: ExcelJS.Worksheet): RowData[] {
  const headerRow = worksheet.getRow(1);
  const rawHeaderValues = Array.isArray(headerRow.values)
    ? (headerRow.values.slice(1) as Array<ExcelJS.CellValue | undefined>)
    : [];
  const headers: string[] = rawHeaderValues.map((value: ExcelJS.CellValue | undefined) =>
    normalizeColumnName(String(unwrapCellValue(value)))
  );

  const rows: RowData[] = [];

  for (let rowIndex = 2; rowIndex <= worksheet.actualRowCount; rowIndex++) {
    const row = worksheet.getRow(rowIndex);
    const normalized: RowData = {};
    let hasContent = false;

    headers.forEach((header: string, columnIndex: number) => {
      if (!header) return;

      const cellValue = unwrapCellValue(row.getCell(columnIndex + 1).value);
      normalized[header] = cellValue;

      if (cellValue !== '' && cellValue !== null && cellValue !== undefined) {
        hasContent = true;
      }
    });

    if (hasContent) {
      rows.push(normalized);
    }
  }

  return rows;
}

export async function parseXlsx(buffer: Buffer, fileName: string): Promise<ParseResult> {
  const issues: ParseIssue[] = [];
  const services: Service[] = [];
  const stationMap = new Map<string, Station>();
  const locoMap = new Map<string, Locomotive>();

  const workbook = new ExcelJS.Workbook();

  try {
    const workbookData = buffer as unknown as Parameters<typeof workbook.xlsx.load>[0];
    await workbook.xlsx.load(workbookData);
  } catch (error) {
    issues.push({
      severity: 'error',
      message: `Failed to read Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`,
      lineage: { fileName },
    });
    return {
      id: randomUUID(),
      fileName,
      uploadedAt: new Date().toISOString(),
      services: [],
      stations: [],
      locomotives: [],
      issues,
    };
  }

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    issues.push({
      severity: 'error',
      message: 'No sheets found in Excel file',
      lineage: { fileName },
    });
    return {
      id: randomUUID(),
      fileName,
      uploadedAt: new Date().toISOString(),
      services: [],
      stations: [],
      locomotives: [],
      issues,
    };
  }

  const data = extractRows(worksheet);
  if (data.length === 0) {
    issues.push({
      severity: 'error',
      message: 'No data rows found in Excel file',
      lineage: { fileName },
    });
    return {
      id: randomUUID(),
      fileName,
      uploadedAt: new Date().toISOString(),
      services: [],
      stations: [],
      locomotives: [],
      issues,
    };
  }

  const headers = Object.keys(data[0] || {});
  const requiredColumns = ['origin', 'destination', 'depart'];
  const missingColumns = requiredColumns.filter((col) => !headers.includes(col));

  if (missingColumns.length > 0) {
    issues.push({
      severity: 'error',
      message: `Missing required columns: ${missingColumns.join(', ')}. Found: ${headers.join(', ')}`,
      lineage: { fileName },
      suggestedFix: 'Ensure Excel has columns for origin, destination, and departure time',
    });
  }

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const rowNum = i + 2;

    const originName = String(row.origin || '').trim();
    const destName = String(row.destination || '').trim();

    if (!originName || !destName) {
      issues.push({
        severity: 'warn',
        message: 'Missing origin or destination station',
        lineage: { fileName, row: rowNum },
      });
      continue;
    }

    const originId = generateStationId(originName);
    const destId = generateStationId(destName);

    if (!stationMap.has(originId)) {
      stationMap.set(originId, { id: originId, name: originName, aliases: [] });
    }
    if (!stationMap.has(destId)) {
      stationMap.set(destId, { id: destId, name: destName, aliases: [] });
    }

    const departTime = parseTime(row.depart);
    const arriveTime = parseTime(row.arrive);

    if (!departTime) {
      issues.push({
        severity: 'warn',
        message: `Invalid departure time: "${row.depart}"`,
        lineage: { fileName, row: rowNum, column: 'depart' },
      });
      continue;
    }

    const locoName = String(row.locomotive || '').trim();
    const locoIds: string[] = [];

    if (locoName) {
      const locoId = generateLocoId(locoName);
      locoIds.push(locoId);

      if (!locoMap.has(locoId)) {
        const locoType = parseLocomotiveType(String(row.type || ''));
        locoMap.set(locoId, { id: locoId, name: locoName, type: locoType });
      }
    }

    const day = parseDate(row.day);

    services.push({
      id: randomUUID(),
      day,
      originStationId: originId,
      destStationId: destId,
      departTime,
      arriveTime: arriveTime || departTime,
      locomotiveIds: locoIds,
      serviceNotes: String(row.notes || '').trim() ? [String(row.notes).trim()] : [],
      sourceConfidence: 1.0,
    });
  }

  if (services.length > 0) {
    issues.push({
      severity: 'info',
      message: `Successfully parsed ${services.length} services, ${stationMap.size} stations, ${locoMap.size} locomotives from sheet "${worksheet.name}"`,
      lineage: { fileName },
    });
  }

  return {
    id: randomUUID(),
    fileName,
    uploadedAt: new Date().toISOString(),
    services,
    stations: Array.from(stationMap.values()),
    locomotives: Array.from(locoMap.values()),
    issues,
  };
}
