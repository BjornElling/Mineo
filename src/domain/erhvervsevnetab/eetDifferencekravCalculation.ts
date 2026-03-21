import type { ErhvervsevnetabComposedValues } from '../../schemas/formSchemas';
import type { EetIssue } from './eetTypes';
import type { ISODateString } from '../../types/branded';
import { coerceToISODateString, dateToISO, parseISODate } from '../../types/branded';
// Disse tabeller importeres direkte fordi computeEetDifferencekravCalculation selv kører
// sub-beregningerne for fane 3 og 4 og sender dem videre som parametre. Dette bryder
// parametrerings-mønsteret i de øvrige beregningsfunktioner, men er en bevidst trade-off:
// differencekrav-beregningen er det naturlige aggregeringspunkt og kalder selv de andre.
import {
  aarsloenAslMax,
  erhvervsevnetabEalMax,
  reguleringssats,
  reguleringsprocentErhvervsevnetabFoer2024,
} from '../../data/lovbestemteRates';
import { getKapitaliseringsTabelData } from '../../data/kapitalisering/kapitaliseringsTabeller';
import { formatIsoDateShort } from '../../utils/dateFormatting';
import { dedupeIssuesBySeverityAndMessage } from '../../utils/issueUtils';
import { addDays } from '../../utils/dateUtils';
import { parsePercentDraft } from './eetAslAfgoerelser';
import {
  calculateAgeYearsMonths,
  interpolateFactorBeyondTable,
  interpolateFactorWithinTable,
  resolveFactorTable,
  resolveKapitaliseringsbekendtgoerelseId,
  resolveKapitaliseringTabelvalg,
  resolveSaerfaktor,
} from './eetKapitaliseringOpslag';
import { ceil0, round0, round2, round3, round4 } from '../../utils/roundingShortcuts';
import { resolveAslReguleringRateForKapAar } from './eetReguleringRater';
import { SKAERING_2007_07_01, SKAERING_2011_01_01, SKAERING_2011_06_16, SKAERING_2024_07_01 } from './eetSkaeringsdatoer';
import { computeEetLoebendeYdelser } from './eetLoebendeYdelserCalculation';
import { computeEetEalCalculation } from './eetEalCalculation';
import { computeEetKapitaliseringCalculation, WARN_NO_KAP_INPUT_ID } from './eetKapitaliseringCalculation';

// ─── Types ────────────────────────────────────────────────────────────────────

export type EetDifferencekravLoebendeAfgoerelse = Readonly<{
  rowId: string;
  afgoerelsesdato: ISODateString;
  virkningsdato: ISODateString;
  afgoerelseType: 'Midlertidig' | 'Delvist endelig' | 'Endelig';
  eetPct: number;
  fradragesTil: ISODateString;
  beloeb: number;
  fradragForetages: boolean;
}>;

export type EetDifferencekravKapitaliseretAfgoerelse = Readonly<{
  rowId: string;
  afgoerelsesdato: ISODateString;
  // null = ikke kapitaliseret
  kapitaliseringsdato: ISODateString | null;
  kapitaliseringspct: number | null;
  kapitalbelob: number | null;
  // true = kapitalisering er angivet, men datoen er efter beregningsdatoen og medregnes ikke
  kapitaliseringEfterBeregningsdato: boolean;
}>;

export type EetDifferencekravProformaKapitalisering = Readonly<{
  loebendeEetPct: number;
  kapitaliseringsdato: ISODateString;
  grundloen: number;
  erstatningsniveauPct: number;
  amBidragPct: number;
  grundydelse: number;
  reguleringsPctRounded4: number;
  aarsydelse: number;
  kapitaliseringsbekendtgoerelseLabel: string;
  folkepensionsalderLabel: string;
  alderAar: number;
  alderMaaneder: number;
  kapitaliseretPgaUnderToAarTilFp: boolean;
  faktorMaanedsAfhaengig: boolean;
  saerfaktor: number | null;
  kapitaliseringsfaktor: number;
  proformaBeloeb: number;
  koenOpdelt: boolean;
}>;

