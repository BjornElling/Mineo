import type { ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';
import { DEFAULT_ANCIENNITET_FIELDS } from './erstatningsopgoerelseInitialValues';

type Ansaettelsesforhold = ErstatningsopgoerelseValues['loenindkomstAnsaettelsesforhold'][number];
type SfggAnsaettelsesforholdRow = ErstatningsopgoerelseValues['sfggAnsaettelsesforhold'][number];

export const applyAnsaettelsesforholdToggleCleanup = (
  prev: Ansaettelsesforhold,
  field: 'harOverenskomst' | 'ansatPaaSkadestidspunktet' | 'ansaettelsesforholdOphoert' | 'harAnciennitetstillaegEfterSkadesdatoen',
  nextValue: boolean,
  defaultOverenskomstFilter: Ansaettelsesforhold['overenskomstFilter']
): Ansaettelsesforhold => {
  const next: Ansaettelsesforhold = { ...prev, [field]: nextValue };

  if (field === 'harOverenskomst' && !nextValue) {
    next.overenskomstId = undefined;
    next.overenskomstFilter = defaultOverenskomstFilter;
  }

  if (field === 'ansatPaaSkadestidspunktet' && !nextValue) {
    next.ansaettelsesforholdOphoert = false;
    next.sidsteArbejdsdag = undefined;
  }

  if (field === 'ansaettelsesforholdOphoert' && !nextValue) {
    next.sidsteArbejdsdag = undefined;
  }

  if (field === 'harAnciennitetstillaegEfterSkadesdatoen' && !nextValue) {
    next.anciennitetstillaegDato = DEFAULT_ANCIENNITET_FIELDS.anciennitetstillaegDato;
    next.anciennitetstillaegSatsAngivesPer = DEFAULT_ANCIENNITET_FIELDS.anciennitetstillaegSatsAngivesPer;
    next.anciennitetstillaegSats = DEFAULT_ANCIENNITET_FIELDS.anciennitetstillaegSats;
  }

  return next;
};

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
