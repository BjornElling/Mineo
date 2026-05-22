import type { PersistedSectionMap } from '../../../config/persistenceRegistry';
import { LOENPERIODE } from '../../../types/loen';
import { ensureSvieRows } from '../tables/svieSmerteTableModel';
import { ensureTafRows } from '../tables/tafTableModel';
import { ensureFravaerRows, ensureTafFerieRows } from '../tables/ferieTableModel';
import { ensureOevrigeKravRows } from '../tables/oevrigeKravTableModel';
import { generateAnsaettelsesforholdId } from './eoRowInitialValues';
import { resolveDefaultOverenskomstFilter, type AppSettings } from '../../../settings/appSettingsSchema';
import { resolveAppSettings } from '../../../settings/appSettingsParse';
import { erstatningsopgoerelseSchema } from '../../../schemas/formSchemas';

const createDefaultAngivetLoenLoenudvikling = (settings: AppSettings): PersistedSectionMap['erstatningsopgoerelse']['eoAngivetLoenLoenudvikling'] => ({
  overenskomstId: undefined,
  ...DEFAULT_ANCIENNITET_FIELDS,
  feriePct: undefined,
  loenPaaHelligdage: settings.defaultLoenPaaHelligdage,
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
  overenskomstFilter: resolveDefaultOverenskomstFilter(settings),
});

export const DEFAULT_ANCIENNITET_FIELDS = {
  harAnciennitetstillaegEfterSkadedatoen: false as const,
  anciennitetstillaegDato: undefined,
  anciennitetstillaegSatsAngivesPer: 'Måned' as const,
  anciennitetstillaegSats: undefined,
};

export const createDefaultLoenindkomstAnsaettelsesforhold = (
  settings?: AppSettings
): PersistedSectionMap['erstatningsopgoerelse']['loenindkomstAnsaettelsesforhold'][number] => ({
  ...(() => {
    const safeSettings = resolveAppSettings(settings);
    return {
  id: generateAnsaettelsesforholdId(),
  navnPaaArbejdssted: undefined,
  harOverenskomst: true,
  overenskomstId: undefined,
  ansatPaaSkadestidspunktet: true,
  ansaettelsesforholdOphoert: false,
  sidsteArbejdsdag: undefined,
  ...DEFAULT_ANCIENNITET_FIELDS,
  feriePct: undefined,
  fritvalgPct: undefined,
  shSoPct: undefined,
  storeBededagPct: undefined,
  pensionPct: undefined,
  loenperiode: LOENPERIODE.MAANED,
  indtaegtsoplysningerTableData: [],
  fuldLoenUnderFerie: safeSettings.defaultFuldLoenUnderFerie ? 'Ja' : 'Nej',
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
    };
  })(),
});

/**
 * Opretter initiale EO-værdier ud fra AppSettings.
 *
 * KRITISK KONTRAKT:
 * - Må KUN anvendes ved oprettelse af NYE sagsdata
 * - Må ALDRIG anvendes ved load/merge af eksisterende data
 */
