import type { AslAfgoerelseRow, ErhvervsevnetabComposedValues } from '../../schemas/formSchemas';
import type { EetIssue } from './eetTypes';
import type { ISODateString } from '../../types/branded';
import { coerceToISODateString } from '../../types/branded';
import { amountValueToNumber } from '../../utils/expressionAmount';
import { formatIsoDateShort } from '../../utils/dateFormatting';
import { dedupeIssuesBySeverityAndMessage } from '../../utils/issueUtils';
import {
  ASL_MAX_AARSLOEN_2003,
  ASL_MAX_AARSLOEN_2024,
  aarsloenAslMax,
  reguleringsprocentErhvervsevnetabFoer2024,
} from '../../data/lovbestemteRates';
import {
  getKapitaliseringsTabelData,
} from '../../data/kapitalisering/kapitaliseringsTabeller';
import { collectIncompleteRowIssues, hasTextValue, isAslAfgoerelseRowEmpty, parsePercentDraft } from './eetAslAfgoerelser';
import {
  calculateAgeYearsMonths,
  interpolateFactorBeyondTable,
  interpolateFactorWithinTable,
  isUnderOrEqualTwoYearsToFpByBekendtgoerelse,
  resolveFactorTable,
  resolveKapitaliseringsbekendtgoerelseId,
  resolveKapitaliseringTabelvalg,
  resolveSaerfaktor,
  type AgeYearsMonths,
} from './eetKapitaliseringOpslag';
import { ceil0, round0, round2, round3, round4, roundNearest1000 } from '../../utils/roundingShortcuts';
import { resolveAslReguleringRateForKapAar } from './eetReguleringRater';
import { SKAERING_2007_07_01, SKAERING_2011_01_01, SKAERING_2024_07_01 } from './eetSkaeringsdatoer';

export type EetKapitaliseringAfgoerelseComputation = Readonly<{
  rowId: string;
  afgoerelsesdato: ISODateString;
  kapitaliseringsdato: ISODateString;
  kapitaliseringspct: number;
  grundloen: number;
  erstatningsniveauPct: 80 | 83;
  amBidragPct: 0 | 8;
  grundydelse: number;
  grundydelse2024: number | null;
  opreguleringTil2024PctRounded4: number | null;
  aarsydelseGrundlag: number;
  aarsydelseReguleringsPctRounded4: number | null;
  aarsydelse: number;
  kapitaliseringsbekendtgoerelseLabel: string;
  tabelLabel: string;
  folkepensionsalderLabel: string;
  saerfaktor: number | null;
  alderAar: number;
  alderMaaneder: number;
  kapitaliseretPgaUnderToAarTilFp: boolean;
  faktorMaanedsAfhaengig: boolean;
  kapitaliseringsfaktor: number;
  kapitalbelob: number;
  koenOpdelt: boolean;
}>;

export type EetKapitaliseringComputation = Readonly<{
  afgoerelser: readonly EetKapitaliseringAfgoerelseComputation[];
}>;

export const WARN_NO_KAP_INPUT_ID = 'warn-ingen-kap-input';

export type EetKapitaliseringCalculationResult = Readonly<{
  issues: readonly EetIssue[];
  computation: EetKapitaliseringComputation | null;
}>;

type Input = Readonly<{
  erhvervsevnetab: ErhvervsevnetabComposedValues;
  skadesdato: ISODateString | undefined;
  skadelidteFodselsdato: ISODateString | undefined;
}>;

type ResolvedKapitaliseringsRow = Readonly<{
  rowId: string;
  afgoerelsesdato: ISODateString;
  virkningsdato: ISODateString | null;
  eetPct: number;
  kapDato: ISODateString | null;
  kapPct: number;
  afgoerelseType: 'Endelig' | 'Delvist endelig';
  tidlKapDato: ISODateString | null;
}>;

type KapitaliseringAarsydelseBreakdown = Readonly<{
  grundydelse: number;
  grundydelse2024: number | null;
  opreguleringTil2024PctRounded4: number | null;
  aarsydelseGrundlag: number;
  aarsydelseReguleringsPctRounded4: number | null;
  aarsydelse: number;
}>;

