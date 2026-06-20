import type {
  LoenindkomstAnsaettelsesforhold,
  SygeferiegodtgoerelseAnsaettelsesforholdRow,
} from '../../../schemas/formSchemas';
import { getOverenskomstMetaById, getOverenskomstSfggPolicy } from '../../../data/overenskomstRates';
import { formatAsAmount } from '../../../utils/formatUtils';
import type { SfggReferencesatsFormula, SfggSource, SfggSourceKind } from '../engines/sygeferiegodtgoerelse';

const formatDaCount = (value: number): string => formatAsAmount(value, 0);
const ensureSentencePunctuation = (value: string): string => (
  /[.!?]$/.test(value) ? value : `${value}.`
);

export type ParsedSfggExplanatoryLine =
  | Readonly<{ kind: 'four_month_cap'; verb: 'bortfaldt' | 'bortfalder'; date: string }>
  | Readonly<{ kind: 'employment_end'; verb: 'bortfaldt' | 'bortfalder'; date: string }>;

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
      return 'Skadelidte var faglært og ansat i København, og satsen udgør';
    case 'Faglaert-Provinsen':
      return 'Skadelidte var faglært og ansat uden for København, og satsen udgør';
    case 'Ufaglaert-Koebenhavn':
      return 'Skadelidte var ufaglært og ansat i København, og satsen udgør';
    case 'Ufaglaert-Provinsen':
      return 'Skadelidte var ufaglært og ansat uden for København, og satsen udgør';
    default:
      return 'Referencesatsen udgør';
  }
};

/**
 * Note til beregningsdokumentet, når sygeferiegodtgørelse beregnes som en procentdel
 * af lønnen (ferielov-/overenskomst-efter-ferielov-sporet), og brugeren har indtastet
 * en feriepengesats for lønindkomsten, der afviger fra de lovbestemte 12,5 %. Noten
 * gør det udtrykkeligt, at SFGG uanset den indtastede sats beregnes med 12,5 %.
 */
export const buildSfggLovbestemtFeriepengeNote = (): string =>
  'Satsen udgør 12,5 % af den ferieberettigede løn.';

export const buildSfggAfterEmployerSickPayText = (
  source: Readonly<{ kind: 'manual' | 'overenskomst' }>
): string => {
  if (source.kind === 'manual') {
    return 'Der beregnes ikke sygeferiegodtgørelse på dage, hvor der betales arbejdsgiverbetalt sygeløn.';
  }
  return 'I medfør af overenskomsten beregnes ikke sygeferiegodtgørelse på dage, hvor der betales sygeløn.';
};

export const resolveSfggFoerstEfterSygeloen = (args: Readonly<{
  sfggSourceKind: SfggSourceKind;
  manualFoerstEfterSygeloen: boolean;
  overenskomstBortfalderUnderArbejdsgiverbetaltSygeloen: boolean;
}>): boolean => (
  (args.sfggSourceKind === 'manuel' && args.manualFoerstEfterSygeloen)
  || (
    (args.sfggSourceKind === 'overenskomst_direkte' || args.sfggSourceKind === 'overenskomst_ferielov')
    && args.overenskomstBortfalderUnderArbejdsgiverbetaltSygeloen
  )
);

export const SFGG_FIRST_TAF_DAY_EXCLUDED_TEXT =
  'Da skaden er fra 1. januar 2015, er der desuden først krav på sygeferiegodtgørelse fra anden sygedag.';

export const SFGG_TABLE_TOTAL_LABEL = 'Samlet';

export const SFGG_FERIEPENGE_HVIS_IKKE_SKADE_LABEL = 'Feriepenge, hvis skaden ikke var sket (+ AG-pension)';

export const SFGG_FERIEPENGE_MODTAGET_LABEL = 'Feriepenge modtaget i perioden (+ AG-pension) =';

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
    const parts = [`${formatDaCount(formula.kalenderdage)} kalenderdage`];
    if (formula.feriedage > 0) {
      parts.push(`${formatDaCount(formula.feriedage)} feriedage`);
    }
    if (formula.oevrigeFravaersdage > 0) {
      parts.push(`${formatDaCount(formula.oevrigeFravaersdage)} fraværsdage u. løn`);
    }
    if (parts.length > 1) {
      return `Antal kalenderdage i perioden (${parts.join(' - ')}) =`;
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

export const parseSfggExplanatoryLine = (
  line: string
): ParsedSfggExplanatoryLine | null => {
  const fourMonthMatch = /^Retten til sygeferiegodtgørelse er tidsbegrænset til 4 måneder og (bortfaldt|bortfalder) den (\d{2}-\d{2}-\d{4})\.$/.exec(line);
  if (fourMonthMatch) {
    const [, verb, date] = fourMonthMatch;
    return {
      kind: 'four_month_cap',
      verb: verb as 'bortfaldt' | 'bortfalder',
      date,
    };
  }

  const employmentMatch = /^Retten til sygeferiegodtgørelse (bortfaldt|bortfalder) den (\d{2}-\d{2}-\d{4}) som følge af ansættelsesforholdets ophør\.$/.exec(line);
  if (employmentMatch) {
    const [, verb, date] = employmentMatch;
    return {
      kind: 'employment_end',
      verb: verb as 'bortfaldt' | 'bortfalder',
      date,
    };
  }

  return null;
};
