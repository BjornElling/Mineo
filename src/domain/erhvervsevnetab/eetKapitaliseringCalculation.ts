import type { AslAfgoerelseRow, ErhvervsevnetabValues } from '../../schemas/formSchemas';
import type { ISODateString } from '../../types/branded';
import { coerceToISODateString } from '../../types/branded';
import { amountValueToNumber } from '../../utils/expressionAmount';
import { formatIsoDateShort } from '../../utils/dateFormatting';
import { dedupeIssuesBySeverityAndMessage } from '../../utils/issueUtils';
import {
  ASL_MAX_AARSLOEN_2003,
  ASL_MAX_AARSLOEN_2024,
  aarsloenMax,
  reguleringsprocentErhvervsevnetabFoer2024,
} from '../../data/regulationRates';
import {
  type KapitaliseringsTabelData,
  getKapitaliseringsTabelData,
} from '../../data/kapitalisering/kapitaliseringsTabeller';
import { collectIncompleteRowIssues, hasTextValue, isAslAfgoerelseRowEmpty, parsePercentDraft } from './eetAslAfgoerelser';
import {
  calculateAgeYearsMonths,
  interpolateFactorBeyondTable,
  interpolateFactorWithinTable,
  resolveFactorTable,
  resolveKapitaliseringsbekendtgoerelseId,
  resolveKapitaliseringTabelvalg,
  resolveSaerfaktor,
  type AgeYearsMonths,
  type ResolvedKapitaliseringTabelvalg as ResolvedTabelvalg,
} from './eetKapitaliseringOpslag';
import { ceil0, round0, round2, round3, round4, roundNearest1000 } from './eetRounding';
import { resolveAslReguleringRateForKapAar } from './eetReguleringRater';
import { SKAERING_2007_07_01, SKAERING_2011_01_01, SKAERING_2024_07_01 } from './eetSkaeringsdatoer';

export type EetKapitaliseringIssue = Readonly<{
  id: string;
  severity: 'error' | 'warning';
  message: string;
}>;

