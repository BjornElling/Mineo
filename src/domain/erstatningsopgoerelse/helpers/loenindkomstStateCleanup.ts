import type { ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';

type Ansaettelsesforhold = ErstatningsopgoerelseValues['loenindkomstAnsaettelsesforhold'][number];
type SfggAnsaettelsesforholdRow = ErstatningsopgoerelseValues['sfggAnsaettelsesforhold'][number];

export const applyAnsaettelsesforholdToggleCleanup = (
  prev: Ansaettelsesforhold,
  field: 'harOverenskomst' | 'ansatPaaSkadestidspunktet' | 'ansaettelsesforholdOphoert' | 'harAnciennitetstillaegEfterSkadesdatoen',
  nextValue: boolean
): Ansaettelsesforhold => ({ ...prev, [field]: nextValue });

export const sanitizeSfggRowForBeregningskilde = (
  current: SfggAnsaettelsesforholdRow,
  nextBeregningskilde: SfggAnsaettelsesforholdRow['sfggBeregningskilde'],
  visibility: Readonly<{
    showReferenceperiodeFields: boolean;
    showManualFields: boolean;
    showSatsvalgField: boolean;
  }>
): SfggAnsaettelsesforholdRow => {
  // Visibility-flags kommer bevidst fra kaldsstedet. Cleanup skal følge præcis den samme
  // policy-/renderlogik som UI'et bruger for den kommende tilstand, så skjulte felter ryddes
  // uden at denne helper selv duplikerer policy-opslag. Ved ændringer i SFGG-visibility skal
  // kaldsstedets beregning af disse flags opdateres samtidig.
  const next: SfggAnsaettelsesforholdRow = {
    ...current,
    sfggBeregningskilde: nextBeregningskilde,
  };

  if (!visibility.showReferenceperiodeFields) {
    next.sfggReferenceperiodeFra = undefined;
    next.sfggReferenceperiodeTil = undefined;
    next.sfggReferenceperiodeFravaersdageUdenLoen = 0;
  }

  if (!visibility.showManualFields) {
    next.sfggManuelDagssats = undefined;
    next.sfggManuelBeloebIHenholdTil = undefined;
    next.sfggManuelFoerstEfterSygeloen = 'Nej';
  }

  if (!visibility.showSatsvalgField) {
    next.sfggSatsvalg = undefined;
  }

  return next;
};
