import type { ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';

type Ansaettelsesforhold = ErstatningsopgoerelseValues['loenindkomstAnsaettelsesforhold'][number];
type SfggAnsaettelsesforholdRow = ErstatningsopgoerelseValues['sfggAnsaettelsesforhold'][number];
type LoenudviklingBeregningsgrundlag = Ansaettelsesforhold['loenudviklingBeregningsgrundlag'];

export const applyAnsaettelsesforholdToggleCleanup = (
  prev: Ansaettelsesforhold,
  field: 'harOverenskomst' | 'ansatPaaSkadestidspunktet' | 'ansaettelsesforholdOphoert' | 'harAnciennitetstillaegEfterSkadedatoen',
  nextValue: boolean
): Ansaettelsesforhold => ({ ...prev, [field]: nextValue });

// Generisk over feltbæreren, så både loenindkomst-ansættelsesforhold og EO-angivet-løn-kilden
// (EOAngivetLoenLoenudvikling) deler samme bevarings-semantik ved grundlagsskift.
export const applyLoenudviklingBeregningsgrundlagChange = <
  T extends Pick<Ansaettelsesforhold, 'loenudviklingBeregningsgrundlag'>
>(
  current: T,
  nextBeregningsgrundlag: LoenudviklingBeregningsgrundlag
): T => ({
  // Skjulte lønudvikling-felter (statistikModel, KRL-satstabel, manuelNavn, manuelTableData)
  // er fortsat committed brugerinput og skal bevares i runtime-state, sessionStorage og
  // .eo-save/load. Beregningsmotoren og validatoren gater eksplicit på
  // loenudviklingBeregningsgrundlag – stale værdier fra ikke-aktive grundlag ignoreres der,
  // ikke her.
  ...current,
  loenudviklingBeregningsgrundlag: nextBeregningsgrundlag,
});

export const applySfggBeregningskildeChange = (
  current: SfggAnsaettelsesforholdRow,
  nextBeregningskilde: SfggAnsaettelsesforholdRow['sfggBeregningskilde']
): SfggAnsaettelsesforholdRow => ({
  // Skjulte SFGG-felter er fortsat committed brugerinput og skal derfor bevares i
  // runtime-state, sessionStorage og .eo-save/load. Beregningsmotoren gater eksplicit
  // på sfggSource.kind (se sfggAnsaettelsesforhold.ts: `if (sfggSource.kind === 'ingen')`
  // og resolveSfggSegmentRateForDate) og validatoren gater tilsvarende – stale værdier
  // fra ikke-aktive beregningskilder ignoreres der, ikke her.
  ...current,
  sfggBeregningskilde: nextBeregningskilde,
});
