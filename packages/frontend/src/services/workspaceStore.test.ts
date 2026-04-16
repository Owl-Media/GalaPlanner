import { describe, expect, it } from 'vitest';
import type { ParseResult } from '@gala-planner/shared';
import {
  createWorkspaceFromParseResult,
  deleteWorkspace,
  duplicateWorkspace,
  listWorkspaces,
  migrateLegacyEdits,
  saveWorkspace,
} from './workspaceStore';

function buildParseResult(overrides: Partial<ParseResult> = {}): ParseResult {
  return {
    id: 'parse-1',
    fileName: 'Spring Gala.csv',
    uploadedAt: '2026-04-16T08:00:00.000Z',
    services: [],
    stations: [],
    locomotives: [],
    issues: [],
    ...overrides,
  };
}

describe('workspaceStore', () => {
  it('creates and lists saved workspaces', async () => {
    const workspace = createWorkspaceFromParseResult(buildParseResult());

    await saveWorkspace(workspace);

    await expect(listWorkspaces()).resolves.toEqual([workspace]);
  });

  it('deletes saved workspaces', async () => {
    const workspace = createWorkspaceFromParseResult(buildParseResult());

    await saveWorkspace(workspace);
    await deleteWorkspace(workspace.id);

    await expect(listWorkspaces()).resolves.toEqual([]);
  });

  it('duplicates a workspace as a new draft copy', () => {
    const original = createWorkspaceFromParseResult(buildParseResult());
    const duplicate = duplicateWorkspace(original);

    expect(duplicate.id).not.toBe(original.id);
    expect(duplicate.title).toBe(`Copy of ${original.title}`);
    expect(duplicate.status).toBe('draft');
    expect(duplicate.originalResult).toEqual(original.originalResult);
    expect(duplicate.editedResult).toEqual(original.editedResult);
  });

  it('migrates legacy localStorage edits into saved workspaces', async () => {
    const parseResult = buildParseResult({
      id: 'legacy-parse',
      fileName: 'Legacy Timetable',
      services: [
        {
          id: 'service-1',
          day: '2026-04-16',
          originStationId: 'pickering',
          destStationId: 'grosmont',
          departTime: '09:00',
          arriveTime: '09:45',
          locomotiveIds: [],
          serviceNotes: [],
          sourceConfidence: 1,
        },
      ],
    });

    localStorage.setItem(`gala-planner-edits-${parseResult.id}`, JSON.stringify(parseResult));

    await expect(migrateLegacyEdits()).resolves.toBe(1);

    const migrated = await listWorkspaces();
    expect(migrated).toHaveLength(1);
    expect(migrated[0].title).toBe('Legacy Timetable');
    expect(migrated[0].editedResult.services).toHaveLength(1);
    expect(localStorage.getItem(`gala-planner-edits-${parseResult.id}`)).toBeNull();
  });
});
