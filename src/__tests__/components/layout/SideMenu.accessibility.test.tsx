// @vitest-environment jsdom
import React from 'react';
import { render, screen } from '@testing-library/react';
import SideMenu from '../../../components/layout/SideMenu';

describe('SideMenu — tastatur og aktiv side', () => {
  it('holder menuknapperne i den normale tastatursekvens og markerer aktiv side', () => {
    render(
      <SideMenu
        activePage="renteberegning"
        onPageChange={vi.fn()}
        onGem={vi.fn()}
        onHent={vi.fn()}
        onSletAlt={vi.fn()}
      />
    );

    const menuButton = screen.getByRole('button', { name: 'Renteberegning' });
    expect(menuButton).toHaveAttribute('tabindex', '0');
    expect(menuButton).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Stamdata' })).not.toHaveAttribute('aria-current');

    // Alle globale menuhandlinger skal kunne nås uden pointer; Containerens feltinventar ejer ikke
    // sidemenuen, så tabIndex={-1} ville ellers gøre dem permanent museafhængige.
    for (const button of screen.getAllByRole('button')) {
      expect(button).not.toHaveAttribute('tabindex', '-1');
    }
  });
});
