import type { ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';

type Ansaettelsesforhold = ErstatningsopgoerelseValues['loenindkomstAnsaettelsesforhold'][number];
type SfggAnsaettelsesforholdRow = ErstatningsopgoerelseValues['sfggAnsaettelsesforhold'][number];

export const applyAnsaettelsesforholdToggleCleanup = (
  prev: Ansaettelsesforhold,
  field: 'harOverenskomst' | 'ansatPaaSkadestidspunktet' | 'ansaettelsesforholdOphoert' | 'harAnciennitetstillaegEfterSkadedatoen',
  nextValue: boolean
): Ansaettelsesforhold => ({ ...prev, [field]: nextValue });

export const applySfggBeregningskildeChange = (
  current: SfggAnsaettelsesforholdRow,
  nextBeregningskilde: SfggAnsaettelsesforholdRow['sfggBeregningskilde']
): SfggAnsaettelsesforholdRow => ({
  // Skjulte SFGG-felter er fortsat committed brugerinput og skal derfor bevares i
  // runtime-state, sessionStorage og .eo-save/load. Beregningsmotoren gater eksplicit
  // på sfggSource.kind (se sygeferiegodtgoerelse.ts: `if (sfggSource.kind === 'ingen') continue`
  // og resolveSfggSegmentRateForDate) og validatoren gater tilsvarende — stale værdier
  // fra ikke-aktive beregningskilder ignoreres der, ikke her.
  ...current,
  sfggBeregningskilde: nextBeregningskilde,
});
