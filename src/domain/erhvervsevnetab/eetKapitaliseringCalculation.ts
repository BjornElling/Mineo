import type { AslAfgoerelseRow, ErhvervsevnetabValues } from '../../schemas/formSchemas';
import type { ISODateString } from '../../types/branded';
import { coerceToISODateString } from '../../types/branded';
import { amountValueToNumber } from '../../utils/expressionAmount';
import { formatIsoDateShort } from '../../utils/dateFormatting';
import { formatAsAmountTrimmed } from '../../utils/formatUtils';
import { dedupeIssuesBySeverityAndMessage } from '../../utils/issueUtils';
import { roundByMethod } from '../../utils/rounding';
import {
  ASL_MAX_AARSLOEN_2003,
  ASL_MAX_AARSLOEN_2024,
  aarsloenMax,
  reguleringsprocentErhvervsevnetab,
  reguleringsprocentErhvervsevnetabFoer2024,
  reguleringsprocentErhvervsevnetabFra2024,
} from '../../data/regulationRates';
import {
  type AldersFaktorRaekke,
  type KapitaliseringsTabelData,
  getKapitaliseringsTabelData,
} from '../../data/kapitalisering/kapitaliseringsTabeller';
import { hasTextValue, parsePercentDraft } from './eetAslAfgoerelser';
import {
  calculateAgeYearsMonths,
  resolveKapitaliseringsbekendtgoerelseId,
  resolveKapitaliseringTabelvalg,
  type AgeYearsMonths,
  type ResolvedKapitaliseringTabelvalg as ResolvedTabelvalg,
} from './eetKapitaliseringOpslag';

const SKAERING_2011_01_01 = '2011-01-01';
const SKAERING_2024_07_01 = '2024-07-01';

const round0 = (value: number): number => roundByMethod(value, 0, 'halfAwayFromZero');
const round2 = (value: number): number => roundByMethod(value, 2, 'halfAwayFromZero');
const round3 = (value: number): number => roundByMethod(value, 3, 'halfAwayFromZero');
const round4 = (value: number): number => roundByMethod(value, 4, 'halfAwayFromZero');
const roundNearest1000 = (value: number): number => roundByMethod(value / 1000, 0, 'halfAwayFromZero') * 1000;
const ceil0 = (value: number): number => roundByMethod(value, 0, 'ceil');

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
  kapitaliseringsfaktor: number;
  kapitalbelob: number;
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

type AslReguleringRateInfo = Readonly<{
  factor: number;
  reguleringPct: number;
}>;

type ResolveFactorTableResult = Readonly<{
  rows: readonly AldersFaktorRaekke[] | null;
  reason: 'missing-table' | 'missing-koen' | null;
}>;

const toIssue = (id: string, message: string): EetKapitaliseringIssue => ({
  id,
  severity: 'error',
  message,
});

const toMissingFieldIssue = (fieldId: string, fieldLabel: string): EetKapitaliseringIssue =>
  toIssue(`missing-${fieldId}`, `Der mangler indtastning af ${fieldLabel}`);

const toIsoDate = (value: unknown): ISODateString | undefined => coerceToISODateString(value);

const compareIso = (a: ISODateString, b: ISODateString): number => {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
};

const formatPercentTrimmedFromRounded4 = (value: number): string => {
  return formatAsAmountTrimmed(round4(value), 4);
};

export const formatDateShortForEet = (iso: ISODateString): string => formatIsoDateShort(iso);

const resolveSaerfaktor = (
  tabeldata: KapitaliseringsTabelData,
  skadesdato: ISODateString
): number | null => {
  const kandidat = tabeldata.saerfaktorUnderToAarTilFpPerSkadesinterval
    .filter((entry) => entry.skadesdatoFra <= skadesdato)
    .reduce<typeof tabeldata.saerfaktorUnderToAarTilFpPerSkadesinterval[number] | null>((latest, current) => {
      if (!latest) return current;
      return current.skadesdatoFra > latest.skadesdatoFra ? current : latest;
    }, null);
  return kandidat?.faktor ?? null;
};

