import type { PersistedSectionMap } from './persistenceRegistry';
import type { StorageKey } from './storageManifest';
import { resolveDefaultOverenskomstFilter, type AppSettings } from '../settings/appSettingsSchema';
import { resolveAppSettings } from '../settings/appSettingsParse';
import { LOENPERIODE } from '../types/loen';
import { DEFAULT_ANCIENNITET_FIELDS } from '../domain/erstatningsopgoerelse/erstatningsopgoerelseInitialValues';

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

/**
 * Build default values for missing fields when loading `.eo` files.
 *
 * IMPORTANT (trust-critical):
 * - Defaults are only applied for fields that are missing in the file.
 * - Existing values MUST NOT be changed.
 * - Defaults must be deterministic and side-effect free.
 */
export const buildPersistenceDefaults = (settings?: AppSettings): PersistedSectionDefaults => {
  const safeSettings = resolveAppSettings(settings);

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
      fuldLoenUnderFerie: safeSettings.defaultFuldLoenUnderFerie,
      retTilSjetteFerieuge: true,
      loenPaaHelligdage: safeSettings.defaultLoenPaaHelligdage,
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
      svieSmerteDelvisSygemeldingSats: safeSettings.defaultSvieSmerteDelvisSygemeldingSats,

      beregnesTabtArbejdsfortjeneste: 'Ja',
      tafPerioder: [],
      ferieperioder: [],
      opsagtFraStilling: 'Nej',

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
          ...DEFAULT_ANCIENNITET_FIELDS,
          loenperiode: LOENPERIODE.MAANED,
          fuldLoenUnderFerie: safeSettings.defaultFuldLoenUnderFerie ? 'Ja' : 'Nej',
          loenPaaHelligdage: safeSettings.defaultLoenPaaHelligdage,
          indtaegtsoplysningerTableData: [],
          loenudviklingBeregningsgrundlag: 'Ingen',
          loenudviklingManuelTableData: [],
          offentligLoenEkstraGrundloen: undefined,
          overenskomstFilter: resolveDefaultOverenskomstFilter(safeSettings),
        },
      ],
      eoAngivetLoenLoenudvikling: {
        overenskomstId: undefined,
        ...DEFAULT_ANCIENNITET_FIELDS,
        feriePct: undefined,
        loenPaaHelligdage: safeSettings.defaultLoenPaaHelligdage,
        saerligFraDatoRegulering: undefined,
        loenudviklingBeregningsgrundlag: undefined,
        loenudviklingStatistikModel: undefined,
        loenudviklingKRLSatstabel: undefined,
        loenudviklingManuelNavn: '',
        loenudviklingManuelTableData: [],
        offentligLoenType: 'Månedsløn',
        offentligLoenTrin: undefined,
        offentligLoenGruppe: undefined,
        offentligLoenEkstraGrundloen: undefined,
        overenskomstFilter: resolveDefaultOverenskomstFilter(safeSettings),
      },
    },
  };
};