const toIssue = (id: string, message: string): EetIssue => ({
  id,
  severity: 'error',
  message,
});

const toWarning = (id: string, message: string): EetIssue => ({
  id,
  severity: 'warning',
  message,
});

const toMissingFieldIssue = (fieldId: string, fieldLabel: string): EetIssue =>
  toIssue(`missing-${fieldId}`, `Der mangler indtastning af ${fieldLabel}.`);

const formatAgeForIssue = (age: AgeYearsMonths): string => `${age.years} år, ${age.months} måneder`;

export const resolveKapitaliseringAarsydelseBreakdown = (
  args: Readonly<{
    grundloen: number;
    kapitaliseringspct: number;
    erstatningsniveau: number;
    amFaktor: number;
    kapitaliseringsaar: number;
    before2024Skade: boolean;
  }>,
  issues: EetIssue[]
): KapitaliseringAarsydelseBreakdown | null => {
  const rateInfo = resolveAslReguleringRateForKapAar(
    args.kapitaliseringsaar,
    args.before2024Skade,
    issues
  );
  if (!rateInfo) return null;

  const grundydelse = round2(
    args.grundloen * (args.kapitaliseringspct / 100) * args.erstatningsniveau * args.amFaktor
  );

  if (args.before2024Skade && args.kapitaliseringsaar < 2024) {
    return {
      grundydelse,
      grundydelse2024: null,
      opreguleringTil2024PctRounded4: null,
      aarsydelseGrundlag: grundydelse,
      aarsydelseReguleringsPctRounded4: round4(rateInfo.reguleringPct),
      aarsydelse: round2(grundydelse * rateInfo.factor),
    };
  }

  if (args.before2024Skade) {
    // kapitaliseringsaar >= 2024: opregulér grundydelse til 2024-niveau
    const opreguleringTil2024Pct = reguleringsprocentErhvervsevnetabFoer2024[2024];
    if (!Number.isFinite(opreguleringTil2024Pct)) {
      issues.push(toIssue('reguleringssats-missing', 'Reguleringssats mangler for år 2024.'));
      return null;
    }

    const grundydelse2024 = round2(grundydelse * (1 + opreguleringTil2024Pct / 100));
    const aarsydelse = round2(grundydelse2024 * rateInfo.factor);
    return {
      grundydelse,
      grundydelse2024,
      opreguleringTil2024PctRounded4: round4(opreguleringTil2024Pct),
      aarsydelseGrundlag: grundydelse2024,
      // År 2024 er referenceåret; regulering er per definition 0 og vises ikke (null).
      aarsydelseReguleringsPctRounded4:
        args.kapitaliseringsaar === 2024 ? null : round4(rateInfo.reguleringPct),
      aarsydelse,
    };
  }

  return {
    grundydelse,
    grundydelse2024: null,
    opreguleringTil2024PctRounded4: null,
    aarsydelseGrundlag: grundydelse,
    aarsydelseReguleringsPctRounded4: round4(rateInfo.reguleringPct),
    aarsydelse: round2(grundydelse * rateInfo.factor),
  };
};