export type EetKapitaliseringAfgoerelseComputation = Readonly<{
  rowId: string;
  afgoerelsesdato: ISODateString;
  kapitaliseringsdato: ISODateString;
  kapitaliseringspct: number;
  grundloen: number;
  erstatningsniveauPct: 80 | 83;
  amBidragPct: 0 | 8;
  grundydelse: number;
  reguleringsPctRounded4: number;
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

export type EetKapitaliseringCalculationResult = Readonly<{
  issues: readonly EetKapitaliseringIssue[];
  computation: EetKapitaliseringComputation | null;
}>;

type Input = Readonly<{
  erhvervsevnetab: ErhvervsevnetabValues;
  skadesdato: ISODateString | undefined;
  fodselsdato: ISODateString | undefined;
}>;

type ResolvedKapitaliseringsRow = Readonly<{
  rowId: string;
  afgoerelsesdato: ISODateString;
  kapDato: ISODateString;
  kapPct: number;
  afgoerelseType: 'Endelig' | 'Delvist endelig';
  tidlKapDato: ISODateString | null;
}>;

const toIssue = (id: string, message: string): EetKapitaliseringIssue => ({
  id,
  severity: 'error',
  message,
});

const toMissingFieldIssue = (fieldId: string, fieldLabel: string): EetKapitaliseringIssue =>
  toIssue(`missing-${fieldId}`, `Der mangler indtastning af ${fieldLabel}.`);


const compareIso = (a: ISODateString, b: ISODateString): number => {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
};

const formatAgeForIssue = (age: AgeYearsMonths): string => `${age.years} år, ${age.months} måneder`;

const collectResolvedRows = (
  rows: readonly AslAfgoerelseRow[],
  issues: EetKapitaliseringIssue[]
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
        'Ingen afgørelser med erhvervsevnetabsprocent er udfyldt.'
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
    if (kapPct === undefined || kapPct <= 0) continue;

    const afgoerelsesdato = coerceToISODateString(row.afgoerelsesDato);
    const kapDato = coerceToISODateString(row.kapDato);
    if (!afgoerelsesdato || !kapDato) continue;

    result.push({
      rowId: row.id,
      afgoerelsesdato,
      kapDato,
      kapPct,
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
  // når problemet er et inkonsistens-problem (dato uden procent eller omvendt). De to
  // fejltyper er gensidigt eksklusivt relevante — inkonsistens-fejlen er mere præcis og
  // skal ikke suppleres af den generiske.
  // Checkes på alle rækker (ikke kun kapitaliserbare) for at fange kap-felter udfyldt
  // på Midlertidig-rækker, som sorteres fra inden result bygges.
  const hasKapDatoWithoutKapPct = rows.some((row) => hasTextValue(row.kapDato) && !hasTextValue(row.kapPct));
  const hasKapPctWithoutKapDato = rows.some((row) => hasTextValue(row.kapPct) && !hasTextValue(row.kapDato));

  if (
    rowsWithKapitaliserbarAfgoerelse.length > 0 &&
    result.length === 0 &&
    !hasKapDatoWithoutKapPct &&
    !hasKapPctWithoutKapDato &&
    !hasKapPctZeroOnKapitaliserbarRow
  ) {
    issues.push(toMissingFieldIssue('kap-dato', 'kapitaliseringsdato'));
    issues.push(toMissingFieldIssue('kap-pct', 'kapitaliseringsprocent'));
  }

  return result.sort((a, b) => {
    if (a.afgoerelsesdato !== b.afgoerelsesdato) return compareIso(a.afgoerelsesdato, b.afgoerelsesdato);
    if (a.kapDato !== b.kapDato) return compareIso(a.kapDato, b.kapDato);
    return a.rowId.localeCompare(b.rowId);
  });
};

export const computeEetKapitaliseringCalculation = (
  input: Input
): EetKapitaliseringCalculationResult => {
  const issues: EetKapitaliseringIssue[] = [];
  const values = input.erhvervsevnetab;
  const skadesdato = input.skadesdato;
  const fodselsdato = input.fodselsdato;
  const aarsloen = amountValueToNumber(values.aslAarsloen);

  if (!Number.isFinite(aarsloen)) {
    issues.push(toIssue('aarsloen-missing', 'Årsløn er ikke udfyldt.'));
  } else if (aarsloen === 0) {
    issues.push(toIssue('aarsloen-zero', 'Årsløn må ikke være 0 kr.'));
  }
  if (!fodselsdato) {
    issues.push(toIssue('fodselsdato-missing', 'Fødselsdato er ikke udfyldt.'));
  }
  if (!skadesdato) {
    issues.push(toIssue('skadesdato-missing', 'Skadesdato er ikke udfyldt.'));
  }

  const resolvedRows = collectResolvedRows(values.aslAfgoerelser, issues);

  if (issues.some((issue) => issue.severity === 'error') || !Number.isFinite(aarsloen) || !skadesdato || !fodselsdato) {
    return { issues: dedupeIssuesBySeverityAndMessage(issues), computation: null };
  }

  const skadesaar = Number.parseInt(skadesdato.slice(0, 4), 10);
  const maxAarsloenISkadesaar = aarsloenMax[skadesaar];
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
  const needsKoen = resolvedRows.some((row) => row.kapDato < '2015-03-01');
  if (needsKoen && !values.koen) {
    issues.push(toIssue('missing-koen', 'Ved kapitalisering før 1. marts 2015 skal køn angives.'));
    return { issues: dedupeIssuesBySeverityAndMessage(issues), computation: null };
  }

  const computations: EetKapitaliseringAfgoerelseComputation[] = [];

  for (const row of resolvedRows) {
    const controlDate = row.tidlKapDato ?? row.afgoerelsesdato;
    const effectiveKapDato = row.tidlKapDato ?? row.kapDato;

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
        if (maxAge !== undefined && ageForFactor.years <= maxAge) {
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

    const kapitaliseringsaar = Number.parseInt(row.kapDato.slice(0, 4), 10);
    const aslReguleringRateInfo = resolveAslReguleringRateForKapAar(
      kapitaliseringsaar,
      before2024Skade,
      issues
    );
    if (!aslReguleringRateInfo || kapitaliseringsfaktor === null) continue;

    const grundydelse = round2(grundloen * (row.kapPct / 100) * erstatningsniveau * amFaktor);
    const reguleringFoer2024 = reguleringsprocentErhvervsevnetabFoer2024[2024];
    if (before2024Skade && !Number.isFinite(reguleringFoer2024)) {
      issues.push(toIssue('reguleringssats-missing', 'Reguleringssats mangler for år 2024.'));
      continue;
    }
    const grundydelse2024 = before2024Skade
      ? round2(grundydelse * (1 + reguleringFoer2024 / 100))
      : grundydelse;
    const effektivGrundydelse = before2024Skade && kapitaliseringsaar >= 2024 ? grundydelse2024 : grundydelse;
    const aarsydelse = round2(effektivGrundydelse * aslReguleringRateInfo.factor);
    const kapitalbelob = ceil0(aarsydelse * kapitaliseringsfaktor);
    const typeLabel = resolvedTabelData.kapitaliseringsType === 'vejl' ? 'Vejl.' : 'Bkg.';

    computations.push({
      rowId: row.rowId,
      afgoerelsesdato: row.afgoerelsesdato,
      kapitaliseringsdato: row.kapDato,
      kapitaliseringspct: row.kapPct,
      grundloen,
      erstatningsniveauPct: from2011 ? 83 : 80,
      amBidragPct: from2011 ? 8 : 0,
      grundydelse,
      reguleringsPctRounded4: round4(aslReguleringRateInfo.reguleringPct),
      aarsydelse,
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