export type EetDifferencekravComputation = Readonly<{
  beregningsdato: ISODateString;
  skadesdato: ISODateString;
  dagFoerBeregningsdato: ISODateString;
  // true = skadesdato < 2011-06-16: fradrag for midlertidige/delvist endelige ydelser foretages
  fradragGaelderForFoer2011: boolean;
  ealKrav: number;
  ealEetPct: number;
  fradragLoebendeYdelser: number;
  fradragKapitaliseretEet: number;
  proformaKapitalisering: EetDifferencekravProformaKapitalisering | null;
  differencekrav: number;
  afgoerelser: readonly EetDifferencekravLoebendeAfgoerelse[];
  kapitaliseringerAfgoerelser: readonly EetDifferencekravKapitaliseretAfgoerelse[];
  // Sub-beregninger til brug i bilag-PDF'er
  loebendeComputation: import('./eetLoebendeYdelserCalculation').EetLoebendeComputation | null;
  kapComputation: import('./eetKapitaliseringCalculation').EetKapitaliseringComputation | null;
  ealComputation: import('./eetEalCalculation').EetEalComputation | null;
}>;

/** hasBlockingErrors er eksplicit her fordi differencekrav-fanen bruger den direkte;
 *  de øvrige faner udleder den fra issues.some(). */
export type EetDifferencekravCalculationResult = Readonly<{
  issues: readonly EetIssue[];
  computation: EetDifferencekravComputation | null;
  hasBlockingErrors: boolean;
}>;

type Input = Readonly<{
  erhvervsevnetab: ErhvervsevnetabComposedValues;
  skadesdato: ISODateString | undefined;
  skadelidteFodselsdato: ISODateString | undefined;
}>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const toIssue = (id: string, message: string): EetIssue => ({ id, severity: 'error', message });

const filterAslRowsKnownAtBeregningsdato = (
  rows: readonly ErhvervsevnetabComposedValues['aslAfgoerelser'][number][],
  beregningsdato: ISODateString | undefined
): readonly ErhvervsevnetabComposedValues['aslAfgoerelser'][number][] => {
  if (!beregningsdato) return rows;
  return rows.filter((row) => {
    const afgoerelsesdato = coerceToISODateString(row.afgoerelsesDato);
    const virkningsdato = coerceToISODateString(row.virkningsDato);
    // Fane 5 må kun se afgørelser, der både er truffet og har virkning senest på beregningsdatoen.
    // Rækker uden begge datoer er derfor ikke "known at beregningsdato" og udelades fail-closed.
    if (afgoerelsesdato === undefined || virkningsdato === undefined) return false;
    return afgoerelsesdato <= beregningsdato && virkningsdato <= beregningsdato;
  });
};

// ─── Proforma-kapitalisering ──────────────────────────────────────────────────

