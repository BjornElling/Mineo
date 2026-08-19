// @vitest-environment jsdom
import React from 'react';
import { render, screen } from '@testing-library/react';
import { act } from 'react';
import Container from '../../../components/layout/Container';
import SideTab from '../../../components/layout/SideTab';
import SideTabRail from '../../../components/layout/SideTabRail';
import { CONTENT_BOX_WIDTH_PX } from '../../../utils/uiScale';

/**
 * Skinnen er det ene sted, kontrolfanernes udhæng bliver klippet – og dermed det ene sted, der
 * afgør, at to synlige kontrolfaner ikke kan give arbejdsfladen vandret rul.
 *
 * jsdom laver ikke layout, så geometrien stilles op eksplicit: scrollportens synlige højrekant og
 * skinnens venstrekant. Det er præcis de to tal, produktionskoden læser, så testen måler den
 * faktiske målevej og ikke en mock af beslutningen.
 */
const SCROLLPORT_LEFT = 274;

const stubGeometry = (options: { readonly scrollportRightPx: number; readonly scrollLeftPx?: number }) => {
  const scrollport = document.querySelector<HTMLElement>('[data-mineo-scroll-container="true"]');
  const rail = document.querySelector<HTMLElement>('[data-mineo-side-tab-rail="true"]');
  if (scrollport === null || rail === null) throw new Error('Mangler scrollport eller skinne.');

  Object.defineProperty(scrollport, 'clientWidth', {
    configurable: true,
    value: options.scrollportRightPx - SCROLLPORT_LEFT,
  });
  Object.defineProperty(scrollport, 'clientLeft', { configurable: true, value: 0 });
  scrollport.scrollLeft = options.scrollLeftPx ?? 0;
  const rectAt = (left: number, width: number): DOMRect => ({
    left,
    right: left + width,
    width,
    top: 0,
    bottom: 800,
    height: 800,
    x: left,
    y: 0,
    toJSON: () => ({}),
  });
  scrollport.getBoundingClientRect = () => rectAt(SCROLLPORT_LEFT, options.scrollportRightPx - SCROLLPORT_LEFT);
  // Skinnen ligger efter gutteren og `main`s indrykning; et evt. rul flytter dens visuelle kant.
  rail.getBoundingClientRect = () => rectAt(SCROLLPORT_LEFT + 50 - (options.scrollLeftPx ?? 0), 0);

  return { scrollport, rail };
};

const renderRail = () => render(
  <Container enableContentScale>
    <SideTabRail>
      <SideTab label="EO-kontrol" active onClick={vi.fn()} top="-25px" />
      <SideTab label="Kontroltabel" active={false} onClick={vi.fn()} top="125px" />
    </SideTabRail>
  </Container>
);

describe('SideTabRail', () => {
  it('klipper vandret og lader den roterede fane rage nedad', () => {
    renderRail();
    const rail = document.querySelector<HTMLElement>('[data-mineo-side-tab-rail="true"]');

    expect(rail).not.toBeNull();
    // `overflow-y: visible` er bærende: den roterede fane rager ~265 px NEDAD fra skinnen og må
    // ikke beskæres. Kun den vandrette akse klippes.
    expect(rail).toHaveStyle({ 'overflow-x': 'clip', 'overflow-y': 'visible', height: '0px' });
    // Skinnen må ikke flytte noget i flowet – fanerne er absolut placerede oven i den.
    expect(screen.getByRole('button', { name: 'EO-kontrol' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Kontroltabel' })).toBeInTheDocument();
  });

  it('er indholdsboksens bredde, indtil geometrien kan måles', () => {
    // Startbredden kan ikke give vandret rul: fanerne begynder præcis ved boksens kant og er derfor
    // fuldt klippede, til den første måling har fundet den synlige kant.
    renderRail();

    expect(document.querySelector('[data-mineo-side-tab-rail="true"]'))
      .toHaveStyle({ width: `${CONTENT_BOX_WIDTH_PX}px` });
  });

  it('måler skinnen frem til arbejdsfladens synlige højrekant ved en vinduesændring', () => {
    renderRail();
    stubGeometry({ scrollportRightPx: 1920 });

    act(() => { window.dispatchEvent(new Event('resize')); });

    // 1920 − (274 + 50) = 1596: hele udhænget er inden for kanten, så fanerne står ubeskåret.
    expect(document.querySelector('[data-mineo-side-tab-rail="true"]')).toHaveStyle({ width: '1596px' });
  });

  it('holder klipperkanten fast, når arbejdsfladen er rullet vandret', () => {
    renderRail();
    stubGeometry({ scrollportRightPx: 1920 });
    act(() => { window.dispatchEvent(new Event('resize')); });

    stubGeometry({ scrollportRightPx: 1920, scrollLeftPx: 300 });
    act(() => { window.dispatchEvent(new Event('resize')); });

    // Uden rullet med i regnestykket ville skinnen blive 300 px bredere for hvert rul mod højre –
    // og dermed selv gøre scrollområdet bredere, rul efter rul.
    expect(document.querySelector('[data-mineo-side-tab-rail="true"]')).toHaveStyle({ width: '1596px' });
  });

  it('klipper fanerne helt væk, når den synlige kant ligger inden for indholdsboksen', () => {
    renderRail();
    // Under den dækkede minimumsbredde overtager `Container`s vandrette rul, og fanerne skal blot
    // forsvinde tavst – de må ikke gøre det scrollområde bredere, end indholdet selv kræver.
    stubGeometry({ scrollportRightPx: 1000 });

    act(() => { window.dispatchEvent(new Event('resize')); });

    expect(document.querySelector('[data-mineo-side-tab-rail="true"]'))
      .toHaveStyle({ width: `${CONTENT_BOX_WIDTH_PX}px` });
  });
});
