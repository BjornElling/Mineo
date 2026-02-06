import type { PersistedSectionMap } from './persistenceRegistry';
import type { StorageKey } from './storageManifest';
import { DEFAULT_APP_SETTINGS, appSettingsSchema, resolveDefaultOverenskomstFilter, type AppSettings } from '../settings/appSettingsSchema';
import { LOENPERIODE, LOEN_PAA_HELLIGDAGE } from '../types/common';

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends Array<infer U>
    ? Array<DeepPartial<U>>
    : T[K] extends object
      ? DeepPartial<T[K]>
      : T[K];
};

export type PersistedSectionDefaults = {
  [K in StorageKey]?: DeepPartial<PersistedSectionMap[K]>;
};

const resolveSafeSettings = (settings?: AppSettings): AppSettings => {
  const parsed = settings ? appSettingsSchema.safeParse(settings) : { success: false as const };
  return parsed.success ? parsed.data : DEFAULT_APP_SETTINGS;
};

/**
 * Build default values for missing fields when loading `.eo` files.
 *
 * IMPORTANT (trust-critical):
 * - Defaults are only applied for fields that are missing in the file.
 * - Existing values MUST NOT be changed.
 * - Defaults must be deterministic and side-effect free.
 */
export const buildPersistenceDefaults = (settings?: AppSettings): PersistedSectionDefaults => {
  const safeSettings = resolveSafeSettings(settings);

  return {
    stamdata: {
      journalnr: '',
      advokat: '',
      sagsbehandler: '',
      skadelidte: '',
    },
    aarsloen: {
      loenperiode: LOENPERIODE.MAANED,
      tableData: [],
      omregningTilFuldtAar: false,
      fuldLoenUnderFerie: true,
      retTilSjetteFerieuge: true,
      loenPaaHelligdage: LOEN_PAA_HELLIGDAGE.ALMINDELIG,
    },
    renteberegning: {
      rentekravRows: [],
    },
    erstatningsopgoerelse: {
      indsaetUdkastStempel: safeSettings.defaultIndsaetUdkastStempel ? 'Ja' : 'Nej',
      revideretOpgoerelse: 'Nej',
      erstatningsopgoerelseAfsluttesMed: safeSettings.erstatningsopgoerelseAfsluttesMed,

      varigeMenAfgorelse: 'Nej',
      verserendeKlageMen: 'Nej',
      midlertidigtEetAfgorelse: 'Nej',
      endeligtEetAfgorelse: 'Nej',
      verserendeKlageEet: 'Nej',

      beregnesSvieSmerteGodtgoerelse: 'Ja',
      tidligereSsMax: 'Nej',
      svieSmertePerioder: [],
      svieSmerteDelvisSygemeldingSats: 'halv',

      beregnesTabtArbejdsfortjeneste: 'Ja',
      tafPerioder: [],
      ferieperioder: [],
      medlemmetOpsagt: 'Nej',

      oevrigeKravPerioder: [],
      offentligeYdelserRows: [],

      komprimerBeregningEfterFoersteOpgoerelse: 'Ja',
      beregnesUdFra: 'Beregningsperiode',
      fravaerPerioder: [],
      oevrigtFravaerUdenLoen: 'Nej',

      ferieMedLon: 'Nej',
      maanedsloennetMedFerielon: 'Nej',
      forstSfgEfterSygelon: 'Nej',

      eoBilagSelection: {
        opgoerelse: true,
        loenindkomst: true,
        offentligeYdelser: true,
        shDage: true,
        regulering: true,
        okSatser: true,
        sygeferiegodtgoerelse: false,
      },

      loenindkomstAnsaettelsesforhold: [
        {
          id: 'ansaettelsesforhold_1',
          harOverenskomst: true,
          ansatPaaSkadestidspunktet: true,
          ansaettelsesforholdOphoert: false,
          loenperiode: LOENPERIODE.MAANED,
          fuldLoenUnderFerie: safeSettings.defaultFuldLoenUnderFerie ? 'Ja' : 'Nej',
          loenPaaHelligdage: safeSettings.defaultLoenPaaHelligdage,
          indtaegtsoplysningerTableData: [],
          loenudviklingBeregningsgrundlag: 'Ingen',
          loenudviklingManuelTableData: [],
          overenskomstFilter: resolveDefaultOverenskomstFilter(safeSettings),
        },
      ],
    },
  };
};