const computeProformaKapitalisering = (
  args: Readonly<{
    loebendeEetPct: number;
    beregningsdato: ISODateString;
    skadesdato: ISODateString;
    fodselsdato: ISODateString;
    grundloen: number;
    erstatningsniveau: number;
    amFaktor: number;
    before2024Skade: boolean;
    koen: ErhvervsevnetabComposedValues['koen'];
  }>,
  issues: EetIssue[]
): EetDifferencekravProformaKapitalisering | null => {
  const { loebendeEetPct, beregningsdato, skadesdato, fodselsdato } = args;

  if (!args.koen && beregningsdato < '2015-03-01') {
    issues.push(toIssue('missing-koen', 'Ved beregning før 1. marts 2015 skal køn angives.'));
    return null;
  }

  const controlBekId = resolveKapitaliseringsbekendtgoerelseId(skadesdato, beregningsdato);
  if (!controlBekId) {
    issues.push(toIssue(
      'proforma-kapitaliseringsbekendtgoerelse-missing',
      `Der findes ingen gyldig kapitaliseringsbekendtgørelse for beregningsdatoen ${formatIsoDateShort(beregningsdato)}.`
    ));
    return null;
  }

  const tabeldata = getKapitaliseringsTabelData(controlBekId);
  if (!tabeldata) {
    issues.push(toIssue(
      'proforma-kapitaliseringsbekendtgoerelse-missing',
      `Kapitaliseringsdata mangler for ${controlBekId}.`
    ));
    return null;
  }

  const tabelvalg = resolveKapitaliseringTabelvalg(tabeldata, skadesdato, fodselsdato);
  if (!tabelvalg) {
    issues.push(toIssue(
      'proforma-kapitaliseringstabel-missing',
      'Ingen kapitaliseringstabel matcher skadesdato og fødselsdato på beregningsdatoen.'
    ));
    return null;
  }

  const age = calculateAgeYearsMonths(fodselsdato, beregningsdato);
  if (!age) {
    issues.push(toIssue('proforma-kapitaliseringsfaktor-unresolved', 'Alder kan ikke beregnes på beregningsdatoen.'));
    return null;
  }

  const saerfaktor = resolveSaerfaktor(tabeldata, skadesdato);
  const useDirectSaerfaktor = tabelvalg.folkepensionsalderMaaneder - age.totalMonths <= 24;
  let kapitaliseringsfaktor: number | null = null;
  let kapitaliseretPgaUnderToAarTilFp = false;
  let koenOpdelt = false;
  const faktorMaanedsAfhaengig = skadesdato >= SKAERING_2007_07_01;

  if (useDirectSaerfaktor) {
    if (saerfaktor === null) {
      issues.push(toIssue(
        'proforma-kapitaliseringsfaktor-unresolved',
        'Særfaktor mangler for proformakapitalisering under 2 år til folkepension.'
      ));
      return null;
    }
    kapitaliseringsfaktor = round3(saerfaktor);
    kapitaliseretPgaUnderToAarTilFp = true;
  } else {
    const factorTableResult = resolveFactorTable(tabeldata, tabelvalg.tabel, args.koen);
    koenOpdelt = factorTableResult.koenOpdelt;
    const factorRows = factorTableResult.rows;
    if (!factorRows || factorRows.length === 0) {
      if (factorTableResult.reason === 'missing-koen') {
        issues.push(toIssue('missing-koen', 'Ved kapitalisering før 1. marts 2015 skal køn angives.'));
      } else {
        issues.push(toIssue('proforma-kapitaliseringstabel-missing', `Ingen kapitaliseringsfaktorer for tabel ${tabelvalg.tabel}.`));
      }
      return null;
    }

    const minAge = factorRows[0]?.alder;
    if (minAge === undefined || age.years < minAge) {
      issues.push(toIssue(
        'proforma-kapitaliseringsalder-under-minimum',
        `Ingen kapitaliseringsfaktor for alder (${age.years} år, ${age.months} mdr.) — tabellen starter ved ${minAge} år.`
      ));
      return null;
    }

    const withinTable = interpolateFactorWithinTable(factorRows, age, faktorMaanedsAfhaengig);
    if (withinTable !== null) {
      kapitaliseringsfaktor = round3(withinTable);
    } else {
      const maxAge = factorRows[factorRows.length - 1]?.alder;
      const isBeyondLastWholeYearInMonthDependentTable =
        faktorMaanedsAfhaengig &&
        maxAge !== undefined &&
        age.years === maxAge &&
        age.months > 0;
      if (maxAge !== undefined && age.years <= maxAge && !isBeyondLastWholeYearInMonthDependentTable) {
        issues.push(toIssue(
          'proforma-kapitaliseringsfaktor-unresolved',
          `Ingen kapitaliseringsfaktor for alder (${age.years} år, ${age.months} mdr.) i tabel ${tabelvalg.tabel}.`
        ));
        return null;
      }
      if (saerfaktor === null) {
        issues.push(toIssue(
          'proforma-kapitaliseringsfaktor-unresolved',
          'Kapitaliseringsfaktor kan ikke beregnes, fordi særfaktor mangler.'
        ));
        return null;
      }
      const beyondTable = interpolateFactorBeyondTable(factorRows, age, tabelvalg.folkepensionsalderMaaneder, saerfaktor, faktorMaanedsAfhaengig);
      if (beyondTable === null) {
        issues.push(toIssue(
          'proforma-kapitaliseringsfaktor-unresolved',
          `Kapitaliseringsfaktor kan ikke beregnes for alder (${age.years} år, ${age.months} mdr.).`
        ));
        return null;
      }
      kapitaliseringsfaktor = round3(beyondTable);
    }
  }

  const kapitaliseringsaar = Number.parseInt(beregningsdato.slice(0, 4), 10);
  const rateInfo = resolveAslReguleringRateForKapAar(kapitaliseringsaar, args.before2024Skade, issues);
  if (!rateInfo || kapitaliseringsfaktor === null) return null;

  const grundydelse = round2(args.grundloen * (loebendeEetPct / 100) * args.erstatningsniveau * args.amFaktor);
  const reguleringFoer2024 = reguleringsprocentErhvervsevnetabFoer2024[2024];
  if (args.before2024Skade && !Number.isFinite(reguleringFoer2024)) {
    issues.push(toIssue('proforma-reguleringssats-missing', 'Reguleringssats mangler for år 2024.'));
    return null;
  }
  const grundydelse2024 = args.before2024Skade
    ? round2(grundydelse * (1 + reguleringFoer2024 / 100))
    : grundydelse;
  const effektivGrundydelse = args.before2024Skade && kapitaliseringsaar >= 2024 ? grundydelse2024 : grundydelse;
  const aarsydelse = round2(effektivGrundydelse * rateInfo.factor);
  const proformaBeloeb = ceil0(aarsydelse * kapitaliseringsfaktor);
  const typeLabel = tabeldata.kapitaliseringsType === 'vejl' ? 'Vejl.' : 'Bkg.';

  return {
    loebendeEetPct,
    kapitaliseringsdato: beregningsdato,
    grundloen: args.grundloen,
    erstatningsniveauPct: round0(args.erstatningsniveau * 100),
    amBidragPct: round0((1 - args.amFaktor) * 100),
    grundydelse: effektivGrundydelse,
    reguleringsPctRounded4: round4(rateInfo.reguleringPct),
    aarsydelse,
    kapitaliseringsbekendtgoerelseLabel: `${typeLabel} ${controlBekId}, tabel ${tabelvalg.tabel}`,
    folkepensionsalderLabel: tabelvalg.folkepensionsalderLabel,
    alderAar: age.years,
    alderMaaneder: age.months,
    kapitaliseretPgaUnderToAarTilFp,
    faktorMaanedsAfhaengig,
    saerfaktor,
    kapitaliseringsfaktor,
    proformaBeloeb,
    koenOpdelt,
  };
};