const createNewEOInitialValuesFromSettings = (settings?: AppSettings): PersistedSectionMap['erstatningsopgoerelse'] => {
  const safeSettings = resolveAppSettings(settings);

  return erstatningsopgoerelseSchema.parse({
  // Erstatningsopgørelse info
  eoNummer: undefined,
  eoLedsagetekst: '',
  opgørelseLavetDen: undefined,
  indsaetUdkastStempel: safeSettings.defaultIndsaetUdkastStempel ? 'Ja' : 'Nej',
  vedroererPeriodeFra: undefined,
  vedroererPeriodeTil: undefined,
  revideretOpgoerelse: 'Nej',
  erstatningsopgoerelseAfsluttesMed: safeSettings.erstatningsopgoerelseAfsluttesMed,

  // Forlig
  forligAnsvarsgradProcent: undefined,
  forligAnsvarsgradBroek: '',
  forligDato: undefined,

  // AES-afgørelser - Varige mén
  varigeMenAfgorelse: 'Nej',
  menAfgoerelseDato: undefined,
  verserendeKlageMen: 'Nej',

  // AES-afgørelser - Midlertidigt EET
  midlertidigtEETAfgorelse: 'Nej',
  midlertidigEETAfgoerelseDato: undefined,
  midlertidigEETVirkningsdato: undefined,

  // AES-afgørelser - Endeligt EET
  endeligtEETAfgorelse: 'Nej',
  endeligEETAfgoerelseDato: undefined,
  endeligEETVirkningsdato: undefined,
  verserendeKlageEet: 'Nej',

  // AES-afgørelser - Øvrigt
  differencekravDato: undefined,

  // Svie/smerte godtgørelse
  beregnesSvieSmerteGodtgoerelse: 'Ja',
  svieSmerteHelbredsstatus: undefined,
  tidligereSsMax: 'Nej',
  svieSmertePerioder: ensureSvieRows(undefined),
  svieSmerteSatserAar: undefined,
  svieSmerteDelvisSygemeldingSats: safeSettings.defaultSvieSmerteDelvisSygemeldingSats,
  svieSmerteTidligereTotal: undefined,
  svieSmerteAktuelPeriode: undefined,

  // Tabt arbejdsfortjeneste
  beregnesTabtArbejdsfortjeneste: 'Ja',
  tafArbejdsstatus: undefined,
  tafPerioder: ensureTafRows(undefined),
  ferieperioder: ensureTafFerieRows(undefined),
  opsagtFraStilling: 'Nej',
  sidsteDagAnsaettelsesforhold: undefined,
  tidligereModtagetTaf: undefined,

  // Øvrige erstatningskrav
  oevrigeKravPerioder: ensureOevrigeKravRows(undefined),

  // Offentlige ydelser
  offentligeYdelserRows: [],
  midlertidigtEetFraEetSiden: 'Nej',
  regulerOffentligeYdelser: 'Ja',

  // Indtægt før skaden
  komprimerBeregningEfterFoersteOpgoerelse: 'Ja',
  beregnesUdFra: 'Beregningsperiode',
  tafBeregningsperiodeFra: undefined,
  tafBeregningsperiodeTil: undefined,
  fravaerPerioder: ensureFravaerRows(undefined),
  uspecificeredeFerieFridage: undefined,
  oevrigtFravaerUdenLoen: 'Nej',
  oevrigeFravaersdage: undefined,
  oevrigeFravaersdageBeskrivelse: '',
  maanedsloenenUdgoer: undefined,
  dagsloenenUdgoer: undefined,
  angivetMaanedsloenBaseretPaa: '',
  angivetMaanedsloenOpreguleresFraDato: undefined,
  angivetDagsloenBaseretPaa: '',
  angivetDagsloenOpreguleresFraDato: undefined,

  // Sygeferiegodtgørelse
  sfggSygeperioderFoer2015: [],
  sfggAnsaettelsesforhold: [],

  // Lønindkomst
  loenindkomstAnsaettelsesforhold: [],

  eoAngivetLoenLoenudvikling: createDefaultAngivetLoenLoenudvikling(safeSettings),

  // Løn-udvikling
  loenudviklingPaaGrundlagAf: '',

  // Kommentarer
  saerligeKommentarer: '',

  // Bilagsnumre
  visBilagsnumre: safeSettings.defaultVisBilagsnumre ? 'Ja' : 'Nej',

  // EOberegning - bilag
  eoBilagSelection: {
    opgoerelse: true,
    loenindkomst: true,
    offentligeYdelser: true,
    midlertidigEet: true,
    shDage: false,
    regulering: true,
    okSatser: true,
    sygeferiegodtgoerelse: false,
  },
  });
};

/**
 * Opretter initial values for erstatningsopgørelse med settings-baserede standardværdier
 *
 * VIGTIGT: Må kun anvendes ved oprettelse af NY sagsdata (ikke ved load/redigering).
 */
export const createErstatningsopgoerelseInitialValues = (settings?: AppSettings): PersistedSectionMap['erstatningsopgoerelse'] => {
  return createNewEOInitialValuesFromSettings(settings);
};
