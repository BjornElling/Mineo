import type { ErhvervsevnetabValues } from '../../schemas/formSchemas';
import type { ISODateString } from '../../types/branded';
import { coerceToISODateString, dateToISO, parseISODate } from '../../types/branded';
import {
  ASL_MAX_AARSLOEN_2003,
  ASL_MAX_AARSLOEN_2024,
  aarsloenMax,
  erhvervsevnetabMax,
  reguleringssats,
  reguleringsprocentErhvervsevnetabFoer2024,
} from '../../data/regulationRates';
import { getKapitaliseringsTabelData } from '../../data/kapitalisering/kapitaliseringsTabeller';
import { amountValueToNumber } from '../../utils/expressionAmount';
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
  type AgeYearsMonths,
} from './eetKapitaliseringOpslag';
import { ceil0, round0, round2, round3, round4, roundNearest1000 } from './eetRounding';
import { resolveAslReguleringRateForKapAar } from './eetReguleringRater';
import { SKAERING_2011_01_01, SKAERING_2011_06_16, SKAERING_2024_07_01 } from './eetSkaeringsdatoer';
import { computeEetLoebendeYdelser } from './eetLoebendeYdelserCalculation';
import { computeEetEalCalculation } from './eetEalCalculation';
import { computeEetKapitaliseringCalculation } from './eetKapitaliseringCalculation';

// ─── Types ────────────────────────────────────────────────────────────────────

export type EetDifferencekravIssue = Readonly<{
  id: string;
  severity: 'error' | 'warning';
  message: string;
}>;

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
  kapitaliseringsdato: ISODateString | null;
  kapitaliseringspct: number | null;
  kapitalbelob: number | null;
}>;

export type EetDifferencekravProformaKapitalisering = Readonly<{
  loebendeEetPct: number;
  kapitaliseringsdato: ISODateString;
  grundydelse: number;
  reguleringsPctRounded4: number;
  aarsydelse: number;
  kapitaliseringsbekendtgoerelseLabel: string;
  folkepensionsalderLabel: string;
  alderAar: number;
  alderMaaneder: number;
  kapitaliseretPgaUnderToAarTilFp: boolean;
  saerfaktor: number | null;
  kapitaliseringsfaktor: number;
  proformaBeloeb: number;
}>;

export type EetDifferencekravComputation = Readonly<{
  beregningsdato: ISODateString;
  skadesdato: ISODateString;
  dagFoerBeregningsdato: ISODateString;
  ealKrav: number;
  ealEetPct: number;
  fradragLoebendeYdelser: number;
  fradragKapitaliseretEet: number;
  proformaKapitalisering: EetDifferencekravProformaKapitalisering | null;
  proformaBeloeb: number;
  differencekrav: number;
  afgoerelser: readonly EetDifferencekravLoebendeAfgoerelse[];
  kapitaliseringerAfgoerelser: readonly EetDifferencekravKapitaliseretAfgoerelse[];
}>;

export type EetDifferencekravCalculationResult = Readonly<{
  issues: readonly EetDifferencekravIssue[];
  computation: EetDifferencekravComputation | null;
  hasBlockingErrors: boolean;
}>;

type Input = Readonly<{
  erhvervsevnetab: ErhvervsevnetabValues;
  skadesdato: ISODateString | undefined;
  fodselsdato: ISODateString | undefined;
}>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const toIssue = (id: string, message: string): EetDifferencekravIssue => ({ id, severity: 'error', message });

export { formatPct as formatKapPct } from './eetLoebendeYdelserCalculation';

// Issue IDs from fane 3 (kapitalisering) that are non-blocking on fane 5
// when there are no capitalized settlements.
const NON_BLOCKING_KAP_ISSUE_IDS = new Set([
  'kapitaliseringsbekendtgoerelse-missing-control-date',
  'kapitaliseringsbekendtgoerelse-missing-effective-date',
  'kapitaliseringstabel-missing',
  'kapitaliseringsalder-under-minimum',
  'kapitaliseringsfaktor-unresolved',
  'kap-dato-without-kap-pct',
  'kap-pct-without-kap-dato',
]);

