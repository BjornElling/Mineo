// @vitest-environment jsdom
import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import OpenEo from '../../../components/system/OpenEo';

const LocationProbe = () => <output data-testid="location">{useLocation().pathname}</output>;

describe('OpenEo', () => {
  it('fører straks filhandlerens interne landing videre til sagens startside', () => {
    render(
      <MemoryRouter initialEntries={['/open']}>
        <OpenEo />
        <LocationProbe />
      </MemoryRouter>
    );

    // Routen ejer ingen status eller retry: MainLayout fortsætter den durable PWA-request.
    expect(screen.getByTestId('location')).toHaveTextContent('/stamdata');
  });
});
