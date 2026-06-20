import type { PersistedSectionMap } from '../../config/persistenceRegistry';
import { LOEN_PAA_HELLIGDAGE, LOENPERIODE, TILLAEG_ANGIVES_SOM } from '../../types/loen';
import { resolveAppSettings } from '../../settings/appSettingsParse';
import type { AppSettings } from '../../settings/appSettingsSchema';

export const AARSLOEN_INITIAL_VALUES = {
  feriePct: undefined,
  fritvalgPct: undefined,
  shSoPct: undefined,
  storeBededagPct: undefined,
  pensionPct: undefined,
  loenperiode: LOENPERIODE.MAANED,
  tillaegAngivesSom: TILLAEG_ANGIVES_SOM.PROCENT,
  tableData: [],
  omregningTilFuldtAar: false,
  fuldLoenUnderFerie: true,
  retTilSjetteFerieuge: true,
  antalFeriedage: undefined,
  loenPaaHelligdage: LOEN_PAA_HELLIGDAGE.ALMINDELIG,
} as const satisfies PersistedSectionMap['aarsloen'];

/**
 * Opretter initiale årsløn-værdier med settings-baserede standardværdier.
 *
 * VIGTIGT: Må kun anvendes ved oprettelse af NY sagsdata (ikke ved load/redigering).
 */
export const createAarsloenInitialValues = (settings?: AppSettings): PersistedSectionMap['aarsloen'] => {
  const safeSettings = resolveAppSettings(settings);
  return {
    ...AARSLOEN_INITIAL_VALUES,
    loenperiode: safeSettings.defaultLoenIndtastesSom,
  };
};