// Issue IDs from fane 2 (løbende) that are non-blocking on fane 5
// when there are no capitalized settlements.
const NON_BLOCKING_LOEBENDE_ISSUE_IDS = new Set([
  'kap-dato-without-kap-pct',
  'kap-pct-without-kap-dato',
  'endelig-under-50-missing-kapitalisering',
  'delvist-endelig-missing-kapitalisering',
]);

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
    koen: ErhvervsevnetabValues['koen'];
  }>,
  issues: EetDifferencekravIssue[]
): EetDifferencekravProformaKapitalisering | null => {
  const { loebendeEetPct, beregningsdato, skadesdato, fodselsdato } = args;

  const controlBekId = resolveKapitaliseringsbekendtgoerelseId(skadesdato, beregningsdato);
  if (!controlBekId) {
    issues.push(toIssue(
      'proforma-kapitaliseringsbekendtgoerelse-missing',
      `Der findes ingen gyldig kapitaliseringsbekendtgørelse for beregningsdatoen ${formatIsoDateShort(beregningsdato)}`
    ));
    return null;
  }

  const tabeldata = getKapitaliseringsTabelData(controlBekId);
  if (!tabeldata) {
    issues.push(toIssue(
      'proforma-kapitaliseringsbekendtgoerelse-missing',
      `Kapitaliseringsdata mangler for ${controlBekId}`
    ));
    return null;
  }

  const tabelvalg = resolveKapitaliseringTabelvalg(tabeldata, skadesdato, fodselsdato);
  if (!tabelvalg) {
    issues.push(toIssue(
      'proforma-kapitaliseringstabel-missing',
      'Ingen kapitaliseringstabel matcher skadesdato og fødselsdato på beregningsdatoen'
    ));
    return null;
  }

  const age = calculateAgeYearsMonths(fodselsdato, beregningsdato);
  if (!age) {
    issues.push(toIssue('proforma-kapitaliseringsfaktor-unresolved', 'Alder kan ikke beregnes på beregningsdatoen'));
    return null;
  }

  const saerfaktor = resolveSaerfaktor(tabeldata, skadesdato);
  const useDirectSaerfaktor = tabelvalg.folkepensionsalderMaaneder - age.totalMonths <= 24;
  let kapitaliseringsfaktor: number | null = null;
  let kapitaliseretPgaUnderToAarTilFp = false;

  if (useDirectSaerfaktor) {
    if (saerfaktor === null) {
      issues.push(toIssue(
        'proforma-kapitaliseringsfaktor-unresolved',
        'Særfaktor mangler for proformakapitalisering under 2 år til folkepension'
      ));
      return null;
    }
    kapitaliseringsfaktor = round3(saerfaktor);
    kapitaliseretPgaUnderToAarTilFp = true;
  } else {
    const factorTableResult = resolveFactorTable(tabeldata, tabelvalg.tabel, args.koen);
    const factorRows = factorTableResult.rows;
    if (!factorRows || factorRows.length === 0) {
      const message = factorTableResult.reason === 'missing-koen'
        ? `Køn mangler for kapitaliseringstabel ${tabelvalg.tabel}`
        : `Ingen kapitaliseringsfaktorer for tabel ${tabelvalg.tabel}`;
      issues.push(toIssue('proforma-kapitaliseringstabel-missing', message));
      return null;
    }

    const minAge = factorRows[0]?.alder;
    if (minAge === undefined || age.years < minAge) {
      issues.push(toIssue(
        'proforma-kapitaliseringsalder-under-minimum',
        `Ingen kapitaliseringsfaktor for alder (${age.years} år, ${age.months} mdr.) - tabellen starter ved ${minAge} år`
      ));
      return null;
    }

    const withinTable = interpolateFactorWithinTable(factorRows, age);
    if (withinTable !== null) {
      kapitaliseringsfaktor = round3(withinTable);
    } else {
      const maxAge = factorRows[factorRows.length - 1]?.alder;
      if (maxAge !== undefined && age.years <= maxAge) {
        issues.push(toIssue(
          'proforma-kapitaliseringsfaktor-unresolved',
          `Ingen kapitaliseringsfaktor for alder (${age.years} år, ${age.months} mdr.) i tabel ${tabelvalg.tabel}`
        ));
        return null;
      }
      if (saerfaktor === null) {
        issues.push(toIssue(
          'proforma-kapitaliseringsfaktor-unresolved',
          'Kapitaliseringsfaktor kan ikke beregnes, fordi særfaktor mangler'
        ));
        return null;
      }
      const beyondTable = interpolateFactorBeyondTable(factorRows, age, tabelvalg.folkepensionsalderMaaneder, saerfaktor);
      if (beyondTable === null) {
        issues.push(toIssue(
          'proforma-kapitaliseringsfaktor-unresolved',
          `Kapitaliseringsfaktor kan ikke beregnes for alder (${age.years} år, ${age.months} mdr.)`
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
    issues.push(toIssue('proforma-reguleringssats-missing-2024', 'Reguleringssats mangler for år 2024'));
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
    grundydelse: effektivGrundydelse,
    reguleringsPctRounded4: round4(rateInfo.reguleringPct),
    aarsydelse,
    kapitaliseringsbekendtgoerelseLabel: `${typeLabel} ${controlBekId}, tabel ${tabelvalg.tabel}`,
    folkepensionsalderLabel: tabelvalg.folkepensionsalderLabel,
    alderAar: age.years,
    alderMaaneder: age.months,
    kapitaliseretPgaUnderToAarTilFp,
    saerfaktor,
    kapitaliseringsfaktor,
    proformaBeloeb,
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
  const fodselsdato = input.fodselsdato;

  // ─── Kør eal-beregning (fane 4) ───────────────────────────────────────────
  const ealResult = computeEetEalCalculation({
    erhvervsevnetab: input.erhvervsevnetab,
    skadesdato,
    fodselsdato,
    reguleringssats,
    erhvervsevnetabMax,
    aarsloenMax,
  });

  // ─── Kør kapitaliserings-beregning (fane 3) ───────────────────────────────
  const kapResult = computeEetKapitaliseringCalculation({
    erhvervsevnetab: input.erhvervsevnetab,
    skadesdato,
    fodselsdato,
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
          erhvervsevnetab: { ...input.erhvervsevnetab, beregningsdato: dayBefore },
          skadesdato,
          fodselsdato,
        });
      }
    }
  }

  // ─── Aggreger issues fra fane 2, 3 og 4 ──────────────────────────────────
  const allSourceIssues: EetDifferencekravIssue[] = [];

  for (const issue of ealResult.issues) {
    allSourceIssues.push(issue as EetDifferencekravIssue);
  }
  for (const issue of kapResult.issues) {
    allSourceIssues.push(issue as EetDifferencekravIssue);
  }
  if (loebendeResult) {
    for (const issue of loebendeResult.issues) {
      allSourceIssues.push(issue as EetDifferencekravIssue);
    }
  } else if (!beregningsdato) {
    allSourceIssues.push({ id: 'beregningsdato-missing', severity: 'error', message: 'Beregningsdato er ikke udfyldt' });
  } else if (!dagFoerBeregningsdato) {
    allSourceIssues.push({ id: 'beregningsdato-invalid', severity: 'error', message: 'Beregningsdato er ugyldig' });
  }

  // ─── Fradrag 3: Proformakapitalisering (issues indgår i blocking-evaluering) ──
  // Proformaberegningen kræver eal-computation og alle stamdata — kør kun hvis
  // disse forudsætninger er til stede, så vi undgår fejl-stacking ovenpå allerede
  // kendte blokerende fejl.
  const proformaIssues: EetDifferencekravIssue[] = [];
  let proformaKapitalisering: EetDifferencekravProformaKapitalisering | null = null;
  let loebendeEetPct = 0;

  if (ealResult.computation && beregningsdato && skadesdato && fodselsdato && dagFoerBeregningsdato) {
    const loebendeComputation = loebendeResult?.computation ?? null;

    const aslAarsloenRaw = amountValueToNumber(input.erhvervsevnetab.aslAarsloen);
    const skadesaar = Number.parseInt(skadesdato.slice(0, 4), 10);
    const maxAarsloenISkadesaar = aarsloenMax[skadesaar] ?? 0;
    const aslAarsloenAfrundet1000 = Number.isFinite(aslAarsloenRaw)
      ? roundNearest1000(aslAarsloenRaw as number)
      : 0;
    const benyttetAarsloen = Math.min(aslAarsloenAfrundet1000, maxAarsloenISkadesaar);
    const before2024Skade = skadesdato < SKAERING_2024_07_01;
    const from2011 = skadesdato >= SKAERING_2011_01_01;
    const grundloen = maxAarsloenISkadesaar > 0
      ? round0(benyttetAarsloen * (before2024Skade ? ASL_MAX_AARSLOEN_2003 : ASL_MAX_AARSLOEN_2024) / maxAarsloenISkadesaar)
      : 0;
    const erstatningsniveau = from2011 ? 0.83 : 0.8;
    const amFaktor = from2011 ? 0.92 : 1;

    // Bestem løbende EET-pct til proformakapitalisering.
    // Afgørelseslisten hentes fra løbende-computation til tie-breaking (seneste afgørelse).
    // Kapitaliseringsprocenterne hentes fra råinput og filtreres: kun kap.dato <= beregningsdato
    // medregnes — fremtidige kapitaliseringer er endnu ikke sket per beregningsdatoen.
    const kapitaliseringerForProforma = input.erhvervsevnetab.aslAfgoerelser
      .map((row) => ({
        kapDato: coerceToISODateString(row.kapDato),
        kapPct: parsePercentDraft(row.kapPct) ?? 0,
      }))
      .filter((k) => k.kapDato !== undefined && k.kapDato <= beregningsdato && k.kapPct > 0) as readonly { kapPct: number }[];

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

  const aggregatedIssues = dedupeIssuesBySeverityAndMessage(allSourceIssues);

  // Download blocking: errors, excluding non-blocking issues when no kapitaliserede afgørelser exist.
  // Baseres på rådata (ikke kapResult.computation) så issues som kap-dato-without-kap-pct korrekt
  // blokerer download selv når kapResult.computation er null pga. andre blokerende fejl.
  const kapHasCapitalized = input.erhvervsevnetab.aslAfgoerelser.some((row) => {
    const kapDato = coerceToISODateString(row.kapDato);
    const kapPct = parsePercentDraft(row.kapPct);
    return (kapDato !== undefined) || (kapPct !== undefined && kapPct > 0);
  });

  const blockingErrors = aggregatedIssues.filter((issue) => {
    if (issue.severity !== 'error') return false;
    if (!kapHasCapitalized && NON_BLOCKING_KAP_ISSUE_IDS.has(issue.id)) return false;
    if (!kapHasCapitalized && NON_BLOCKING_LOEBENDE_ISSUE_IDS.has(issue.id)) return false;
    return true;
  });

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
      const naeste = sortedByVirkningsdato[i + 1];
      let fradragesTil: ISODateString;
      if (naeste) {
        const naesteParsed = parseISODate(naeste.virkningsdato);
        const dagenFoerNaeste = naesteParsed ? dateToISO(addDays(naesteParsed, -1)) : null;
        fradragesTil = dagenFoerNaeste ?? dagFoerBeregningsdato;
      } else {
        fradragesTil = dagFoerBeregningsdato;
      }

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

  const aslRowsForDisplay = input.erhvervsevnetab.aslAfgoerelser
    .filter((row) => {
      const eetPct = parsePercentDraft(row.eetPct);
      return eetPct !== undefined && eetPct > 0 && coerceToISODateString(row.afgoerelsesDato) !== undefined;
    })
    .map((row) => {
      const afgoerelsesdato = coerceToISODateString(row.afgoerelsesDato)!;
      const kapComp = kapResult.computation?.afgoerelser.find((a) => a.rowId === row.id);
      if (kapComp) {
        fradragKapitaliseretEet += kapComp.kapitalbelob;
        return {
          rowId: row.id,
          afgoerelsesdato,
          kapitaliseringsdato: kapComp.kapitaliseringsdato,
          kapitaliseringspct: kapComp.kapitaliseringspct,
          kapitalbelob: kapComp.kapitalbelob,
        };
      }
      return {
        rowId: row.id,
        afgoerelsesdato,
        kapitaliseringsdato: null as ISODateString | null,
        kapitaliseringspct: null as number | null,
        kapitalbelob: null as number | null,
      };
    })
    .sort((a, b) => a.afgoerelsesdato.localeCompare(b.afgoerelsesdato));

  kapAfgoerelser.push(...aslRowsForDisplay);

  // ─── Endeligt differencekrav ──────────────────────────────────────────────
  const proformaBeloeb = proformaKapitalisering?.proformaBeloeb ?? 0;
  const differencekrav = Math.max(
    0,
    round0(ealKrav - fradragLoebendeYdelser - fradragKapitaliseretEet - proformaBeloeb)
  );

  return {
    issues: aggregatedIssues,
    hasBlockingErrors: false,
    computation: {
      beregningsdato,
      skadesdato,
      dagFoerBeregningsdato,
      ealKrav,
      ealEetPct,
      fradragLoebendeYdelser,
      fradragKapitaliseretEet,
      proformaKapitalisering,
      proformaBeloeb,
      differencekrav,
      afgoerelser: loebendeAfgoerelser,
      kapitaliseringerAfgoerelser: kapAfgoerelser,
    },
  };
};
