import type { ParseResult } from '@gala-planner/shared';
import { randomUUID } from '../utils/uuid';
import type { SavedWorkspace } from '../types/workspace';
import { DEFAULT_CONSTRAINTS } from '../types/workspace';

const DB_NAME = 'gala-planner-workspaces';
const DB_VERSION = 1;
const STORE_NAME = 'workspaces';
const LEGACY_STORAGE_PREFIX = 'gala-planner-edits-';
const LEGACY_MIGRATION_KEY = 'gala-planner-workspace-migration-v1';
export const LAST_ACTIVE_WORKSPACE_KEY = 'gala-planner-last-active-workspace';

function getIndexedDb(): IDBFactory {
  if (!globalThis.indexedDB) {
    throw new Error('IndexedDB is not available in this browser.');
  }

  return globalThis.indexedDB;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = getIndexedDb().open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(request.error ?? new Error('Failed to open workspace database.'));
    };

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => Promise<T> | T
): Promise<T> {
  const database = await openDatabase();
  const transaction = database.transaction(STORE_NAME, mode);
  const store = transaction.objectStore(STORE_NAME);

  const completion = new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error('Workspace transaction failed.'));
    transaction.onerror = () => reject(transaction.error ?? new Error('Workspace transaction failed.'));
  });

  try {
    const result = await Promise.resolve(operation(store));
    await completion;
    return result;
  } catch (error) {
    try {
      transaction.abort();
    } catch {
      // Ignore abort errors when the transaction already completed.
    }
    throw error;
  } finally {
    database.close();
  }
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'));
  });
}

export function createWorkspaceFromParseResult(
  parseResult: ParseResult,
  overrides: Partial<SavedWorkspace> = {}
): SavedWorkspace {
  const timestamp = new Date().toISOString();

  return {
    id: randomUUID(),
    title: parseResult.fileName || 'New Timetable',
    status: 'draft',
    createdAt: overrides.createdAt ?? parseResult.uploadedAt ?? timestamp,
    updatedAt: overrides.updatedAt ?? timestamp,
    lastOpenedAt: overrides.lastOpenedAt ?? timestamp,
    originalResult: parseResult,
    editedResult: parseResult,
    selectedDayId: parseResult.availableDays?.[0]?.id ?? null,
    activeView: 'table',
    selectedLocoId: null,
    constraints: {
      ...DEFAULT_CONSTRAINTS,
      timeWindow: DEFAULT_CONSTRAINTS.timeWindow
        ? { ...DEFAULT_CONSTRAINTS.timeWindow }
        : undefined,
      mustSeeLocoIds: [...DEFAULT_CONSTRAINTS.mustSeeLocoIds],
      stationPreferences: {
        prefer: [...DEFAULT_CONSTRAINTS.stationPreferences.prefer],
        avoid: [...DEFAULT_CONSTRAINTS.stationPreferences.avoid],
      },
      breaks: [...DEFAULT_CONSTRAINTS.breaks],
    },
    plansWithAnalysis: [],
    planError: null,
    ...overrides,
  };
}

export function duplicateWorkspace(workspace: SavedWorkspace): SavedWorkspace {
  const timestamp = new Date().toISOString();

  return {
    ...workspace,
    id: randomUUID(),
    title: `Copy of ${workspace.title}`,
    status: 'draft',
    createdAt: timestamp,
    updatedAt: timestamp,
    lastOpenedAt: timestamp,
  };
}

export async function listWorkspaces(): Promise<SavedWorkspace[]> {
  const workspaces = await withStore('readonly', async (store) => {
    const request = store.getAll();
    return requestToPromise<SavedWorkspace[]>(request);
  });

  return workspaces.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export async function saveWorkspace(workspace: SavedWorkspace): Promise<void> {
  await withStore('readwrite', async (store) => {
    await requestToPromise(store.put(workspace));
  });
}

export async function deleteWorkspace(workspaceId: string): Promise<void> {
  await withStore('readwrite', async (store) => {
    await requestToPromise(store.delete(workspaceId));
  });
}

export function setLastActiveWorkspaceId(workspaceId: string | null): void {
  if (workspaceId) {
    localStorage.setItem(LAST_ACTIVE_WORKSPACE_KEY, workspaceId);
    return;
  }

  localStorage.removeItem(LAST_ACTIVE_WORKSPACE_KEY);
}

export function getLastActiveWorkspaceId(): string | null {
  return localStorage.getItem(LAST_ACTIVE_WORKSPACE_KEY);
}

export async function migrateLegacyEdits(): Promise<number> {
  if (localStorage.getItem(LEGACY_MIGRATION_KEY) === 'done') {
    return 0;
  }

  const legacyKeys = Object.keys(localStorage).filter((key) => key.startsWith(LEGACY_STORAGE_PREFIX));

  if (legacyKeys.length === 0) {
    localStorage.setItem(LEGACY_MIGRATION_KEY, 'done');
    return 0;
  }

  let migratedCount = 0;

  for (const key of legacyKeys) {
    const rawValue = localStorage.getItem(key);

    if (!rawValue) {
      continue;
    }

    try {
      const parseResult = JSON.parse(rawValue) as ParseResult;
      const workspace = createWorkspaceFromParseResult(parseResult, {
        originalResult: parseResult,
        editedResult: parseResult,
      });

      await saveWorkspace(workspace);
      localStorage.removeItem(key);
      migratedCount += 1;
    } catch {
      // Leave unreadable legacy items untouched so the user does not lose data.
    }
  }

  localStorage.setItem(LEGACY_MIGRATION_KEY, 'done');
  return migratedCount;
}
