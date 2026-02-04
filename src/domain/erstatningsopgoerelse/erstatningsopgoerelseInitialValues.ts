import type { PersistedSectionMap } from '../../config/persistenceRegistry';
import { LOENPERIODE } from '../../types/common';
import { ensureSvieRows } from './svieSmerteTableModel';
import { ensureTafRows } from './tafTableModel';
import { ensureFravaerRows, ensureTafFerieRows } from './ferieTableModel';
import { ensureOevrigeKravRows } from './oevrigeKravTableModel';
import { appSettingsSchema, DEFAULT_APP_SETTINGS, resolveDefaultOverenskomstFilter, type AppSettings } from '../../settings/appSettingsSchema';

/**
 * Opretter initial values for erstatningsopgørelse med settings-baserede standardværdier
 *
 * Validering:
 * - AppSettings valideres via safeParse ved grænsefladen til sagsdata
 * - Ved invalid settings bruges DEFAULT_APP_SETTINGS som fallback
 * - Dette sikrer at ugyldige device-lokale settings aldrig påvirker sagsdata
 *
 * @param settings AppSettings med standardværdier (optional for bagudkompatibilitet)
 * @returns ErstatningsopgoerelseValues med korrekte defaults
 */
export const createErstatningsopgoerelseInitialValues = (settings?: AppSettings): PersistedSectionMap['erstatningsopgoerelse'] => {
  // Valider settings én gang ved grænsefladen til sagsdata
  const parsed = settings ? appSettingsSchema.safeParse(settings) : { success: false as const };
  const safeSettings = parsed.success ? parsed.data : DEFAULT_APP_SETTINGS;

  return {
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
  midlertidigtEetAfgorelse: 'Nej',
  midlertidigEETAfgoerelseDato: undefined,
  midlertidigEETVirkningsdato: undefined,

  // AES-afgørelser - Endeligt EET
  endeligtEetAfgorelse: 'Nej',
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
  svieSmerteDelvisSygemeldingSats: 'halv',
  svieSmerteTidligereTotal: undefined,
  svieSmerteAktuelPeriode: undefined,

  // Tabt arbejdsfortjeneste
  beregnesTabtArbejdsfortjeneste: 'Ja',
  tafArbejdsstatus: undefined,
  tafPerioder: ensureTafRows(undefined),
  ferieperioder: ensureTafFerieRows(undefined),
  medlemmetOpsagt: 'Nej',
  sidsteDagAnsaettelsesforhold: undefined,
  tidligereModtagetTaf: undefined,

  // Øvrige erstatningskrav
  oevrigeKravPerioder: ensureOevrigeKravRows(undefined),

  // Offentlige ydelser
  offentligeYdelserRows: [],

  // Indtægt før skaden
  komprimerBeregningEfterFoersteOpgoerelse: 'Ja',
  beregnesUdFra: 'Beregningsperiode',
  periodeTilBeregningFra: undefined,
  periodeTilBeregningTil: undefined,
  fravaerPerioder: ensureFravaerRows(undefined),
  uspecificeredeFerieFridage: undefined,
  oevrigtFravaerUdenLoen: 'Nej',
  oevrigeFravaersdage: undefined,
  oevrigeFravaersdageBeskrivelse: '',
  maanedsloenenUdgoer: undefined,
  dagsloenenUdgoer: undefined,
  loenBaseretPaa: '',
  angivetLoenOpreguleresFraDato: undefined,

  // Sygeferiegodtgørelse
  ferieMedLon: 'Nej',
  maanedsloennetMedFerielon: 'Nej',
  forstSfgEfterSygelon: 'Nej',
  andelSfggILoenen: undefined,

  // Lønindkomst
  loenindkomstAnsaettelsesforhold: [
    {
      id: 'ansaettelsesforhold_1',
      navnPaaArbejdssted: undefined,
      harOverenskomst: true,
      overenskomstId: undefined,
      ansatPaaSkadestidspunktet: true,
      ansaettelsesforholdOphoert: false,
      sidsteArbejdsdag: undefined,
      feriePct: undefined,
      fritvalgPct: undefined,
      shSoPct: undefined,
      storeBededagPct: undefined,
      pensionPct: undefined,
      loenperiode: LOENPERIODE.MAANED,
      fuldLoenUnderFerie: safeSettings.defaultFuldLoenUnderFerie ? 'Ja' : 'Nej',
      loenPaaHelligdage: safeSettings.defaultLoenPaaHelligdage,
      saerligFraDatoRegulering: undefined,
      indtaegtsoplysningerTableData: [],
      loenudviklingBeregningsgrundlag: 'Ingen',
      loenudviklingStatistikModel: undefined,
      loenudviklingManuelNavn: '',
      loenudviklingManuelTableData: [],
      // Overenskomst-filter: initialiseres fra settings ved oprettelse (centraliseret mapping)
      overenskomstFilter: resolveDefaultOverenskomstFilter(settings),
    },
  ],

  // Løn-udvikling
  loenudviklingPaaGrundlagAf: '',

  // Kommentarer
  saerligeKommentarer: '',
  };
};

/**
 * @deprecated Brug createErstatningsopgoerelseInitialValues(settings) i stedet
 * Bevaret for bagudkompatibilitet med tests
 */
export const ERSTATNINGSOPGOERELSE_INITIAL_VALUES = createErstatningsopgoerelseInitialValues();

