import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import OpenEo from '../../../components/pages/OpenEo';

describe('OpenEo', () => {
  it('viser først fallback-indhold efter 1 sekund', () => {
    vi.useFakeTimers();

    render(
      <MemoryRouter>
        <OpenEo />
      </MemoryRouter>
    );

    expect(screen.queryByText('Åbner fil…')).toBeNull();

    act(() => {
      vi.advanceTimersByTime(999);
    });
    expect(screen.queryByText('Åbner fil…')).toBeNull();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.getByText('Åbner fil…')).toBeInTheDocument();
  });
});
