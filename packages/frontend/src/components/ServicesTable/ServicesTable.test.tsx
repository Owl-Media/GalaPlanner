import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { ServicesTable } from './ServicesTable';
import type { Station } from '@gala-planner/shared';

const stations: Station[] = [
  { id: 'pickering', name: 'Pickering', aliases: [] },
  { id: 'grosmont', name: 'Grosmont', aliases: [] },
];

describe('ServicesTable', () => {
  it('routes users to stations setup when none exist', () => {
    const onNavigateToStations = vi.fn();

    render(
      <ServicesTable
        services={[]}
        stations={[]}
        locomotives={[]}
        allTimes={[]}
        onNavigateToStations={onNavigateToStations}
        onServiceUpdate={vi.fn()}
        onServiceAdd={vi.fn(() => 'service-1')}
        onServiceDelete={vi.fn()}
        onServiceRestore={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /\+ add service/i }));

    expect(
      screen.getByText(/add stations first so you can choose where this service starts and finishes/i)
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /go to add stations/i }));

    expect(onNavigateToStations).toHaveBeenCalledTimes(1);
  });

  it('allows custom times to be added before creating a manual service', () => {
    const onServiceAdd = vi.fn(() => 'service-1');

    render(
      <ServicesTable
        services={[]}
        stations={stations}
        locomotives={[]}
        allTimes={[]}
        selectedDayId="2026-04-16"
        onServiceUpdate={vi.fn()}
        onServiceAdd={onServiceAdd}
        onServiceDelete={vi.fn()}
        onServiceRestore={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /\+ add service/i }));

    const departSelect = screen.getByLabelText(/departure time/i) as HTMLSelectElement;
    const arriveSelect = screen.getByLabelText(/arrival time/i) as HTMLSelectElement;
    expect(departSelect).toBeDisabled();
    expect(arriveSelect).toBeDisabled();

    const customTimeInput = screen.getByLabelText(/add time option/i);

    fireEvent.change(customTimeInput, { target: { value: '0900' } });
    fireEvent.click(screen.getByRole('button', { name: /add time/i }));

    expect(departSelect).not.toBeDisabled();
    expect(arriveSelect).not.toBeDisabled();
    expect(departSelect.value).toBe('09:00');

    fireEvent.change(customTimeInput, { target: { value: '0930' } });
    fireEvent.click(screen.getByRole('button', { name: /add time/i }));
    fireEvent.change(arriveSelect, { target: { value: '09:30' } });

    const modal = screen.getByRole('heading', { name: /add new service/i }).closest('.add-service-modal');
    expect(modal).toBeTruthy();

    fireEvent.click(within(modal as HTMLElement).getByRole('button', { name: /^add service$/i }));

    expect(onServiceAdd).toHaveBeenCalledWith({
      day: '2026-04-16',
      departTime: '09:00',
      arriveTime: '09:30',
      originStationId: 'pickering',
      destStationId: 'grosmont',
      locomotiveIds: [],
      serviceNotes: [],
    });
  });
});
