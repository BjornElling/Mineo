import type { PersistedSectionMap } from '../../config/persistenceRegistry';
import { LOEN_PAA_HELLIGDAGE, LOENPERIODE } from '../../types/loen';

export const AARSLOEN_INITIAL_VALUES = {
  feriePct: undefined,
  fritvalgPct: undefined,
  shSoPct: undefined,
  storeBededagPct: undefined,
  pensionPct: undefined,
  loenperiode: LOENPERIODE.MAANED,
  tableData: [],
  omregningTilFuldtAar: false,
  fuldLoenUnderFerie: true,
  retTilSjetteFerieuge: true,
  antalFeriedage: undefined,
  loenPaaHelligdage: LOEN_PAA_HELLIGDAGE.ALMINDELIG,
} as const satisfies PersistedSectionMap['aarsloen'];
