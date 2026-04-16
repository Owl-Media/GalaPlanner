import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ParseResult, PlanWithAnalysis } from '@gala-planner/shared';
import App from './App';
import {
  createWorkspaceFromParseResult,
  saveWorkspace,
  setLastActiveWorkspaceId,
} from './services/workspaceStore';
import type { SavedWorkspace } from './types/workspace';

function buildParseResult(): ParseResult {
  return {
    id: 'parse-restore',
    fileName: 'Restored Timetable',
    uploadedAt: '2026-04-16T08:00:00.000Z',
    services: [
      {
        id: 'service-1',
        day: '2026-04-17',
        dayLabel: 'Friday 17 April',
        originStationId: 'pickering',
        destStationId: 'grosmont',
        departTime: '10:00',
        arriveTime: '10:45',
        locomotiveIds: ['loco-1'],
        serviceNotes: [],
        sourceConfidence: 1,
      },
    ],
    stations: [
      { id: 'pickering', name: 'Pickering', aliases: [] },
      { id: 'grosmont', name: 'Grosmont', aliases: [] },
    ],
    locomotives: [
      { id: 'loco-1', name: 'No. 80135', type: 'steam' },
    ],
    issues: [],
    availableDays: [
      { id: '2026-04-16', label: 'Thursday 16 April', serviceCount: 0 },
      { id: '2026-04-17', label: 'Friday 17 April', serviceCount: 1 },
    ],
  };
}

function buildPlan(parseResult: ParseResult): PlanWithAnalysis[] {
  return [
    {
      plan: {
        id: 'plan-1',
        legs: [
          {
            service: parseResult.services[0],
            boardStationId: 'pickering',
            alightStationId: 'grosmont',
            locomotivesSeen: ['loco-1'],
          },
        ],
        uniqueLocosSeen: ['loco-1'],
        score: 100,
        explanations: [],
      },
    },
  ];
}

function buildWorkspace(overrides: Partial<SavedWorkspace> = {}): SavedWorkspace {
  const parseResult = buildParseResult();

  return createWorkspaceFromParseResult(parseResult, {
    title: 'Restored Plan',
    activeView: 'plan',
    selectedDayId: '2026-04-17',
    constraints: {
      timeWindow: {
        start: '10:00',
        end: '16:00',
      },
      mustSeeLocoIds: ['loco-1'],
      stationPreferences: {
        prefer: [],
        avoid: [],
      },
      breaks: [],
      transferBufferMinutes: 7,
      startStationId: 'pickering',
      endStationId: 'grosmont',
    },
    plansWithAnalysis: buildPlan(parseResult),
    ...overrides,
  });
}

describe('App', () => {
  it('creates a blank workspace and keeps it when returning to the library', async () => {
    render(<App />);

    await screen.findByText('Start a new workspace');

    fireEvent.click(screen.getByRole('button', { name: /start from scratch/i }));

    expect(await screen.findByRole('button', { name: /back to library/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /back to library/i }));

    expect(await screen.findByText('Saved plans')).toBeInTheDocument();
    expect(screen.getByDisplayValue('New Timetable')).toBeInTheDocument();
  });

  it('restores the last active workspace with saved planner state and results', async () => {
    const workspace = buildWorkspace();
    await saveWorkspace(workspace);
    setLastActiveWorkspaceId(workspace.id);

    render(<App />);

    expect(await screen.findByDisplayValue('Restored Plan')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Your Plan' })).toBeInTheDocument();
    expect(screen.getByDisplayValue('10:00')).toBeInTheDocument();
    expect(screen.getByDisplayValue('16:00')).toBeInTheDocument();
    expect(screen.getByDisplayValue('7')).toBeInTheDocument();
    expect(screen.getByLabelText('Day:')).toHaveValue('2026-04-17');
    expect(screen.getAllByText('No. 80135').length).toBeGreaterThan(0);
  });

  it('opens completed workspaces from the library without removing them', async () => {
    const workspace = buildWorkspace({ status: 'completed' });
    await saveWorkspace(workspace);

    render(<App />);

    expect(await screen.findByText('Saved plans')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Open' }));

    expect(await screen.findByDisplayValue('Restored Plan')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reopen plan/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /back to library/i }));

    expect(await screen.findByDisplayValue('Restored Plan')).toBeInTheDocument();
  });

  it('migrates legacy localStorage edits into the workspace library', async () => {
    const legacyParseResult = buildParseResult();
    localStorage.setItem(`gala-planner-edits-${legacyParseResult.id}`, JSON.stringify(legacyParseResult));

    render(<App />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Restored Timetable')).toBeInTheDocument();
    });
  });
});
