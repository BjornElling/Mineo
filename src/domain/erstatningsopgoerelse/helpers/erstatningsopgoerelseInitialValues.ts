import { ensureSvieRows } from '../tables/svieSmerteTableModel';
import { ensureTafRows } from '../tables/tafTableModel';
import { ensureFravaerRows, ensureTafFerieRows } from '../tables/ferieTableModel';
import { ensureOevrigeKravRows } from '../tables/oevrigeKravTableModel';
import { generateAnsaettelsesforholdId } from './eoRowInitialValues';
import { resolveDefaultOverenskomstFilter, type AppSettings } from '../../../settings/appSettingsSchema';
import { resolveAppSettings } from '../../../settings/appSettingsParse';
import { resolveErstatningsopgoerelseNewCaseDefaults } from '../erstatningsopgoerelseNewCaseSeed';
import {
  erstatningsopgoerelseSchema,
  type PersistedLoenindkomstAnsaettelsesforhold,
  type ErstatningsopgoerelseValues,
} from '../../../schemas/formSchemas';
import { TILLAEG_ANGIVES_SOM } from '../../../types/loen';

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
): PersistedLoenindkomstAnsaettelsesforhold => {
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
    // Ingen `storeBededagPct`: den er afledt af dato og "Løn på helligdage" og hører ikke i det
    // persisterede ansættelsesforhold. Reader-projektionen udleder den før første consumer-read.
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
    loenudviklingManuelProcentsatsTableData: [],
    offentligLoenType: 'Månedsløn',
    offentligLoenTrin: undefined,
    offentligLoenGruppe: undefined,
    offentligLoenEkstraGrundloen: undefined,
    overenskomstFilter: resolveDefaultOverenskomstFilter(safeSettings),
  };
};

/**
 * Opretter initial values for erstatningsopgørelse med settings-baserede standardværdier.
 *
 * Fabrikken er en TESTFIXTURE-bekvemmelighed, ikke produktionens vej til en ny sag: den levende sag bygges af
 * ny-sags-seeden (`erstatningsopgoerelseNewCaseSeed.ts`) gennem inputkernen. Derfor bygger fabrikken på præcis
 * de samme defaults; alt andet ville gøre suitens fixtures til en anden sag, end brugeren møder (§2.11).
 *
 * De ENESTE tilføjelser er tabellernes pladsholderrækker: greenfields pladsholderrække er virtuel og findes
 * ikke i den persisterede sag, men fixturene har brug for en materialiseret række at skrive i.
 *
 * VIGTIGT: Må kun anvendes ved oprettelse af NY sagsdata (ikke ved load/redigering).
 */
export const createErstatningsopgoerelseInitialValues = (
  settings?: AppSettings
): ErstatningsopgoerelseValues => erstatningsopgoerelseSchema.parse({
  ...resolveErstatningsopgoerelseNewCaseDefaults(settings),
  svieSmertePerioder: ensureSvieRows(undefined),
  tafPerioder: ensureTafRows(undefined),
  ferieperioder: ensureTafFerieRows(undefined),
  fravaerPerioder: ensureFravaerRows(undefined),
  oevrigeKravPerioder: ensureOevrigeKravRows(undefined),
});