const collectResolvedRows = (
  rows: readonly AslAfgoerelseRow[],
  issues: EetIssue[],
  skadesdato: ISODateString | undefined,
  fodselsdato: ISODateString | undefined
): ResolvedKapitaliseringsRow[] => {
  const result: ResolvedKapitaliseringsRow[] = [];
  const startedRows = rows.filter((row) => !isAslAfgoerelseRowEmpty(row));
  const rowsWithAfgoerelse = startedRows.filter((row) => {
    const eetPct = parsePercentDraft(row.eetPct);
    return (
      eetPct !== undefined &&
      eetPct > 0 &&
      coerceToISODateString(row.afgoerelsesDato) !== undefined &&
      row.afgoerelseType !== undefined
    );
  });
  const rowsWithKapitaliserbarAfgoerelse = rowsWithAfgoerelse.filter(
    (row) => row.afgoerelseType === 'Endelig' || row.afgoerelseType === 'Delvist endelig'
  );

  if (startedRows.length === 0) {
    issues.push(
      toIssue(
        'asl-afgoerelser-empty',
        'Ingen ASL-afgørelser er indtastet.'
      )
    );
    return result;
  }

  for (const issue of collectIncompleteRowIssues(rows)) {
    issues.push(toIssue(issue.id, issue.message));
  }

  if (rowsWithAfgoerelse.length > 0 && rowsWithKapitaliserbarAfgoerelse.length === 0) {
    issues.push(
      toIssue(
        'no-endelig-afgoerelser',
        'Ingen endelig eller delvist endelig afgørelser indtastet.'
      )
    );
  }

  for (const row of rows) {
    if (row.afgoerelseType !== 'Endelig' && row.afgoerelseType !== 'Delvist endelig') continue;
    const kapPct = parsePercentDraft(row.kapPct);
    const afgoerelsesdato = coerceToISODateString(row.afgoerelsesDato);
    if (!afgoerelsesdato) continue;
    const controlDate = coerceToISODateString(row.tidlKapDato) ?? afgoerelsesdato;
    const isEndeligUnderOrEqualTwoYears =
      row.afgoerelseType === 'Endelig' &&
      skadesdato !== undefined &&
      fodselsdato !== undefined &&
      isUnderOrEqualTwoYearsToFpByBekendtgoerelse(skadesdato, fodselsdato, controlDate);
    if (!isEndeligUnderOrEqualTwoYears && (kapPct === undefined || kapPct <= 0)) continue;

    result.push({
      rowId: row.id,
      afgoerelsesdato,
      virkningsdato: coerceToISODateString(row.virkningsDato) ?? null,
      eetPct: parsePercentDraft(row.eetPct) ?? 0,
      kapDato: coerceToISODateString(row.kapDato) ?? null,
      kapPct: kapPct ?? 0,
      afgoerelseType: row.afgoerelseType,
      tidlKapDato: coerceToISODateString(row.tidlKapDato) ?? null,
    });
  }

  const hasDelvistEndeligWithoutKapInfo = rowsWithKapitaliserbarAfgoerelse.some(
    (row) => row.afgoerelseType === 'Delvist endelig' && !hasTextValue(row.kapDato) && !hasTextValue(row.kapPct)
  );
  if (hasDelvistEndeligWithoutKapInfo) {
    issues.push(toIssue(
      'delvist-endelig-missing-kapitalisering',
      'Der er angivet en delvist endelig afgørelse uden kapitalisering.'
    ));
  }

  const hasKapPctZeroOnKapitaliserbarRow = rowsWithKapitaliserbarAfgoerelse.some((row) => {
    const kapPct = parsePercentDraft(row.kapPct);
    return hasTextValue(row.kapPct) && (kapPct === undefined || kapPct === 0);
  });

  // Guards: forhindrer at den generiske "ingen kap.dato/pct overhovedet"-fejl emitteres
  // når problemet allerede er beskrevet af en mere præcis fejl.
  // Checkes på alle rækker (ikke kun kapitaliserbare) for at fange kap-felter udfyldt
  // på Midlertidig-rækker, som sorteres fra inden result bygges.
  const hasKapDatoWithoutKapPct = rows.some((row) => hasTextValue(row.kapDato) && !hasTextValue(row.kapPct));
  const hasKapPctWithoutKapDato = rows.some((row) => hasTextValue(row.kapPct) && !hasTextValue(row.kapDato));
  const hasEndeligUnder50MissingKap = rowsWithKapitaliserbarAfgoerelse.some((row) => {
    if (row.afgoerelseType !== 'Endelig') return false;
    const eetPct = parsePercentDraft(row.eetPct);
    if (eetPct === undefined || eetPct === 0 || eetPct >= 50) return false;
    const afgoerelsesdato = coerceToISODateString(row.afgoerelsesDato);
    const controlDate = coerceToISODateString(row.tidlKapDato) ?? afgoerelsesdato;
    const isForcedUnderTwoYears =
      skadesdato !== undefined &&
      fodselsdato !== undefined &&
      controlDate !== undefined &&
      isUnderOrEqualTwoYearsToFpByBekendtgoerelse(skadesdato, fodselsdato, controlDate);
    if (isForcedUnderTwoYears) return false;
    return !hasTextValue(row.kapDato) && !hasTextValue(row.kapPct);
  });
  const hasAnyKapInput = rows.some((row) => hasTextValue(row.kapDato) || hasTextValue(row.kapPct));
  const hasForcedEndeligUnderTwoYears = rowsWithKapitaliserbarAfgoerelse.some((row) => {
    const afgoerelsesdato = coerceToISODateString(row.afgoerelsesDato);
    const controlDate = coerceToISODateString(row.tidlKapDato) ?? afgoerelsesdato;
    return (
      row.afgoerelseType === 'Endelig' &&
      skadesdato !== undefined &&
      fodselsdato !== undefined &&
      controlDate !== undefined &&
      isUnderOrEqualTwoYearsToFpByBekendtgoerelse(skadesdato, fodselsdato, controlDate)
    );
  });

  if (startedRows.length > 0 && !hasAnyKapInput && !hasForcedEndeligUnderTwoYears) {
    issues.push(toWarning(WARN_NO_KAP_INPUT_ID, 'Der er ikke angivet kapitaliseringsdato eller -procent for nogen afgørelse.'));
  }

  if (
    rowsWithKapitaliserbarAfgoerelse.length > 0 &&
    result.length === 0 &&
    hasAnyKapInput &&
    !hasDelvistEndeligWithoutKapInfo &&
    !hasEndeligUnder50MissingKap &&
    !hasKapDatoWithoutKapPct &&
    !hasKapPctWithoutKapDato &&
    !hasKapPctZeroOnKapitaliserbarRow
  ) {
    issues.push(toMissingFieldIssue('kap-dato', 'kapitaliseringsdato'));
    issues.push(toMissingFieldIssue('kap-pct', 'kapitaliseringsprocent'));
  }

  const hasKapPctUnder15 = result.some((row) => row.kapPct > 0 && row.kapPct < 15);
  if (hasKapPctUnder15) {
    issues.push(toWarning('warn-kap-pct-under-15', 'Der er angivet kapitalisering med mindre end 15 %.'));
  }

  return result.sort((a, b) => {
    if (a.afgoerelsesdato !== b.afgoerelsesdato) return a.afgoerelsesdato < b.afgoerelsesdato ? -1 : 1;
    const aVirkningsdato = a.virkningsdato ?? '';
    const bVirkningsdato = b.virkningsdato ?? '';
    if (aVirkningsdato !== bVirkningsdato) return aVirkningsdato < bVirkningsdato ? -1 : 1;
    const aKapDato = a.kapDato ?? '';
    const bKapDato = b.kapDato ?? '';
    if (aKapDato !== bKapDato) return aKapDato < bKapDato ? -1 : 1;
    return a.rowId.localeCompare(b.rowId);
  });
};