// ─── Beregning af løbende EET-pct der skal proformakapitaliseres ──────────────

const resolveLoebendeEetPct = (
  afgoerelser: readonly {
    eetPct: number;
    afgoerelseType: string;
    afgoerelsesdato: ISODateString;
    virkningsdato: ISODateString;
  }[],
  // Kapitaliseringsdata fra råinput — filtreret på kap.dato <= beregningsdato,
  // så fremtidige kapitaliseringer ikke medregnes i rest-EET.
  kapitaliseringer: readonly { kapPct: number }[]
): number => {
  if (afgoerelser.length === 0) return 0;

  // Tie-breaking matches fane 4's resolveEetPctFromAslRows:
  // 1. Latest afgørelsesdato, 2. Latest virkningsdato, 3. Endelig > Delvist endelig > rest
  // Invariant: senestEetPct antages at være >= alle tidligere afgørelsers EET-procenter.
  // Domænet tillader ikke reduktion i EET-procent, så sumKapPct fratrukket senestEetPct
  // er altid >= 0 (clamped af Math.max). Hvis denne invariant brydes (f.eks. via en
  // afgørelse der sætter EET lavere end en tidligere) returneres 0, ikke negativt.
  const latestAfgoerelsesdato = afgoerelser.reduce<ISODateString>(
    (latest, a) => (a.afgoerelsesdato > latest ? a.afgoerelsesdato : latest),
    afgoerelser[0]!.afgoerelsesdato
  );

  const sameDate = afgoerelser.filter((a) => a.afgoerelsesdato === latestAfgoerelsesdato);

  const latestVirkningsdato = sameDate.reduce<ISODateString>(
    (latest, a) => (a.virkningsdato > latest ? a.virkningsdato : latest),
    sameDate[0]!.virkningsdato
  );

  const sameVirkningsdato = sameDate.filter((a) => a.virkningsdato === latestVirkningsdato);
  const endelig = sameVirkningsdato.filter((a) => a.afgoerelseType === 'Endelig');
  const delvist = sameVirkningsdato.filter((a) => a.afgoerelseType === 'Delvist endelig');
  const selected = endelig[0] ?? delvist[0] ?? sameVirkningsdato[0];
  if (!selected) return 0;

  const senestEetPct = selected.eetPct;
  const sumKapPct = kapitaliseringer.reduce((sum, k) => sum + k.kapPct, 0);
  return Math.max(0, senestEetPct - sumKapPct);
};

