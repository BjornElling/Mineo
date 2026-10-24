import type {
  LoenindkomstAnsaettelsesforhold,
  SygeferiegodtgoerelseAnsaettelsesforholdRow,
} from '../../../schemas/formSchemas';
import { getOverenskomstMetaById, getOverenskomstSfggPolicy } from '../../../data/overenskomstRates';
import { formatAsAmount, formatAsAmountTrimmed } from '../../../utils/formatUtils';
import { isoToDanish } from '../../../types/branded';
import type { SfggAfkortning } from '../engines/sfggPeriodisering';
import type { SfggReferencesatsFormula } from '../engines/sfggReferencesats';
import type { SfggSource, SfggSourceKind } from '../engines/sfggKilde';
import type { SygeferiegodtgoerelseSegment } from '../engines/sfggResult';
import type { MoneyOre } from '../../money/money';

/** Viser motorens faktiske forhold, da et afrundet indeks alene kan give en anden øresats. */
export const buildSfggReguleretSatsLines = (
  referencesatsOre: MoneyOre,
  segments: readonly SygeferiegodtgoerelseSegment[],
): readonly string[] => {
  const visteKlTrin = new Set<string>();
  return segments.flatMap((segment): readonly string[] => {
    if (segment.klTrin) {
      // Et senere segment bærer hele kæden. Skriv hvert faktisk trin én gang i bilaget.
      const nyeTrin = segment.klTrin.filter((trin) => {
        const key = `${trin.retning}:${trin.dato}`;
        if (visteKlTrin.has(key)) return false;
        visteKlTrin.add(key);
        return true;
      });
      if (nyeTrin.length === 0) return [];
      return [
        `${isoToDanish(segment.fra)} - ${isoToDanish(segment.til)}:`,
        ...nyeTrin.map((trin) => `${isoToDanish(trin.dato)}: ${formatAsAmount(trin.loenFoer)} `
          + `${trin.retning === 'frem' ? 'x' : '/'} (100 % + ${formatAsAmount(trin.pct, 2)} %) `
          + `= ${formatAsAmount(trin.loenEfter)} kr.`),
      ];
    }
    const grundlag = segment.reguleringsgrundlag;
    if (!grundlag) return [];
    return [`${isoToDanish(segment.fra)} - ${isoToDanish(segment.til)}: `
      + `${formatAsAmount(referencesatsOre / 100)} x ${formatAsAmountTrimmed(grundlag.periodValue, 6)} `
      + `/ ${formatAsAmountTrimmed(grundlag.referenceValue, 6)} = ${formatAsAmount(segment.satsOre / 100)} kr.`];
  });
};

const formatDaCount = (value: number): string => formatAsAmount(value, 0);
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

/**
 * Referenceperioden er fri (udviklerafgørelse 2026-10-24, BB-321): reglens længde er kun vejledende, og perioden kan
 * fx være en kalendermåned (én lønseddel) eller ligge langt tilbage. Bilaget påstår derfor ingen længde.
 */
export const SFGG_REFERENCEPERIODE_INTRO_TEXT = 'Opgøres som den gennemsnitlige feriepengebetaling i referenceperioden.';

/**
 * Skærmens forklaring ved «Referenceperiode». Udgangspunktet er overenskomstens længde, når kilden er en overenskomst,
 * der følger ferieloven med egen længde; ellers ferielovens 4 uger (BB-321).
 */
export const buildSfggReferenceperiodeTooltip = (
  sourceKind: SfggSourceKind,
  employment: Pick<LoenindkomstAnsaettelsesforhold, 'overenskomstId'>
): string => {
  const overenskomstLabel = sourceKind === 'overenskomst_ferielov' && employment.overenskomstId
    ? getOverenskomstSfggPolicy(employment.overenskomstId)?.referenceperiodeLabel
    : undefined;
  return `Udgangspunktet er ${overenskomstLabel ?? '4 uger'} før sygeforløbet. Ved månedsløn bruges typisk en hel `
    + 'kalendermåned, så perioden svarer til én lønseddel. Perioden kan ligge længere tilbage, hvis de seneste '
    + 'lønsedler ikke afspejler det normale lønniveau.';
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

// Uden «=»: linjen er et fradrag, ikke et resultat (BB-328).
export const SFGG_FERIEPENGE_MODTAGET_LABEL = 'Feriepenge modtaget i perioden (+ AG-pension)';

/**
 * Ingen dage at beregne sygeferiegodtgørelse for i erstatningsperioden – fx fordi 4-månedersgrænsen er nået før
 * perioden, ansættelsen er ophørt, eller der er betalt sygeløn hele perioden. Det er et gyldigt resultat (kravet er
 * 0 kr.), ikke en fejl i indtastningen (BB-320).
 */
export const buildSfggNoEligibleDaysReason = (
  dayBasis: 'kalenderdage' | 'arbejdsdage'
): string => (
  dayBasis === 'kalenderdage'
    ? 'Ingen kalenderdage med sygeferiegodtgørelse i erstatningsperioden'
    : 'Ingen arbejdsdage med sygeferiegodtgørelse i erstatningsperioden'
);

// Beskederne bruger feltets navn i apostroffer, når det er flere ord – samme form som «Fejl og advarsler»s øvrige
// linjer (`quoteLabelIfMultiWord`, udviklerafgørelse 2026-10-24, BB-331).
export const SFGG_BEREGNINGSKILDE_MANGLER_MESSAGE = "'Sygeferiegodtgørelse beregnes ud fra' er ikke valgt";
export const SFGG_MANUEL_DAGSSATS_MANGLER_MESSAGE = "'Dagssats for sygeferiegodtgørelse' er ikke angivet";
export const SFGG_SATSVALG_MANGLER_MESSAGE = 'Uddannelse og arbejdssted for sygeferiegodtgørelse er ikke valgt';

/**
 * «Overenskomst» er valgt som grundlag, men kortet har ingen overenskomst. Beskeden siger, hvad brugeren kan gøre –
 * slå togglen til eller vælge en, eller vælge Ferieloven – frem for at pege på et skjult felt (BB-330).
 */
export const buildSfggOverenskomstManglerBesked = (
  employment: Pick<LoenindkomstAnsaettelsesforhold, 'harOverenskomst'>
): string => employment.harOverenskomst
  ? "Sygeferiegodtgørelse beregnes ud fra overenskomst, men der er ikke valgt en overenskomst – vælg en under 'Vælg overenskomst', eller vælg 'Ferieloven'"
  : "Sygeferiegodtgørelse beregnes ud fra overenskomst, men ansættelsesforholdet har ingen overenskomst – slå 'Overenskomst' til, eller vælg 'Ferieloven'";

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

/**
 * Formatterer en struktureret SFGG-afkortning til bilagets venstre/højre-linje.
 * Både 4-måneders-afkortningen og ansættelsesophør vises som en venstre-tekst + dato i højre kolonne.
 */
export const formatSfggAfkortningPdfLine = (
  afkortning: SfggAfkortning
): Readonly<{ left: string; right: string }> => {
  const dato = isoToDanish(afkortning.dato) ?? afkortning.dato;
  if (afkortning.aarsag === 'cap4mdr') {
    return {
      left: 'Skaden er før 01-01-2015 og retten er begrænset til 4 måneder, som ophørte',
      right: dato,
    };
  }
  return {
    left: `Retten ${afkortning.verbum} ved ansættelsesforholdets ophør`,
    right: dato,
  };
};