const resolveFactorTable = (
  tabeldata: KapitaliseringsTabelData,
  tabel: string,
  koen: ErhvervsevnetabValues['koen']
): ResolveFactorTableResult => {
  const simpleTable = tabeldata.erhvervsevnetabTabeller[tabel];
  if (simpleTable && simpleTable.length > 0) {
    return { rows: simpleTable, reason: null };
  }

  const koensTable = tabeldata.erhvervsevnetabKoensopdelteTabeller[tabel];
  if (!koensTable || koensTable.length === 0) {
    return { rows: null, reason: 'missing-table' };
  }
  if (!koen) {
    return { rows: null, reason: 'missing-koen' };
  }

  const normalized = koensTable.map<AldersFaktorRaekke>((row) => ({
    alder: row.alder,
    faktor: koen === 'Mand' ? row.maendFaktor : row.kvinderFaktor,
  }));
  return { rows: normalized, reason: null };
};

const formatAgeForIssue = (age: AgeYearsMonths): string => `${age.years} år, ${age.months} måneder`;

const interpolateFactorWithinTable = (
  rows: readonly AldersFaktorRaekke[],
  age: AgeYearsMonths
): number | null => {
  const first = rows[0];
  const last = rows[rows.length - 1];
  if (!first || !last) return null;
  if (age.years < first.alder) return null;
  if (age.years > last.alder) return null;
  if (age.years === last.alder) return last.faktor;

  const lower = rows.find((row) => row.alder === age.years);
  const upper = rows.find((row) => row.alder === age.years + 1);
  if (!lower || !upper) return null;

  return ((12 - age.months) / 12) * lower.faktor + (age.months / 12) * upper.faktor;
};

const interpolateFactorBeyondTable = (
  rows: readonly AldersFaktorRaekke[],
  age: AgeYearsMonths,
  folkepensionsalderMaaneder: number,
  saerfaktor: number
): number | null => {
  const last = rows[rows.length - 1];
  if (!last) return null;

  const lastAgeMonths = last.alder * 12;
  const boundaryMonths = folkepensionsalderMaaneder - 24;
  if (boundaryMonths < lastAgeMonths) return null;
  if (age.totalMonths <= lastAgeMonths) return last.faktor;
  if (age.totalMonths >= boundaryMonths) return saerfaktor;

  const totalMonths = boundaryMonths - lastAgeMonths;
  if (totalMonths <= 0) return null;
  const monthsOver = age.totalMonths - lastAgeMonths;
  return last.faktor + (monthsOver / totalMonths) * (saerfaktor - last.faktor);
};

const resolveAslReguleringRateInfoForKapitaliseringsAar = (
  kapitaliseringsaar: number,
  before2024Skade: boolean,
  issues: EetKapitaliseringIssue[]
): AslReguleringRateInfo | null => {
  if (before2024Skade) {
    if (kapitaliseringsaar <= 2023) {
      const pct = reguleringsprocentErhvervsevnetab[kapitaliseringsaar];
      if (!Number.isFinite(pct)) {
        issues.push(toIssue('reguleringssats-missing', `Reguleringssats mangler for år ${kapitaliseringsaar}`));
        return null;
      }
      return { factor: 1 + pct / 100, reguleringPct: pct };
    }

    if (kapitaliseringsaar === 2024) {
      // 2024 er referenceår for opregulering fra 2003-niveau.
      // Selve 2024-opreguleringen anvendes særskilt på grundydelsen, så satsfaktoren her er 1.
      return { factor: 1, reguleringPct: 0 };
    }

    const pct = reguleringsprocentErhvervsevnetabFra2024[kapitaliseringsaar];
    if (!Number.isFinite(pct)) {
      issues.push(toIssue('reguleringssats-missing', `Reguleringssats mangler for år ${kapitaliseringsaar}`));
      return null;
    }
    return { factor: 1 + pct / 100, reguleringPct: pct };
  } else {
    const pct = reguleringsprocentErhvervsevnetabFra2024[kapitaliseringsaar];
    if (!Number.isFinite(pct)) {
      issues.push(toIssue('reguleringssats-missing', `Reguleringssats mangler for år ${kapitaliseringsaar}`));
      return null;
    }
    return { factor: 1 + pct / 100, reguleringPct: pct };
  }
};

