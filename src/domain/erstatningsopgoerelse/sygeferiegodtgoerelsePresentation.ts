import type {
  LoenindkomstAnsaettelsesforhold,
  SygeferiegodtgoerelseAnsaettelsesforholdRow,
} from '../../schemas/formSchemas';
import { getOverenskomstMetaById, getOverenskomstSfggPolicy } from '../../data/overenskomstRates';
import type { SfggReferencesatsFormula, SfggSource, SfggSourceKind } from './sygeferiegodtgoerelse';

const formatDaCount = (value: number): string => value.toLocaleString('da-DK');
const ensureSentencePunctuation = (value: string): string => (
  /[.!?]$/.test(value) ? value : `${value}.`
);

export const buildSfggIntroText = (
  sfggRow: SygeferiegodtgoerelseAnsaettelsesforholdRow | undefined,
  employment: LoenindkomstAnsaettelsesforhold,
  source: SfggSource
): string | null => {
  if (source.kind === 'manuel') {
    const manualSource = sfggRow?.sfggManuelBeloebIHenholdTil?.trim();
    if (manualSource) {
      return ensureSentencePunctuation(`Sygeferiegodtgørelse beregnes i henhold til ${manualSource}`);
    }
    return 'Sygeferiegodtgørelse beregnes på baggrund af en manuelt angivet sats.';
  }

  if (source.kind === 'ferielov') {
    return 'Sygeferiegodtgørelse beregnes i henhold til ferieloven.';
  }

  if (source.kind === 'overenskomst_direkte' || source.kind === 'overenskomst_ferielov') {
    const overenskomstNavn = employment.overenskomstId
      ? (getOverenskomstMetaById(employment.overenskomstId)?.navn ?? employment.overenskomstId.trim())
      : null;
    const sfggPolicy = employment.overenskomstId
      ? getOverenskomstSfggPolicy(employment.overenskomstId)
      : undefined;

    if (!overenskomstNavn) {
      return 'Sygeferiegodtgørelse beregnes i henhold til overenskomsten.';
    }

    if (sfggPolicy?.fravigerFerielov === false) {
      return `Sygeferiegodtgørelse beregnes i henhold til ${overenskomstNavn}, der følger ferielovens regler.`;
    }

    return `Sygeferiegodtgørelse beregnes i henhold til ${overenskomstNavn}.`;
  }

  return null;
};

export const resolveSfggReferenceperiodeAuthorityText = (sourceKind: SfggSourceKind): string | null => {
  if (sourceKind === 'ferielov') return 'ferieloven';
  if (sourceKind === 'overenskomst_ferielov') return 'overenskomsten';
  return null;
};

export const resolveSfggReferenceperiodeLabel = (employment: LoenindkomstAnsaettelsesforhold): string => {
  if (!employment.overenskomstId) return '4 uger';
  return getOverenskomstSfggPolicy(employment.overenskomstId)?.referenceperiodeLabel ?? '4 uger';
};

export const resolveSfggDifferentieretSatsLabel = (
  sfggSatsvalg: SygeferiegodtgoerelseAnsaettelsesforholdRow['sfggSatsvalg']
): string => {
  switch (sfggSatsvalg) {
    case 'Faglaert-Koebenhavn':
      return 'Skadelidte var faglært og ansat i København, og satsen er i overenskomsten fastsat til';
    case 'Faglaert-Provinsen':
      return 'Skadelidte var faglært og ansat uden for København, og satsen er i overenskomsten fastsat til';
    case 'Ufaglaert-Koebenhavn':
      return 'Skadelidte var ufaglært og ansat i København, og satsen er i overenskomsten fastsat til';
    case 'Ufaglaert-Provinsen':
      return 'Skadelidte var ufaglært og ansat uden for København, og satsen er i overenskomsten fastsat til';
    default:
      return 'Referencesatsen er i overenskomsten fastsat til';
  }
};

export const buildSfggAfterEmployerSickPayText = (
  source: Readonly<{ kind: 'manual' | 'overenskomst' }>
): string => {
  if (source.kind === 'manual') {
    return 'Der beregnes ikke sygeferiegodtgørelse på dage, hvor der betales arbejdsgiverbetalt sygeløn.';
  }
  return 'I medfør af overenskomsten beregnes ikke sygeferiegodtgørelse på dage, hvor der betales sygeløn.';
};

export const SFGG_FIRST_TAF_DAY_EXCLUDED_TEXT =
  'Da skaden er fra 1. januar 2015, er der desuden først krav på sygeferiegodtgørelse fra anden sygedag.';

export const buildSfggNoEligibleDaysReason = (
  dayBasis: 'kalenderdage' | 'arbejdsdage'
): string => (
  dayBasis === 'kalenderdage'
    ? 'Ingen kalenderdage i SFGG-perioden'
    : 'Ingen arbejdsdage i SFGG-perioden'
);

export const buildSfggReferenceperiodeCountLabel = (
  formula: SfggReferencesatsFormula
): string => {
  if (formula.divisorLabel === 'kalenderdage') {
    if (formula.oevrigeFravaersdage > 0) {
      return `Antal kalenderdage i perioden (${formatDaCount(formula.kalenderdage)} kalenderdage - ${formatDaCount(formula.oevrigeFravaersdage)} fraværsdage u. løn) =`;
    }
    return 'Antal kalenderdage i perioden';
  }

  const ferieOgFravaersdage = formula.feriedage + formula.oevrigeFravaersdage;
  if (formula.shDage + ferieOgFravaersdage > 0) {
    const parts = [`${formatDaCount(formula.hverdage)} hverdage`];
    if (formula.shDage > 0) {
      parts.push(`${formatDaCount(formula.shDage)} SH-dage`);
    }
    if (ferieOgFravaersdage > 0) {
      parts.push(`${formatDaCount(ferieOgFravaersdage)} ferie- og fraværsdage`);
    }
    return `Antal arbejdsdage (${parts.join(' - ')}) =`;
  }
  return 'Antal arbejdsdage';
};
