// @vitest-environment jsdom
import React from 'react';
import { act, render } from '@testing-library/react';
import { useStandaloneExitGuard } from '../../../apps/minprocesrente/useStandaloneExitGuard';
import {
  ProductionInputRuntimeProvider,
  createProductionInputRuntimeBinding,
} from '../../../inputCore/react';
import { slimInputStore } from '../../../inputCore/runtime/slimInputStore';
import { dispatchInput } from '../../../inputCore/runtime/dispatchInput';
import { hydrateSlimInputStoreForTest } from '../../../test/actSafeInputStore';
import { createEmptySettledInput } from '../../../inputCore/settledInput';
import { getProductionInputCatalog } from '../../../inputCore/catalog/productionCatalog';
import { settleField } from '../../../inputCore/inputReducer';
import { renteberegningBeregningsdatoField } from '../../../inputCore/catalog/renteberegningDescriptors';
import { documentDownloaded, documentFailed } from '../../../document/definition/documentOutcome';

// BB-048: standalone havde ingen advarsel, før fanen blev lukket. Der er hverken Gem, Hent eller
// filformat, så det eneste varige spor af arbejdet er den PDF, brugeren måtte have hentet – og
// søskendefladen Mineo viser i samme situation browserens «vil du forlade siden?».
//
// Udviklerens regel: advar KUN når der er indtastninger, som ikke er hentet som PDF siden sidste ændring.

const catalog = getProductionInputCatalog();

let tracker: ReturnType<typeof useStandaloneExitGuard> | undefined;

const Probe = () => {
  tracker = useStandaloneExitGuard();
  return null;
};

const renderGuard = () => render(
  <ProductionInputRuntimeProvider binding={createProductionInputRuntimeBinding()}>
    <Probe />
  </ProductionInputRuntimeProvider>
);

const settleBeregningsdato = (raw: string) => {
  act(() => {
    dispatchInput(slimInputStore, catalog, settleField(renteberegningBeregningsdatoField.bind(), raw));
  });
};

/** Måler udfaldet, ikke lytterens livscyklus: ville browseren spørge, før fanen lukkes? */
const beforeUnloadIsArmed = (): boolean => {
  const event = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
};

describe('useStandaloneExitGuard', () => {

  beforeEach(() => {
    sessionStorage.clear();
    // Storen er et modul-singleton og bærer ellers forrige tests afsluttede input videre. Uden
    // nulstillingen ville en gentagen settle af SAMME værdi ikke hæve revisionen, og guarden ville
    // se en flade uden ændringer.
    hydrateSlimInputStoreForTest(slimInputStore, catalog.validateSettledInput(createEmptySettledInput()));
    tracker = undefined;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('advarer ikke på en tom flade – der er intet at miste', () => {
    renderGuard();
    expect(beforeUnloadIsArmed()).toBe(false);
  });

  it('advarer, når der er afsluttet indtastning, som ikke er hentet', () => {
    renderGuard();
    settleBeregningsdato('01-01-2024');
    expect(beforeUnloadIsArmed()).toBe(true);
  });

  it('holder op med at advare efter et gennemført hent', () => {
    renderGuard();
    settleBeregningsdato('01-01-2024');
    expect(beforeUnloadIsArmed()).toBe(true);

    act(() => { tracker?.(documentDownloaded); });
    // Den, der lige har hentet sit dokument, generes ikke.
    expect(beforeUnloadIsArmed()).toBe(false);
  });

  it('advarer igen, når brugeren taster videre efter sit hent', () => {
    renderGuard();
    settleBeregningsdato('01-01-2024');
    act(() => { tracker?.(documentDownloaded); });
    expect(beforeUnloadIsArmed()).toBe(false);

    settleBeregningsdato('02-01-2024');
    expect(beforeUnloadIsArmed()).toBe(true);
  });

  it('rydder IKKE advarslen ved et fejlet hent – brugeren fik ingen fil', () => {
    renderGuard();
    settleBeregningsdato('01-01-2024');

    act(() => {
      tracker?.(documentFailed({ kind: 'runtime', phase: 'render', cause: new Error('test') }));
    });

    expect(beforeUnloadIsArmed()).toBe(true);
  });
});
