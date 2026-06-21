import type { PersistedSectionMap } from '../../../config/persistenceRegistry';
import { ensureSvieRows } from '../tables/svieSmerteTableModel';
import { ensureTafRows } from '../tables/tafTableModel';
import { ensureFravaerRows, ensureTafFerieRows } from '../tables/ferieTableModel';
import { ensureOevrigeKravRows } from '../tables/oevrigeKravTableModel';
import { generateAnsaettelsesforholdId } from './eoRowInitialValues';
import { resolveDefaultOverenskomstFilter, type AppSettings } from '../../../settings/appSettingsSchema';
import { resolveAppSettings } from '../../../settings/appSettingsParse';
import { erstatningsopgoerelseSchema, eoAngivetLoenLoenudviklingSchema } from '../../../schemas/formSchemas';
import { TILLAEG_ANGIVES_SOM } from '../../../types/loen';

const createDefaultAngivetLoenLoenudvikling = (settings: AppSettings): PersistedSectionMap['erstatningsopgoerelse']['eoAngivetLoenLoenudvikling'] => ({
  // Basisfelterne udledes fra schemaets egne felt-defaults (ÉN sandhedskilde) i stedet for en
  // håndskrevet feltliste, der kunne drive ud af sync. Kun de felter der BEVIDST afviger fra
  // schema-defaulten ved oprettelse af NY sagsdata overstyres nedenfor:
  //  - loenPaaHelligdage / overenskomstFilter: settings-afledte (schema-default er undefined / {}).
  //  - offentligLoenType: 'Månedsløn' er new-data-default; schema-defaulten er bevidst undefined
  //    af hensyn til load-tolerance for ældre .eo-filer.
  ...eoAngivetLoenLoenudviklingSchema.parse({}),
  loenPaaHelligdage: settings.defaultLoenPaaHelligdage,
  offentligLoenType: 'Månedsløn',
  overenskomstFilter: resolveDefaultOverenskomstFilter(settings),
});

export const DEFAULT_ANCIENNITET_FIELDS = {
  harAnciennitetstillaegEfterSkadedatoen: false as const,
  anciennitetstillaegDato: undefined,
  anciennitetstillaegSatsAngivesPer: 'Måned' as const,
  anciennitetstillaegSats: undefined,
};

/**
 * Opretter et nyt tomt ansættelsesforhold med standardværdier fra settings.
 *
 * Validering:
 * - AppSettings valideres via resolveAppSettings ved grænsefladen til sagsdata
 * - Ved invalid/manglende settings bruges defaults som fallback
 * - Dette sikrer at ugyldige device-lokale settings aldrig påvirker sagsdata
 *
 * KONTRAKT: Må kun anvendes ved oprettelse af NYE ansættelsesforhold,
 * aldrig ved load/merge af eksisterende data.
 */
export const createDefaultLoenindkomstAnsaettelsesforhold = (
  settings?: AppSettings
): PersistedSectionMap['erstatningsopgoerelse']['loenindkomstAnsaettelsesforhold'][number] => {
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
    tillaegAngivesSom: TILLAEG_ANGIVES_SOM.PROCENT,
    loenperiode: safeSettings.defaultLoenIndtastesSom,
    indtaegtsoplysningerTableData: [],
    fuldLoenUnderFerie: safeSettings.defaultFuldLoenUnderFerie ? 'Ja' : 'Nej',
    loenPaaHelligdage: safeSettings.defaultLoenPaaHelligdage,
    saerligFraDatoRegulering: undefined,
    loenudviklingBeregningsgrundlag: undefined,
    loenudviklingStatistikModel: undefined,
    loenudviklingKRLSatstabel: undefined,
    loenudviklingManuelNavn: undefined,
    loenudviklingManuelTableData: [],
    offentligLoenType: 'Månedsløn',
    offentligLoenTrin: undefined,
    offentligLoenGruppe: undefined,
    offentligLoenEkstraGrundloen: undefined,
    overenskomstFilter: resolveDefaultOverenskomstFilter(safeSettings),
  };
};

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
  kravPaaSvieSmerteGodtgoerelse: 'Ja',
  svieSmerteHelbredsstatus: undefined,
  tidligereSsMax: 'Nej',
  svieSmertePerioder: ensureSvieRows(undefined),
  svieSmerteSatserAar: undefined,
  svieSmerteDelvisSygemeldingSats: safeSettings.defaultSvieSmerteDelvisSygemeldingSats,
  svieSmerteTidligereTotal: undefined,
  svieSmerteAktuelPeriode: undefined,

  // Tabt arbejdsfortjeneste
  kravPaaTabtArbejdsfortjeneste: 'Ja',
  tafArbejdsstatus: undefined,
  tafPerioder: ensureTafRows(undefined),
  ferieperioder: ensureTafFerieRows(undefined),
  opsagtFraStilling: 'Nej',
  sidsteDagAnsaettelsesforhold: undefined,
  tidligereModtagetTaf: undefined,

  // Øvrige erstatningskrav
  // Bevidst designbeslutning: nye sager starter med øvrige krav skjult ('Skjul'),
  // til forskel fra svie/smerte og TAF, der defaulter til 'Ja'. Lad ikke dette
  // "rette tilbage" til 'Ja' for at matche de andre krav — det er tilsigtet.
  // (Schema-defaulten 'Ja' i erstatningsopgoerelseSchemas.ts gælder kun sanering
  // af ældre persisterede sager, hvor feltet mangler, og er en separat beslutning.)
  kravPaaOevrigeErstatningskrav: 'Skjul',
  oevrigeKravPerioder: ensureOevrigeKravRows(undefined),

  // Offentlige ydelser
  offentligeYdelserRows: [],
  offentligeYdelserKommentarer: '',
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

  // EOberegning - bilag: udelades bevidst, så schemaets eget felt-default-objekt
  // (eoBilagSelectionSchema.parse({})) materialiseres — ÉN sandhedskilde for bilag-defaults.
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
