// @vitest-environment jsdom
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import OpenEo from '../../../components/system/OpenEo';

const retryPendingPwaFileOpenRequestMock = vi.fn();

vi.mock('../../../utils/pwaLaunchQueue', () => ({
  retryPendingPwaFileOpenRequest: () => retryPendingPwaFileOpenRequestMock(),
}));

describe('OpenEo', () => {
  beforeEach(() => {
    retryPendingPwaFileOpenRequestMock.mockReset();
  });

  it('viser først fallback-indhold efter 1 sekund', () => {
    vi.useFakeTimers();

    render(
      <MemoryRouter>
        <OpenEo />
      </MemoryRouter>
    );

    expect(screen.queryByText('Indlæsning af fil blev afbrudt')).toBeNull();

    act(() => {
      vi.advanceTimersByTime(999);
    });
    expect(screen.queryByText('Indlæsning af fil blev afbrudt')).toBeNull();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.getByText('Indlæsning af fil blev afbrudt')).toBeInTheDocument();
    expect(screen.getByText('Programmet har fået en opdatering og kunne derfor ikke gennemføre indlæsningen af filen.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Færdiggør indlæsningen' })).toBeInTheDocument();
  });

  it('retry-knappen forsøger at genoptage indlæsningen af samme fil', async () => {
    vi.useFakeTimers();
    retryPendingPwaFileOpenRequestMock.mockResolvedValue(true);

    render(
      <MemoryRouter>
        <OpenEo />
      </MemoryRouter>
    );

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Færdiggør indlæsningen' }));
    });

    expect(retryPendingPwaFileOpenRequestMock).toHaveBeenCalledTimes(1);
  });

  it('viser hjælpetekst hvis retry ikke kan finde den oprindelige filrequest', async () => {
    vi.useFakeTimers();
    retryPendingPwaFileOpenRequestMock.mockResolvedValue(false);

    render(
      <MemoryRouter>
        <OpenEo />
      </MemoryRouter>
    );

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Færdiggør indlæsningen' }));
    });

    expect(screen.getByText('Kunne ikke finde den fil, der skulle indlæses. Prøv at åbne .eo-filen igen.')).toBeInTheDocument();
  });
});
