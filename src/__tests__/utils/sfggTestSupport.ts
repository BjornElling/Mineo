import type { AmountValue } from '../../schemas/amountExpressionSchema';
import type {
  ErstatningsopgoerelseValues,
  LoenindkomstAnsaettelsesforhold,
} from '../../schemas/formSchemas';
import { toISODateString } from '../../types/branded';

type SfggRow = ErstatningsopgoerelseValues['sfggAnsaettelsesforhold'][number];

export const asSfggAmount = (value: number): AmountValue => ({ kind: 'number', value });

export const sfggIso = (value: string) => toISODateString(value);

export const createSfggEmployment = (
  patch: Partial<LoenindkomstAnsaettelsesforhold> = {}
): LoenindkomstAnsaettelsesforhold => ({
  id: patch.id ?? 'af-1',
  navnPaaArbejdssted: patch.navnPaaArbejdssted ?? 'Arbejdssted 1',
  harOverenskomst: patch.harOverenskomst ?? false,
  overenskomstId: patch.overenskomstId,
  overenskomstFilter: patch.overenskomstFilter ?? { loenmodtager: undefined, arbejdsgiver: undefined },
  ansatPaaSkadestidspunktet: patch.ansatPaaSkadestidspunktet ?? true,
  ansaettelsesforholdOphoert: patch.ansaettelsesforholdOphoert ?? false,
  sidsteArbejdsdag: patch.sidsteArbejdsdag,
  feriePct: patch.feriePct,
  fritvalgPct: patch.fritvalgPct,
  shSoPct: patch.shSoPct,
  storeBededagPct: patch.storeBededagPct,
  pensionPct: patch.pensionPct ?? 0,
  loenperiode: patch.loenperiode ?? 'maaned',
  tillaegAngivesSom: patch.tillaegAngivesSom ?? 'procent',
  fuldLoenUnderFerie: patch.fuldLoenUnderFerie ?? 'Ja',
  harAnciennitetstillaegEfterSkadedatoen: patch.harAnciennitetstillaegEfterSkadedatoen ?? false,
  anciennitetstillaegDato: patch.anciennitetstillaegDato,
  anciennitetstillaegSatsAngivesPer: patch.anciennitetstillaegSatsAngivesPer ?? 'Måned',
  anciennitetstillaegSats: patch.anciennitetstillaegSats,
  loenPaaHelligdage: patch.loenPaaHelligdage ?? 'Almindelig løn',
  saerligFraDatoRegulering: patch.saerligFraDatoRegulering,
  loenudviklingBeregningsgrundlag: patch.loenudviklingBeregningsgrundlag,
  loenudviklingStatistikModel: patch.loenudviklingStatistikModel,
  loenudviklingKRLSatstabel: patch.loenudviklingKRLSatstabel,
  loenudviklingManuelNavn: patch.loenudviklingManuelNavn ?? '',
  loenudviklingManuelTableData: patch.loenudviklingManuelTableData ?? [],
  offentligLoenType: patch.offentligLoenType ?? 'Månedsløn',
  offentligLoenTrin: patch.offentligLoenTrin,
  offentligLoenGruppe: patch.offentligLoenGruppe,
  offentligLoenEkstraGrundloen: patch.offentligLoenEkstraGrundloen,
  indtaegtsoplysningerTableData: patch.indtaegtsoplysningerTableData ?? [],
  ...patch,
  loenudviklingManuelProcentsatsTableData: patch.loenudviklingManuelProcentsatsTableData ?? [],
});

/**
 * Bygger en SFGG-række med beregningsgrundlaget 'Ingen' (neutralt no-op-valg) for ét
 * ansættelsesforhold. Felterne svarer til schemaets output-type.
 */
export const createSfggIngenRow = (ansaettelsesforholdId: string): SfggRow => ({
  ansaettelsesforholdId,
  sfggBeregningskilde: 'Ingen',
  sfggManuelDagssats: undefined,
  sfggManuelBeloebIHenholdTil: undefined,
  sfggManuelFoerstEfterSygeloen: 'Nej',
  sfggReferenceperiodeFra: undefined,
  sfggReferenceperiodeTil: undefined,
  sfggReferenceperiodeFravaersdageUdenLoen: 0,
  sfggSatsvalg: undefined,
  sfggAlleredeBetaltBeloeb: undefined,
});

/**
 * Tilføjer en SFGG-'Ingen'-række for hvert ansættelsesforhold i `loenindkomstAnsaettelsesforhold`
 * der ikke allerede har en SFGG-række.
 *
 * Baggrund: SFGG-inputfejl er fail-closed/blokerende (jf. eo-snapshot-contract §3.1). Når SFGG er
 * relevant (`kravPaaTabtArbejdsfortjeneste === 'Ja'` + `ansatPaaSkadestidspunktet`), skal et
 * fixture – ligesom en rigtig bruger – eksplicit vælge et SFGG-beregningsgrundlag, ellers blokeres
 * den autoritative beregning ("Beregningsgrundlag for SFGG ikke valgt"). 'Ingen' er det neutrale
 * valg, der ikke ændrer beregnede tal, men låser kravet om en eksplicit beslutning op.
 *
 * Brug denne helper i test-fixtures, hvor SFGG ikke er det, der testes.
 */
export const withSfggIngenForEmployments = (
  eoValues: ErstatningsopgoerelseValues
): ErstatningsopgoerelseValues => {
  const existingIds = new Set(
    eoValues.sfggAnsaettelsesforhold.map((row) => row.ansaettelsesforholdId)
  );
  const added = eoValues.loenindkomstAnsaettelsesforhold
    .filter((employment) => !existingIds.has(employment.id))
    .map((employment) => createSfggIngenRow(employment.id));
  if (added.length === 0) return eoValues;
  return {
    ...eoValues,
    sfggAnsaettelsesforhold: [...eoValues.sfggAnsaettelsesforhold, ...added],
  };
};