const collectResolvedRows = (
  rows: readonly AslAfgoerelseRow[],
  issues: EetKapitaliseringIssue[]
): ResolvedKapitaliseringsRow[] => {
  const result: ResolvedKapitaliseringsRow[] = [];
  const rowsWithAfgoerelse = rows.filter((row) => {
    const eetPct = parsePercentDraft(row.eetPct);
    return (
      eetPct !== undefined &&
      eetPct > 0 &&
      toIsoDate(row.afgoerelsesDato) !== undefined &&
      row.afgoerelseType !== undefined
    );
  });
  const rowsWithKapitaliserbarAfgoerelse = rowsWithAfgoerelse.filter(
    (row) => row.afgoerelseType === 'Endelig' || row.afgoerelseType === 'Delvist endelig'
  );

  if (rowsWithAfgoerelse.length === 0) {
    const hasAnyAfgoerelsesdato = rows.some((row) => toIsoDate(row.afgoerelsesDato) !== undefined);
    const hasAnyAfgoerelsestype = rows.some((row) => row.afgoerelseType !== undefined);
    const hasAnyEetPct = rows.some((row) => {
      const eetPct = parsePercentDraft(row.eetPct);
      return eetPct !== undefined && eetPct > 0;
    });

    if (!hasAnyAfgoerelsesdato) {
      issues.push(toMissingFieldIssue('afgoerelsesdato', 'afgørelsesdato'));
    }
    if (!hasAnyAfgoerelsestype) {
      issues.push(toMissingFieldIssue('afgoerelsestype', 'afgørelsestype'));
    }
    if (!hasAnyEetPct) {
      issues.push(toMissingFieldIssue('eet-pct', 'EET %'));
    }
  }

  if (rowsWithAfgoerelse.length > 0 && rowsWithKapitaliserbarAfgoerelse.length === 0) {
    issues.push(
      toIssue(
        'no-endelig-afgoerelser',
        'Ingen endelig eller delvist endelig afgørelser indtastet.'
      )
    );
  }

  const hasKapDatoWithoutKapPct = rowsWithKapitaliserbarAfgoerelse.some(
    (row) =>
      hasTextValue(row.kapDato) &&
      !hasTextValue(row.kapPct)
  );
  if (hasKapDatoWithoutKapPct) {
    issues.push(toIssue('kap-dato-without-kap-pct', 'Der er indtastet kapitaliseringsdato men ikke -procent'));
  }

  const hasKapPctWithoutKapDato = rowsWithKapitaliserbarAfgoerelse.some(
    (row) =>
      hasTextValue(row.kapPct) &&
      !hasTextValue(row.kapDato)
  );
  if (hasKapPctWithoutKapDato) {
    issues.push(toIssue('kap-pct-without-kap-dato', 'Der er indtastet kapitaliseringsprocent men ikke -dato'));
  }

  for (const row of rows) {
    if (row.afgoerelseType !== 'Endelig' && row.afgoerelseType !== 'Delvist endelig') continue;
    const kapPct = parsePercentDraft(row.kapPct);
    if (kapPct === undefined || kapPct <= 0) continue;

    const afgoerelsesdato = toIsoDate(row.afgoerelsesDato);
    const kapDato = toIsoDate(row.kapDato);
    if (!afgoerelsesdato || !kapDato) continue;

    result.push({
      rowId: row.id,
      afgoerelsesdato,
      kapDato,
      kapPct,
      afgoerelseType: row.afgoerelseType,
      tidlKapDato: toIsoDate(row.tidlKapDato) ?? null,
    });
  }

  if (
    rowsWithKapitaliserbarAfgoerelse.length > 0 &&
    result.length === 0 &&
    !hasKapDatoWithoutKapPct &&
    !hasKapPctWithoutKapDato
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
    issues.push(toIssue('aarsloen-missing', 'Årsløn er ikke udfyldt'));
  }
  if (!fodselsdato) {
    issues.push(toIssue('fodselsdato-missing', 'Fødselsdato er ikke udfyldt'));
  }
  if (!skadesdato) {
    issues.push(toIssue('skadesdato-missing', 'Skadesdato er ikke udfyldt'));
  }

  const resolvedRows = collectResolvedRows(values.aslAfgoerelser, issues);

  if (issues.some((issue) => issue.severity === 'error') || !Number.isFinite(aarsloen) || !skadesdato || !fodselsdato) {
    return { issues: dedupeIssuesBySeverityAndMessage(issues), computation: null };
  }

  const skadesaar = Number.parseInt(skadesdato.slice(0, 4), 10);
  const maxAarsloenISkadesaar = aarsloenMax[skadesaar];
  if (!Number.isFinite(maxAarsloenISkadesaar)) {
    issues.push(toIssue('aarsloen-max-missing', `Maksimum årsløn mangler for år ${skadesaar}`));
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
  const computations: EetKapitaliseringAfgoerelseComputation[] = [];

  for (const row of resolvedRows) {
    const controlDate = row.tidlKapDato ?? row.afgoerelsesdato;
    const effectiveKapDato = row.tidlKapDato ?? row.kapDato;

    const controlBekId = resolveKapitaliseringsbekendtgoerelseId(skadesdato, controlDate);
    if (!controlBekId) {
      issues.push(
        toIssue(
          'kapitaliseringsbekendtgoerelse-missing-control-date',
          `Kapitaliseringsbekendtgørelse mangler for ${formatDateShortForEet(controlDate)}`
        )
      );
      continue;
    }

    const controlData = getKapitaliseringsTabelData(controlBekId);
    if (!controlData) {
      issues.push(
        toIssue(
          'kapitaliseringsbekendtgoerelse-missing-control-date',
          `Kapitaliseringsdata mangler for ${controlBekId}`
        )
      );
      continue;
    }

    const controlTabelvalg = resolveKapitaliseringTabelvalg(controlData, skadesdato, fodselsdato);
    if (!controlTabelvalg) {
      issues.push(
        toIssue(
          'kapitaliseringstabel-missing',
          `Ingen kapitaliseringstabel i ${controlBekId} matcher skadesdato og fødselsdato på kontroltidspunktet`
        )
      );
      continue;
    }

    const controlAge = calculateAgeYearsMonths(fodselsdato, controlDate);
    if (!controlAge) {
      issues.push(toIssue('kapitaliseringsfaktor-unresolved', 'Alder kan ikke beregnes for kontroltidspunktet'));
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

    if (useDirectSaerfaktor) {
      if (resolvedSaerfaktor === null) {
        issues.push(
          toIssue(
            'kapitaliseringsfaktor-unresolved',
            'Særfaktor mangler for kapitalisering under 2 år til folkepension'
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
            `Kapitaliseringsbekendtgørelse mangler for ${formatDateShortForEet(effectiveKapDato)}`
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
            `Kapitaliseringsdata mangler for ${effectiveBekId}`
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
            `Ingen kapitaliseringstabel i ${effectiveBekId} matcher skadesdato og fødselsdato på kapitaliseringstidspunktet`
          )
        );
        continue;
      }
      resolvedTabelvalg = effectiveTabelvalg;
      resolvedSaerfaktor = resolveSaerfaktor(effectiveData, skadesdato);
      const effectiveAge = calculateAgeYearsMonths(fodselsdato, effectiveKapDato);
      if (!effectiveAge) {
        issues.push(toIssue('kapitaliseringsfaktor-unresolved', 'Alder kan ikke beregnes på kapitaliseringstidspunktet'));
        continue;
      }
      ageForFactor = effectiveAge;

      const factorTableResult = resolveFactorTable(effectiveData, effectiveTabelvalg.tabel, values.koen);
      const factorTable = factorTableResult.rows;
      if (!factorTable || factorTable.length === 0) {
        const message =
          factorTableResult.reason === 'missing-koen'
            ? `Køn mangler for kapitaliseringstabel ${effectiveTabelvalg.tabel}`
            : `Ingen kapitaliseringsfaktorer indtastet for tabel ${effectiveTabelvalg.tabel}`;
        issues.push(
          toIssue(
            'kapitaliseringstabel-missing',
            message
          )
        );
        continue;
      }

      const minAge = factorTable[0]?.alder;
      if (minAge === undefined || ageForFactor.years < minAge) {
        issues.push(
          toIssue(
            'kapitaliseringsalder-under-minimum',
            `Ingen kapitaliseringsfaktor indtastet for alder (${formatAgeForIssue(ageForFactor)}) - tabellen starter ved ${minAge} år`
          )
        );
        continue;
      }

      const withinTable = interpolateFactorWithinTable(factorTable, ageForFactor);
      if (withinTable !== null) {
        kapitaliseringsfaktor = round3(withinTable);
      } else {
        const maxAge = factorTable[factorTable.length - 1]?.alder;
        if (maxAge !== undefined && ageForFactor.years <= maxAge) {
          issues.push(
            toIssue(
              'kapitaliseringsfaktor-unresolved',
              `Ingen kapitaliseringsfaktor indtastet for alder (${formatAgeForIssue(ageForFactor)}) i tabel ${effectiveTabelvalg.tabel}`
            )
          );
          continue;
        }
        if (resolvedSaerfaktor === null) {
          issues.push(
            toIssue(
              'kapitaliseringsfaktor-unresolved',
              'Kapitaliseringsfaktor kan ikke beregnes, fordi særfaktor mangler'
            )
          );
          continue;
        }
        const beyondTable = interpolateFactorBeyondTable(
          factorTable,
          ageForFactor,
          effectiveTabelvalg.folkepensionsalderMaaneder,
          resolvedSaerfaktor
        );
        if (beyondTable === null) {
          issues.push(
            toIssue(
              'kapitaliseringsfaktor-unresolved',
              `Kapitaliseringsfaktor kan ikke beregnes for alder (${formatAgeForIssue(ageForFactor)}) ud fra tabel ${effectiveTabelvalg.tabel} og særfaktor`
            )
          );
          continue;
        }
        kapitaliseringsfaktor = round3(beyondTable);
      }
    }

    const kapitaliseringsaar = Number.parseInt(row.kapDato.slice(0, 4), 10);
    const aslReguleringRateInfo = resolveAslReguleringRateInfoForKapitaliseringsAar(
      kapitaliseringsaar,
      before2024Skade,
      issues
    );
    if (!aslReguleringRateInfo || kapitaliseringsfaktor === null) continue;

    const grundydelse = round2(grundloen * (row.kapPct / 100) * erstatningsniveau * amFaktor);
    const reguleringFoer2024 = reguleringsprocentErhvervsevnetabFoer2024[2024];
    if (before2024Skade && !Number.isFinite(reguleringFoer2024)) {
      issues.push(toIssue('reguleringssats-missing', 'Reguleringssats mangler for år 2024'));
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
      kapitaliseringsfaktor,
      kapitalbelob,
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

export const formatKapitaliseringsPct = (value: number): string => `${formatPercentTrimmedFromRounded4(value)} %`;