export const computeEetKapitaliseringCalculation = (
  input: Input
): EetKapitaliseringCalculationResult => {
  const issues: EetIssue[] = [];
  const values = input.erhvervsevnetab;
  const skadesdato = input.skadesdato;
  const fodselsdato = input.skadelidteFodselsdato;
  const aarsloen = amountValueToNumber(values.aslAarsloen);

  if (!Number.isFinite(aarsloen)) {
    issues.push(toIssue('aarsloen-missing', 'Årsløn er ikke udfyldt.'));
  } else if (aarsloen === 0) {
    issues.push(toIssue('aarsloen-zero', 'Årsløn må ikke være 0 kr.'));
  }
  if (!fodselsdato) {
    issues.push(toIssue('skadelidte-fodselsdato-missing', 'Fødselsdato er ikke udfyldt.'));
  }
  if (!skadesdato) {
    issues.push(toIssue('skadesdato-missing', 'Skadesdato er ikke udfyldt.'));
  }

  const resolvedRows = collectResolvedRows(values.aslAfgoerelser, issues, skadesdato, fodselsdato);

  if (issues.some((issue) => issue.severity === 'error') || !Number.isFinite(aarsloen) || !skadesdato || !fodselsdato) {
    return { issues: dedupeIssuesBySeverityAndMessage(issues), computation: null };
  }

  const skadesaar = Number.parseInt(skadesdato.slice(0, 4), 10);
  const maxAarsloenISkadesaar = aarsloenAslMax[skadesaar];
  if (!Number.isFinite(maxAarsloenISkadesaar)) {
    issues.push(toIssue('aarsloen-max-missing', `Maksimum årsløn mangler for år ${skadesaar}.`));
    return { issues: dedupeIssuesBySeverityAndMessage(issues), computation: null };
  }

  const aslAarsloen = aarsloen as number;
  const aslAarsloenAfrundet1000 = roundNearest1000(aslAarsloen);
  const benyttetAarsloen = Math.min(aslAarsloenAfrundet1000, maxAarsloenISkadesaar);
  const before2024Skade = skadesdato < SKAERING_2024_07_01;
  const from2011 = skadesdato >= SKAERING_2011_01_01;
  const grundloen = before2024Skade
    ? round0(benyttetAarsloen * (ASL_MAX_AARSLOEN_2003 / maxAarsloenISkadesaar))
    : round0(benyttetAarsloen * (ASL_MAX_AARSLOEN_2024 / maxAarsloenISkadesaar));
  const erstatningsniveau = from2011 ? 0.83 : 0.8;
  const amFaktor = from2011 ? 0.92 : 1;
  const needsKoen = resolvedRows.some((row) => row.kapDato !== null && row.kapDato < '2015-03-01');
  if (needsKoen && !values.koen) {
    issues.push(toIssue('missing-koen', 'Ved kapitalisering før 1. marts 2015 skal køn angives.'));
    return { issues: dedupeIssuesBySeverityAndMessage(issues), computation: null };
  }

  const computations: EetKapitaliseringAfgoerelseComputation[] = [];
  let kumulativKapPct = 0;

  for (const row of resolvedRows) {
    const controlDate = row.tidlKapDato ?? row.afgoerelsesdato;
    const isEndeligUnderOrEqualTwoYears =
      row.afgoerelseType === 'Endelig' &&
      isUnderOrEqualTwoYearsToFpByBekendtgoerelse(skadesdato, fodselsdato, controlDate);
    const effectiveKapPct = isEndeligUnderOrEqualTwoYears
      ? Math.max(0, row.eetPct - kumulativKapPct)
      : row.kapPct;
    const effectiveKapDato = isEndeligUnderOrEqualTwoYears
      ? row.afgoerelsesdato
      : row.kapDato;
    if (!effectiveKapDato || effectiveKapPct <= 0) {
      continue;
    }

    const controlBekId = resolveKapitaliseringsbekendtgoerelseId(skadesdato, controlDate);
    if (!controlBekId) {
      issues.push(
        toIssue(
          'kapitaliseringsbekendtgoerelse-missing-control-date',
          `Kapitaliseringsbekendtgørelse mangler for ${formatIsoDateShort(controlDate)}.`
        )
      );
      continue;
    }

    const controlData = getKapitaliseringsTabelData(controlBekId);
    if (!controlData) {
      issues.push(
        toIssue(
          'kapitaliseringsbekendtgoerelse-missing-control-date',
          `Kapitaliseringsdata mangler for ${controlBekId}.`
        )
      );
      continue;
    }

    const controlTabelvalg = resolveKapitaliseringTabelvalg(controlData, skadesdato, fodselsdato);
    if (!controlTabelvalg) {
      issues.push(
        toIssue(
          'kapitaliseringstabel-missing',
          `Ingen kapitaliseringstabel i ${controlBekId} matcher skadesdato og fødselsdato på kontroltidspunktet.`
        )
      );
      continue;
    }

    const controlAge = calculateAgeYearsMonths(fodselsdato, controlDate);
    if (!controlAge) {
      issues.push(toIssue('kapitaliseringsfaktor-unresolved', 'Alder kan ikke beregnes for kontroltidspunktet.'));
      continue;
    }

    const controlSaerfaktor = resolveSaerfaktor(controlData, skadesdato);
    const useDirectSaerfaktor = controlTabelvalg.folkepensionsalderMaaneder - controlAge.totalMonths <= 24;

    let resolvedKapId = controlBekId;
    let resolvedTabelData = controlData;
    let resolvedTabelvalg = controlTabelvalg;
    let resolvedSaerfaktor = controlSaerfaktor;
    let ageForFactor = controlAge;
    let kapitaliseringsfaktor: number | null = null;
    let kapitaliseretPgaUnderToAarTilFp = false;
    let koenOpdelt = false;
    const faktorMaanedsAfhaengig = skadesdato >= SKAERING_2007_07_01;

    if (useDirectSaerfaktor) {
      if (resolvedSaerfaktor === null) {
        issues.push(
          toIssue(
            'kapitaliseringsfaktor-unresolved',
            'Særfaktor mangler for kapitalisering under 2 år til folkepension.'
          )
        );
        continue;
      }
      kapitaliseringsfaktor = round3(resolvedSaerfaktor);
      kapitaliseretPgaUnderToAarTilFp = true;
    } else {
      const effectiveBekId = resolveKapitaliseringsbekendtgoerelseId(skadesdato, effectiveKapDato);
      if (!effectiveBekId) {
        issues.push(
          toIssue(
            'kapitaliseringsbekendtgoerelse-missing-effective-date',
            `Kapitaliseringsbekendtgørelse mangler for ${formatIsoDateShort(effectiveKapDato)}.`
          )
        );
        continue;
      }
      resolvedKapId = effectiveBekId;
      const effectiveData = getKapitaliseringsTabelData(effectiveBekId);
      if (!effectiveData) {
        issues.push(
          toIssue(
            'kapitaliseringsbekendtgoerelse-missing-effective-date',
            `Kapitaliseringsdata mangler for ${effectiveBekId}.`
          )
        );
        continue;
      }
      resolvedTabelData = effectiveData;
      const effectiveTabelvalg = resolveKapitaliseringTabelvalg(effectiveData, skadesdato, fodselsdato);
      if (!effectiveTabelvalg) {
        issues.push(
          toIssue(
            'kapitaliseringstabel-missing',
            `Ingen kapitaliseringstabel i ${effectiveBekId} matcher skadesdato og fødselsdato på kapitaliseringstidspunktet.`
          )
        );
        continue;
      }
      resolvedTabelvalg = effectiveTabelvalg;
      resolvedSaerfaktor = resolveSaerfaktor(effectiveData, skadesdato);
      const effectiveAge = calculateAgeYearsMonths(fodselsdato, effectiveKapDato);
      if (!effectiveAge) {
        issues.push(toIssue('kapitaliseringsfaktor-unresolved', 'Alder kan ikke beregnes på kapitaliseringstidspunktet.'));
        continue;
      }
      ageForFactor = effectiveAge;

      const factorTableResult = resolveFactorTable(effectiveData, effectiveTabelvalg.tabel, values.koen);
      koenOpdelt = factorTableResult.koenOpdelt;
      const factorTable = factorTableResult.rows;
      if (!factorTable || factorTable.length === 0) {
        issues.push(toIssue(
          'kapitaliseringstabel-missing',
          `Ingen kapitaliseringsfaktorer indtastet for tabel ${effectiveTabelvalg.tabel}.`
        ));
        continue;
      }

      const minAge = factorTable[0]?.alder;
      if (minAge === undefined || ageForFactor.years < minAge) {
        issues.push(
          toIssue(
            'kapitaliseringsalder-under-minimum',
            `Ingen kapitaliseringsfaktor indtastet for alder (${formatAgeForIssue(ageForFactor)}) — tabellen starter ved ${minAge} år.`
          )
        );
        continue;
      }

      const withinTable = interpolateFactorWithinTable(factorTable, ageForFactor, faktorMaanedsAfhaengig);
      if (withinTable !== null) {
        kapitaliseringsfaktor = round3(withinTable);
      } else {
        const maxAge = factorTable[factorTable.length - 1]?.alder;
        const isBeyondLastWholeYearInMonthDependentTable =
          faktorMaanedsAfhaengig &&
          maxAge !== undefined &&
          ageForFactor.years === maxAge &&
          ageForFactor.months > 0;
        if (maxAge !== undefined && ageForFactor.years <= maxAge && !isBeyondLastWholeYearInMonthDependentTable) {
          issues.push(
            toIssue(
              'kapitaliseringsfaktor-unresolved',
              `Ingen kapitaliseringsfaktor indtastet for alder (${formatAgeForIssue(ageForFactor)}) i tabel ${effectiveTabelvalg.tabel}.`
            )
          );
          continue;
        }
        if (resolvedSaerfaktor === null) {
          issues.push(
            toIssue(
              'kapitaliseringsfaktor-unresolved',
              'Kapitaliseringsfaktor kan ikke beregnes, fordi særfaktor mangler.'
            )
          );
          continue;
        }
        const beyondTable = interpolateFactorBeyondTable(
          factorTable,
          ageForFactor,
          effectiveTabelvalg.folkepensionsalderMaaneder,
          resolvedSaerfaktor,
          faktorMaanedsAfhaengig
        );
        if (beyondTable === null) {
          issues.push(
            toIssue(
              'kapitaliseringsfaktor-unresolved',
              `Kapitaliseringsfaktor kan ikke beregnes for alder (${formatAgeForIssue(ageForFactor)}) ud fra tabel ${effectiveTabelvalg.tabel} og særfaktor.`
            )
          );
          continue;
        }
        kapitaliseringsfaktor = round3(beyondTable);
      }
    }

    const kapitaliseringsaar = Number.parseInt(effectiveKapDato.slice(0, 4), 10);
    const aarsydelseBreakdown = resolveKapitaliseringAarsydelseBreakdown(
      {
        grundloen,
        kapitaliseringspct: effectiveKapPct,
        erstatningsniveau,
        amFaktor,
        kapitaliseringsaar,
        before2024Skade,
      },
      issues
    );
    if (!aarsydelseBreakdown || kapitaliseringsfaktor === null) continue;

    const kapitalbelob = ceil0(aarsydelseBreakdown.aarsydelse * kapitaliseringsfaktor);
    const typeLabel = resolvedTabelData.kapitaliseringsType === 'vejl' ? 'Vejl.' : 'Bkg.';

    computations.push({
      rowId: row.rowId,
      afgoerelsesdato: row.afgoerelsesdato,
      kapitaliseringsdato: effectiveKapDato,
      kapitaliseringspct: effectiveKapPct,
      grundloen,
      erstatningsniveauPct: from2011 ? 83 : 80,
      amBidragPct: from2011 ? 8 : 0,
      grundydelse: aarsydelseBreakdown.grundydelse,
      grundydelse2024: aarsydelseBreakdown.grundydelse2024,
      opreguleringTil2024PctRounded4: aarsydelseBreakdown.opreguleringTil2024PctRounded4,
      aarsydelseGrundlag: aarsydelseBreakdown.aarsydelseGrundlag,
      aarsydelseReguleringsPctRounded4: aarsydelseBreakdown.aarsydelseReguleringsPctRounded4,
      aarsydelse: aarsydelseBreakdown.aarsydelse,
      kapitaliseringsbekendtgoerelseLabel: `${typeLabel} ${resolvedKapId}, tabel ${resolvedTabelvalg.tabel}`,
      tabelLabel: resolvedTabelvalg.tabel,
      folkepensionsalderLabel: resolvedTabelvalg.folkepensionsalderLabel,
      saerfaktor: resolvedSaerfaktor,
      alderAar: ageForFactor.years,
      alderMaaneder: ageForFactor.months,
      kapitaliseretPgaUnderToAarTilFp,
      faktorMaanedsAfhaengig,
      kapitaliseringsfaktor,
      kapitalbelob,
      koenOpdelt,
    });
    kumulativKapPct += effectiveKapPct;
  }

  if (issues.some((issue) => issue.severity === 'error')) {
    return { issues: dedupeIssuesBySeverityAndMessage(issues), computation: null };
  }

  return {
    issues: dedupeIssuesBySeverityAndMessage(issues),
    computation: { afgoerelser: computations },
  };
};

export { formatPct as formatKapitaliseringsPct } from './eetLoebendeYdelserCalculation';
