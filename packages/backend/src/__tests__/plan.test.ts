import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { ParseResult, PlanRequest } from '@gala-planner/shared';
import { buildApp } from '../app';
import { storage } from '../services/storage';

function buildParseResult(id: string): ParseResult {
  return {
    id,
    fileName: 'planner.csv',
    uploadedAt: '2026-04-16T08:00:00.000Z',
    services: [
      {
        id: 'service-1',
        day: '2026-04-16',
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
  };
}

function buildPlanRequest(overrides: Partial<PlanRequest> = {}): PlanRequest {
  return {
    constraints: {
      timeWindow: { start: '09:00', end: '17:00' },
      mustSeeLocoIds: [],
      stationPreferences: { prefer: [], avoid: [] },
      breaks: [],
      transferBufferMinutes: 5,
    },
    includeExplanations: true,
    maxPlans: 5,
    ...overrides,
  };
}

describe('Plan API', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildApp();
    await app.ready();
    storage.clear();
  });

  afterEach(async () => {
    await app.close();
  });

  it('generates plans from an inline parse result', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/plan',
      payload: buildPlanRequest({
        parseResult: buildParseResult('inline-1'),
      }),
    });

    expect(response.statusCode).toBe(200);

    const payload = response.json();
    expect(payload.success).toBe(true);
    expect(payload.plans).toHaveLength(1);
    expect(payload.plansWithAnalysis).toHaveLength(1);
    expect(payload.plans[0].legs[0].service.id).toBe('service-1');
  });

  it('still generates plans from a stored parseResultId', async () => {
    const parseResult = buildParseResult('stored-1');
    storage.storeParseResult(parseResult);

    const response = await app.inject({
      method: 'POST',
      url: '/api/plan',
      payload: buildPlanRequest({
        parseResultId: parseResult.id,
      }),
    });

    expect(response.statusCode).toBe(200);

    const payload = response.json();
    expect(payload.success).toBe(true);
    expect(payload.plans).toHaveLength(1);
    expect(payload.plans[0].uniqueLocosSeen).toContain('loco-1');
  });

  it('rejects plan requests without parseResultId or inline parseResult', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/plan',
      payload: buildPlanRequest(),
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      success: false,
      error: 'parseResultId or parseResult is required',
    });
  });
});