// ─── Bestemmer om fradrag for løbende ydelser foretages pr. afgørelse ─────────

const skalFradragForetages = (
  afgoerelseType: 'Midlertidig' | 'Delvist endelig' | 'Endelig',
  skadesdato: ISODateString
): boolean => {
  if (skadesdato < SKAERING_2011_06_16) return true;
  return afgoerelseType === 'Endelig';
};

// ─── Beregning ────────────────────────────────────────────────────────────────

export const computeEetDifferencekravCalculation = (input: Input): EetDifferencekravCalculationResult => {
  const beregningsdato = coerceToISODateString(input.erhvervsevnetab.beregningsdato);
  const skadesdato = input.skadesdato;
  const fodselsdato = input.skadelidteFodselsdato;
  const aslRowsKnownAtBeregningsdato = filterAslRowsKnownAtBeregningsdato(input.erhvervsevnetab.aslAfgoerelser, beregningsdato);
  const filteredErhvervsevnetab = {
    ...input.erhvervsevnetab,
    aslAfgoerelser: [...aslRowsKnownAtBeregningsdato],
  };

  // ─── Kør eal-beregning (fane 4) ───────────────────────────────────────────
  const ealResult = computeEetEalCalculation({
    erhvervsevnetab: filteredErhvervsevnetab,
    skadesdato,
    skadelidteFodselsdato: fodselsdato,
    reguleringssats,
    erhvervsevnetabEalMax,
    aarsloenAslMax,
  });

  // ─── Kør kapitaliserings-beregning (fane 3) ───────────────────────────────
  const kapResult = computeEetKapitaliseringCalculation({
    erhvervsevnetab: filteredErhvervsevnetab,
    skadesdato,
    skadelidteFodselsdato: fodselsdato,
  });

  // ─── Kør løbende ydelser med ophørsdato = beregningsdato − 1 dag ─────────
  let loebendeResult: ReturnType<typeof computeEetLoebendeYdelser> | null = null;
  let dagFoerBeregningsdato: ISODateString | null = null;

  if (beregningsdato) {
    const parsedBerDato = parseISODate(beregningsdato);
    if (parsedBerDato) {
      const dayBefore = dateToISO(addDays(parsedBerDato, -1));
      if (dayBefore) {
        dagFoerBeregningsdato = dayBefore;
        loebendeResult = computeEetLoebendeYdelser({
          erhvervsevnetab: { ...filteredErhvervsevnetab, beregningsdato: dayBefore },
          skadesdato,
          skadelidteFodselsdato: fodselsdato,
        });
      }
    }
  }

  // ─── Aggreger issues fra fane 2, 3 og 4 ──────────────────────────────────
  const allSourceIssues: EetIssue[] = [];

  for (const issue of ealResult.issues) {
    allSourceIssues.push(issue);
  }
  for (const issue of kapResult.issues) {
    if (issue.id !== WARN_NO_KAP_INPUT_ID) allSourceIssues.push(issue);
  }
  if (loebendeResult) {
    for (const issue of loebendeResult.issues) {
      allSourceIssues.push(issue);
    }
  } else if (!beregningsdato) {
    allSourceIssues.push({ id: 'beregningsdato-missing', severity: 'error', message: 'Beregningsdato er ikke udfyldt.' });
  } else if (!dagFoerBeregningsdato) {
    allSourceIssues.push({ id: 'beregningsdato-invalid', severity: 'error', message: 'Beregningsdato er ugyldig.' });
  }

  // ─── Fradrag 3: Proformakapitalisering (issues indgår i blocking-evaluering) ──
  // Proformaberegningen kræver eal-computation og alle stamdata — kør kun hvis
  // disse forudsætninger er til stede, så vi undgår fejl-stacking ovenpå allerede
  // kendte blokerende fejl.
  const proformaIssues: EetIssue[] = [];
  let proformaKapitalisering: EetDifferencekravProformaKapitalisering | null = null;
  let loebendeEetPct = 0;

  if (ealResult.computation && beregningsdato && skadesdato && fodselsdato && dagFoerBeregningsdato) {
    const loebendeComputation = loebendeResult?.computation ?? null;

    const before2024Skade = skadesdato < SKAERING_2024_07_01;
    const from2011 = skadesdato >= SKAERING_2011_01_01;
    const erstatningsniveau = from2011 ? 0.83 : 0.8;
    const amFaktor = from2011 ? 0.92 : 1;
    // Grundlønnen genbruges fra fane 2's computation frem for at rekonstruere den lokalt.
    // Invariant: loebendeEetPct kan kun blive > 0 når loebendeComputation findes; ?? 0 er kun defensivt.
    const grundloen = loebendeComputation?.grundloen ?? 0;

    // Bestem løbende EET-pct til proformakapitalisering.
    // Afgørelseslisten hentes fra løbende-computation til tie-breaking (seneste afgørelse).
    // Kapitaliseringsprocenterne hentes fra fane 3's resolvede computation og filtreres:
    // kun kapitaliseringer med dato <= beregningsdato medregnes.
    const kapitaliseringerForProforma =
      kapResult.computation?.afgoerelser
        .filter((afgoerelse) => afgoerelse.kapitaliseringsdato <= beregningsdato && afgoerelse.kapitaliseringspct > 0)
        .map((afgoerelse) => ({ kapPct: afgoerelse.kapitaliseringspct })) ?? [];

    loebendeEetPct = loebendeComputation
      ? resolveLoebendeEetPct(loebendeComputation.afgoerelser, kapitaliseringerForProforma)
      : 0;

    if (loebendeEetPct > 0 && grundloen > 0) {
      proformaKapitalisering = computeProformaKapitalisering(
        {
          loebendeEetPct,
          beregningsdato,
          skadesdato,
          fodselsdato,
          grundloen,
          erstatningsniveau,
          amFaktor,
          before2024Skade,
          koen: input.erhvervsevnetab.koen,
        },
        proformaIssues
      );
    }
  }

  // Proforma-issues merges ind før blocking-evaluering, så fejl i proformaberegningen
  // blokerer download på linje med fejl fra fane 2, 3 og 4.
  for (const issue of proformaIssues) {
    allSourceIssues.push(issue);
  }

  // 'no-endelig-afgoerelser' er kun relevant på fane 3 og filtreres altid væk fra fane 5.
  // F5 proformakapitaliserer uafhængigt af om der tidligere er foretaget kapitalisering.
  const deduped = dedupeIssuesBySeverityAndMessage(allSourceIssues)
    .filter((issue) => issue.id !== 'no-endelig-afgoerelser');
  const hasAslAfgoerelserEmpty = deduped.some((issue) => issue.id === 'asl-afgoerelser-empty');
  // 'eet-pct-missing' undertrykkes når afgørelsestabellen er tom.
  // Ellers vises både den generelle tom-tabel-fejl og den afledte feltfejl for samme rodproblem.
  const aggregatedIssues = hasAslAfgoerelserEmpty
    ? deduped.filter((issue) => issue.id !== 'eet-pct-missing')
    : deduped;

  const blockingErrors = aggregatedIssues.filter((issue) => issue.severity === 'error');

  const hasBlockingErrors = blockingErrors.length > 0;

  if (hasBlockingErrors || !ealResult.computation || !beregningsdato || !skadesdato || !fodselsdato || !dagFoerBeregningsdato) {
    return { issues: aggregatedIssues, computation: null, hasBlockingErrors };
  }

  const loebendeComputation = loebendeResult?.computation ?? null;

  // ─── Fradrag 1: Løbende ydelser ───────────────────────────────────────────
  const ealKrav = ealResult.computation.ealKrav;
  const ealEetPct = ealResult.computation.eetPct;

  const loebendeAfgoerelser: EetDifferencekravLoebendeAfgoerelse[] = [];
  let fradragLoebendeYdelser = 0;

  if (loebendeComputation) {
    // Sorter afgørelser på virkningsdato for at kunne bestemme slutdato per afgørelse:
    // slutdato = dagen før næste afgørelses virkningsdato, eller dagFoerBeregningsdato for den seneste.
    const sortedByVirkningsdato = [...loebendeComputation.afgoerelser].sort(
      (a, b) => a.virkningsdato.localeCompare(b.virkningsdato)
    );

    for (let i = 0; i < sortedByVirkningsdato.length; i++) {
      const afgoerelse = sortedByVirkningsdato[i]!;
      const fradragesTil = afgoerelse.ophoerDato;

      const foretages = skalFradragForetages(afgoerelse.afgoerelseType, skadesdato);
      const beloeb = foretages ? afgoerelse.iAltBeregnetEet : 0;
      fradragLoebendeYdelser += beloeb;
      loebendeAfgoerelser.push({
        rowId: afgoerelse.rowId,
        afgoerelsesdato: afgoerelse.afgoerelsesdato,
        virkningsdato: afgoerelse.virkningsdato,
        afgoerelseType: afgoerelse.afgoerelseType,
        eetPct: afgoerelse.eetPct,
        fradragesTil,
        beloeb,
        fradragForetages: foretages,
      });
    }
  }

  // ─── Fradrag 2: Kapitaliseret EET ─────────────────────────────────────────
  const kapAfgoerelser: EetDifferencekravKapitaliseretAfgoerelse[] = [];
  let fradragKapitaliseretEet = 0;

  const aslRowsForDisplay = aslRowsKnownAtBeregningsdato
    .filter((row) => {
      const eetPct = parsePercentDraft(row.eetPct);
      return eetPct !== undefined && eetPct > 0 && coerceToISODateString(row.afgoerelsesDato) !== undefined;
    })
    .map((row) => {
      const afgoerelsesdato = coerceToISODateString(row.afgoerelsesDato)!;
      const kapComp = kapResult.computation?.afgoerelser.find((a) => a.rowId === row.id);
      // Kapitalisering medregnes kun hvis kapitaliseringsdatoen er <= beregningsdatoen.
      // Er kapitaliseringsdatoen efter beregningsdatoen, vises afgørelsen som "ikke kapitaliseret
      // på beregningsdatoen" og bidrager ikke til fradragKapitaliseretEet.
      if (kapComp && kapComp.kapitaliseringsdato <= beregningsdato) {
        fradragKapitaliseretEet += kapComp.kapitalbelob;
        return {
          rowId: row.id,
          afgoerelsesdato,
          kapitaliseringsdato: kapComp.kapitaliseringsdato,
          kapitaliseringspct: kapComp.kapitaliseringspct,
          kapitalbelob: kapComp.kapitalbelob,
          kapitaliseringEfterBeregningsdato: false,
        };
      }
      if (kapComp && kapComp.kapitaliseringsdato > beregningsdato) {
        return {
          rowId: row.id,
          afgoerelsesdato,
          kapitaliseringsdato: null as ISODateString | null,
          kapitaliseringspct: null as number | null,
          kapitalbelob: null as number | null,
          kapitaliseringEfterBeregningsdato: true,
        };
      }
      return {
        rowId: row.id,
        afgoerelsesdato,
        kapitaliseringsdato: null as ISODateString | null,
        kapitaliseringspct: null as number | null,
        kapitalbelob: null as number | null,
        kapitaliseringEfterBeregningsdato: false,
      };
    })
    .sort((a, b) => a.afgoerelsesdato.localeCompare(b.afgoerelsesdato));

  kapAfgoerelser.push(...aslRowsForDisplay);

  // ─── Endeligt differencekrav ──────────────────────────────────────────────
  const differencekrav = Math.max(
    0,
    round0(ealKrav - fradragLoebendeYdelser - fradragKapitaliseretEet - (proformaKapitalisering?.proformaBeloeb ?? 0))
  );

  return {
    issues: aggregatedIssues,
    hasBlockingErrors: false,
    computation: {
      beregningsdato,
      skadesdato,
      dagFoerBeregningsdato,
      fradragGaelderForFoer2011: skadesdato < SKAERING_2011_06_16,
      ealKrav,
      ealEetPct,
      fradragLoebendeYdelser,
      fradragKapitaliseretEet,
      proformaKapitalisering,
      differencekrav,
      afgoerelser: loebendeAfgoerelser,
      kapitaliseringerAfgoerelser: kapAfgoerelser,
      loebendeComputation: loebendeResult?.computation ?? null,
      kapComputation: kapResult.computation,
      ealComputation: ealResult.computation,
    },
  };
};
