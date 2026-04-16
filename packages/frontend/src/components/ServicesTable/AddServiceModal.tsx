import { useEffect, useState } from 'react';
import type { Service, Station, Locomotive } from '@gala-planner/shared';
import './AddServiceModal.css';

interface AddServiceModalProps {
  stations: Station[];
  locomotives: Locomotive[];
  allTimes: string[];
  selectedDayId?: string;
  onAddTimeOption?: (time: string) => void;
  onNavigateToStations?: () => void;
  onAdd: (service: Omit<Service, 'id' | 'sourceConfidence' | 'isUserEdited'>) => void;
  onCancel: () => void;
}

function normalizeTime(input: string): string | null {
  const trimmed = input.trim();
  const match = trimmed.match(/^(\d{1,2}):?(\d{2})$/);
  if (!match) return null;

  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function AddServiceModal({
  stations,
  locomotives,
  allTimes,
  selectedDayId,
  onAddTimeOption,
  onNavigateToStations,
  onAdd,
  onCancel,
}: AddServiceModalProps) {
  const [departTime, setDepartTime] = useState(allTimes[0] || '');
  const [arriveTime, setArriveTime] = useState(allTimes[1] || allTimes[0] || '');
  const [originStationId, setOriginStationId] = useState(stations[0]?.id || '');
  const [destStationId, setDestStationId] = useState(stations[stations.length - 1]?.id || '');
  const [locomotiveId, setLocomotiveId] = useState(locomotives[0]?.id || '');
  const [notes, setNotes] = useState('');
  const [newTime, setNewTime] = useState('');

  const hasStations = stations.length > 0;
  const hasTimes = allTimes.length > 0;
  const canSubmit = hasStations
    && hasTimes
    && departTime.length > 0
    && arriveTime.length > 0
    && originStationId.length > 0
    && destStationId.length > 0;

  useEffect(() => {
    if (!departTime && allTimes[0]) {
      setDepartTime(allTimes[0]);
    }
  }, [allTimes, departTime]);

  useEffect(() => {
    if (!arriveTime) {
      const fallback = allTimes[1] || allTimes[0] || '';
      if (fallback) {
        setArriveTime(fallback);
      }
    }
  }, [allTimes, arriveTime]);

  useEffect(() => {
    if (!originStationId && stations[0]?.id) {
      setOriginStationId(stations[0].id);
    }
  }, [stations, originStationId]);

  useEffect(() => {
    const fallback = stations[stations.length - 1]?.id;
    if (!destStationId && fallback) {
      setDestStationId(fallback);
    }
  }, [stations, destStationId]);

  const handleAddTimeOption = () => {
    const normalized = normalizeTime(newTime);

    if (!normalized) {
      window.alert('Invalid time format. Please use HH:MM (e.g., 12:43).');
      return;
    }

    onAddTimeOption?.(normalized);
    setDepartTime((current) => current || normalized);
    setArriveTime((current) => current || normalized);
    setNewTime('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    const newService: Omit<Service, 'id' | 'sourceConfidence' | 'isUserEdited'> = {
      day: selectedDayId || new Date().toISOString().split('T')[0],
      departTime,
      arriveTime,
      originStationId,
      destStationId,
      locomotiveIds: locomotiveId ? [locomotiveId] : [],
      serviceNotes: notes
        .split(';')
        .map((n) => n.trim())
        .filter((n) => n.length > 0),
    };

    onAdd(newService);
  };

  return (
    <div className="add-service-modal__overlay" onClick={onCancel}>
      <div className="add-service-modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="add-service-modal__title">Add New Service</h3>
        <form onSubmit={handleSubmit} className="add-service-modal__form">
          <div className="add-service-modal__row">
            <div className="add-service-modal__field">
              <label htmlFor="depart-time">Departure Time</label>
              <select
                id="depart-time"
                value={departTime}
                onChange={(e) => setDepartTime(e.target.value)}
                required
                disabled={!hasTimes}
              >
                <option value="" disabled>
                  {hasTimes ? 'Select departure time' : 'Add a time below first'}
                </option>
                {allTimes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="add-service-modal__field">
              <label htmlFor="arrive-time">Arrival Time</label>
              <select
                id="arrive-time"
                value={arriveTime}
                onChange={(e) => setArriveTime(e.target.value)}
                required
                disabled={!hasTimes}
              >
                <option value="" disabled>
                  {hasTimes ? 'Select arrival time' : 'Add a time below first'}
                </option>
                {allTimes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="add-service-modal__field">
            <label htmlFor="custom-time">Add Time Option</label>
            <div className="add-service-modal__inline-action">
              <input
                id="custom-time"
                type="text"
                inputMode="numeric"
                value={newTime}
                onChange={(e) => setNewTime(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTimeOption();
                  }
                }}
                placeholder="HH:MM"
              />
              <button
                type="button"
                className="add-service-modal__secondary-btn"
                onClick={handleAddTimeOption}
              >
                Add time
              </button>
            </div>
            <p className="add-service-modal__hint">
              Added times appear in both dropdowns for manual plans.
            </p>
          </div>

          {hasStations ? (
            <div className="add-service-modal__row">
              <div className="add-service-modal__field">
                <label htmlFor="origin-station">From Station</label>
                <select
                  id="origin-station"
                  value={originStationId}
                  onChange={(e) => setOriginStationId(e.target.value)}
                  required
                >
                  {stations.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="add-service-modal__field">
                <label htmlFor="dest-station">To Station</label>
                <select
                  id="dest-station"
                  value={destStationId}
                  onChange={(e) => setDestStationId(e.target.value)}
                  required
                >
                  {stations.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : (
            <div className="add-service-modal__callout" role="note">
              <p className="add-service-modal__callout-text">
                Add stations first so you can choose where this service starts and finishes.
              </p>
              {onNavigateToStations && (
                <button
                  type="button"
                  className="add-service-modal__link-btn"
                  onClick={onNavigateToStations}
                >
                  Go to Add Stations
                </button>
              )}
            </div>
          )}

          <div className="add-service-modal__field">
            <label htmlFor="locomotive">Locomotive</label>
            <select
              id="locomotive"
              value={locomotiveId}
              onChange={(e) => setLocomotiveId(e.target.value)}
            >
              <option value="">No locomotive assigned</option>
              {locomotives.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} ({l.type})
                </option>
              ))}
            </select>
          </div>

          <div className="add-service-modal__field">
            <label htmlFor="notes">Notes (separate with semicolons)</label>
            <input
              id="notes"
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., Special service; Bank holiday extra"
            />
          </div>

          <div className="add-service-modal__actions">
            <button type="button" onClick={onCancel} className="add-service-modal__cancel-btn">
              Cancel
            </button>
            <button type="submit" className="add-service-modal__add-btn" disabled={!canSubmit}>
              Add Service
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
