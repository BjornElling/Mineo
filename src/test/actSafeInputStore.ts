import { act } from '@testing-library/react';
import {
  __hydrateSlimInputStoreForTest,
  type SlimInputStore,
} from '../inputCore/runtime/slimInputStore';
import type { SettledInput } from '../inputCore/settledInput';

/**
 * Hydrer en test-store inde i Reacts `act`-grænse.
 *
 * Hydration er en test-only arrangement af den autoritative store, men store-signalet kan samtidig opdatere
 * monterede komponenter. Når arrangementet sker direkte efter en render eller i en hook, skal både store-
 * notifikationen og Reacts efterfølgende render ligge i samme `act`; ellers får hver ny test den samme støjende
 * advarsel og risikerer at observere en delvist opdateret visning.
 */
export const hydrateSlimInputStoreForTest = (
  store: SlimInputStore,
  input: SettledInput,
  options?: Readonly<{ writesBlocked?: boolean }>
): void => {
  act(() => {
    __hydrateSlimInputStoreForTest(store, input, options);
  });
};
