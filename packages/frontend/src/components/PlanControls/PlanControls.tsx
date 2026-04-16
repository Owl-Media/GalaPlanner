import { useCallback } from 'react';
import type { UserConstraints, Locomotive, Station, BreakPeriod } from '@gala-planner/shared';
import './PlanControls.css';

interface PlanControlsProps {
  locomotives: Locomotive[];
  stations: Station[];
  constraints: UserConstraints;
  onConstraintsChange: (constraints: UserConstraints) => void;
  onGeneratePlan: (constraints: UserConstraints) => void;
  isGenerating: boolean;
}

export function PlanControls({
  locomotives,
  stations,
  constraints,
  onConstraintsChange,
  onGeneratePlan,
  isGenerating,
}: PlanControlsProps) {
  const handleLocoToggle = useCallback((locoId: string) => {
    const nextMustSeeLocos = constraints.mustSeeLocoIds.includes(locoId)
      ? constraints.mustSeeLocoIds.filter((id) => id !== locoId)
      : [...constraints.mustSeeLocoIds, locoId];

    onConstraintsChange({
      ...constraints,
      mustSeeLocoIds: nextMustSeeLocos,
    });
  }, [constraints, onConstraintsChange]);

  const handleAddBreak = useCallback(() => {
    onConstraintsChange({
      ...constraints,
      breaks: [...constraints.breaks, { start: '12:00', durationMinutes: 60 }],
    });
  }, [constraints, onConstraintsChange]);

  const handleRemoveBreak = useCallback((index: number) => {
    onConstraintsChange({
      ...constraints,
      breaks: constraints.breaks.filter((_, i) => i !== index),
    });
  }, [constraints, onConstraintsChange]);

  const handleBreakChange = useCallback(
    (index: number, field: keyof BreakPeriod, value: string | number | undefined) => {
      onConstraintsChange({
        ...constraints,
        breaks: constraints.breaks.map((bp, i) => {
          if (i !== index) return bp;
          if (field === 'preferredStationId' && value === '') {
            const rest = { ...bp };
            delete rest.preferredStationId;
            return rest;
          }
          return { ...bp, [field]: value };
        }),
      });
    },
    [constraints, onConstraintsChange]
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      onGeneratePlan(constraints);
    },
    [constraints, onGeneratePlan]
  );

  return (
    <form className="plan-controls" onSubmit={handleSubmit}>
      <h3 className="plan-controls__title">Plan Your Day</h3>

      {stations.length > 0 && (
        <div className="plan-controls__section">
          <div className="plan-controls__station-selects">
            <div className="plan-controls__station-select">
              <label className="plan-controls__label">Start Station</label>
              <select
                value={constraints.startStationId || ''}
                onChange={(e) => onConstraintsChange({
                  ...constraints,
                  startStationId: e.target.value || undefined,
                })}
                className="plan-controls__input plan-controls__input--full"
              >
                <option value="">Any</option>
                {stations.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div className="plan-controls__station-select">
              <label className="plan-controls__label">End Station</label>
              <select
                value={constraints.endStationId || ''}
                onChange={(e) => onConstraintsChange({
                  ...constraints,
                  endStationId: e.target.value || undefined,
                })}
                className="plan-controls__input plan-controls__input--full"
              >
                <option value="">Any</option>
                {stations.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      <div className="plan-controls__section">
        <label className="plan-controls__label">Time Window</label>
        <div className="plan-controls__time-inputs">
          <input
            type="time"
            value={constraints.timeWindow?.start || '09:00'}
            onChange={(e) => onConstraintsChange({
              ...constraints,
              timeWindow: {
                start: e.target.value,
                end: constraints.timeWindow?.end || '17:00',
              },
            })}
            className="plan-controls__input"
          />
          <span className="plan-controls__separator">to</span>
          <input
            type="time"
            value={constraints.timeWindow?.end || '17:00'}
            onChange={(e) => onConstraintsChange({
              ...constraints,
              timeWindow: {
                start: constraints.timeWindow?.start || '09:00',
                end: e.target.value,
              },
            })}
            className="plan-controls__input"
          />
        </div>
      </div>

      <div className="plan-controls__section">
        <label className="plan-controls__label">Transfer Buffer</label>
        <div className="plan-controls__buffer">
          <input
            type="number"
            min="0"
            max="60"
            value={constraints.transferBufferMinutes}
            onChange={(e) => onConstraintsChange({
              ...constraints,
              transferBufferMinutes: Number(e.target.value),
            })}
            className="plan-controls__input plan-controls__input--small"
          />
          <span className="plan-controls__unit">minutes between trains</span>
        </div>
      </div>

      <div className="plan-controls__section">
        <label className="plan-controls__label">
          Breaks
          {constraints.breaks.length > 0 && (
            <span className="plan-controls__count">({constraints.breaks.length})</span>
          )}
        </label>
        <div className="plan-controls__breaks">
          {constraints.breaks.map((bp, index) => (
            <div key={index} className="plan-controls__break-row">
              <div className="plan-controls__break-inputs">
                <input
                  type="time"
                  value={bp.start}
                  onChange={(e) => handleBreakChange(index, 'start', e.target.value)}
                  className="plan-controls__input"
                />
                <input
                  type="number"
                  min="5"
                  max="240"
                  value={bp.durationMinutes}
                  onChange={(e) => handleBreakChange(index, 'durationMinutes', Number(e.target.value))}
                  className="plan-controls__input plan-controls__input--small"
                />
                <span className="plan-controls__unit">mins</span>
                <input
                  type="text"
                  value={bp.label || ''}
                  onChange={(e) => handleBreakChange(index, 'label', e.target.value || undefined)}
                  placeholder="e.g. Lunch"
                  className="plan-controls__input plan-controls__input--label"
                />
                <button
                  type="button"
                  className="plan-controls__break-remove"
                  onClick={() => handleRemoveBreak(index)}
                  aria-label="Remove break"
                >
                  &times;
                </button>
              </div>
              {stations.length > 0 && (
                <div className="plan-controls__break-station">
                  <span className="plan-controls__unit">Station:</span>
                  <select
                    value={bp.preferredStationId || ''}
                    onChange={(e) => handleBreakChange(index, 'preferredStationId', e.target.value)}
                    className="plan-controls__input plan-controls__input--select"
                  >
                    <option value="">Any</option>
                    {stations.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          ))}
          <button
            type="button"
            className="plan-controls__break-add"
            onClick={handleAddBreak}
          >
            + Add break
          </button>
        </div>
      </div>

      {locomotives.length > 0 && (
        <div className="plan-controls__section">
          <label className="plan-controls__label">
            Must-See Locomotives
            {constraints.mustSeeLocoIds.length > 0 && (
              <span className="plan-controls__count">({constraints.mustSeeLocoIds.length} selected)</span>
            )}
          </label>
          <div className="plan-controls__locos">
            {locomotives.map((loco) => (
              <label key={loco.id} className="plan-controls__loco">
                <input
                  type="checkbox"
                  checked={constraints.mustSeeLocoIds.includes(loco.id)}
                  onChange={() => handleLocoToggle(loco.id)}
                  className="plan-controls__checkbox"
                />
                <span className="plan-controls__loco-name">{loco.name}</span>
                <span className="plan-controls__loco-type">({loco.type})</span>
              </label>
            ))}
          </div>
        </div>
      )}

      <button
        type="submit"
        className="plan-controls__submit"
        disabled={isGenerating}
      >
        {isGenerating ? 'Generating...' : 'Generate Plan'}
      </button>
    </form>
  );
}
