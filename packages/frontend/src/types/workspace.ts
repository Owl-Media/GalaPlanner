import type { ParseResult, PlanWithAnalysis, UserConstraints } from '@gala-planner/shared';

export type WorkspaceStatus = 'draft' | 'completed';
export type WorkspaceView = 'plan' | 'timeline' | 'locos' | 'stations' | 'table';

export interface SavedWorkspace {
  id: string;
  title: string;
  status: WorkspaceStatus;
  createdAt: string;
  updatedAt: string;
  lastOpenedAt: string;
  originalResult: ParseResult;
  editedResult: ParseResult;
  selectedDayId: string | null;
  activeView: WorkspaceView;
  selectedLocoId: string | null;
  constraints: UserConstraints;
  plansWithAnalysis: PlanWithAnalysis[];
  planError: string | null;
}

export const DEFAULT_CONSTRAINTS: UserConstraints = {
  timeWindow: {
    start: '09:00',
    end: '17:00',
  },
  mustSeeLocoIds: [],
  stationPreferences: {
    prefer: [],
    avoid: [],
  },
  breaks: [],
  transferBufferMinutes: 5,
};
