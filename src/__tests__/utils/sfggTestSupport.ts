import type { ErstatningsopgoerelseValues } from '../../schemas/formSchemas';

type SfggRow = ErstatningsopgoerelseValues['sfggAnsaettelsesforhold'][number];

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
 * fixture — ligesom en rigtig bruger — eksplicit vælge et SFGG-beregningsgrundlag, ellers blokeres
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
