import type { OffentligLoenTypeLabel } from '../../../../schemas/formSchemas';
import type { AmountValue } from '../../../../schemas/amountExpressionSchema';
import type { ISODateString } from '../../../../types/branded';
import { parseISODate } from '../../../../types/branded';
import { formatDanishDate } from '../../../../utils/dateUtils';
import { amountValueToNumber } from '../../../../utils/expressionAmount';
import { getOverenskomstMetaById, getOffentligOverenskomstTypeById } from '../../../../data/overenskomstRates';
import { getOffentligLoenTabelForDato } from '../../../../data/offentligLoenLookup';

/**
 * Delt, ren beregnings-/valideringskerne for løntrin-finder-overlayet.
 *
 * Bevidst React-fri: tager allerede-resolvet input og returnerer et resultat. `useLoentrinFinder`
 * (samme mappe) ejer state og kalder denne kerne for beregningslogikken (inputvalidering +
 * satstabel-opslag + resultatbygning/-sortering). Kernen blev udskilt, mens de to flader endnu havde
 * hver sin hook; de er nu konsolideret til én, men adskillelsen består, fordi den holder den rene
 * beregning testbar uden React.
 */

export type LoentrinFinderErrors = Readonly<{
  beloeb?: string;
  dato?: string;
}>;

export type LoentrinFinderResult = Readonly<{
  loentrin: number | '55+';
  gruppe: 0 | 1 | 2 | 3 | 4;
  beloeb: number;
  diff: number;
}>;

/**
 * Udfald af et beregningsforsøg. `ok: false` betyder at knappen skal "ryste" (shake) og
 * at de medfølgende errors skal vises; `ok: true` betyder gyldige resultater og ryddede errors.
 */
export type LoentrinFinderCalculationOutcome =
  | Readonly<{ ok: false; errors: LoentrinFinderErrors }>
  | Readonly<{ ok: true; results: ReadonlyArray<LoentrinFinderResult> }>;

export type LoentrinFinderCalculationInput = Readonly<{
  overenskomstId: string | undefined;
  ansaettelse: OffentligLoenTypeLabel;
  beloeb: AmountValue | undefined;
  dato: ISODateString | undefined;
  amountFieldError: string | undefined;
  dateFieldError: string | undefined;
}>;

const LOENGRUPPER = [0, 1, 2, 3, 4] as const;

const parseLoentrinSortValue = (loentrin: number | '55+'): number => (loentrin === '55+' ? 56 : loentrin);

/**
 * Beregner overenskomst-labelet (delt med overlayets visning).
 */
export const resolveLoentrinFinderOverenskomstLabel = (overenskomstId: string | undefined): string => {
  const id = overenskomstId?.trim();
  if (!id) return 'Ingen overenskomst valgt';
  const meta = getOverenskomstMetaById(id);
  return meta?.navn ?? id;
};

/**
 * Inputvalidering. Identisk på tværs af de to varianter.
 */
const validateLoentrinFinderInput = (
  input: LoentrinFinderCalculationInput
): { errors: LoentrinFinderErrors; beloebNumber: number | undefined } => {
  const errors: { beloeb?: string; dato?: string } = {};
  const beloebNumber = amountValueToNumber(input.beloeb);

  if (input.amountFieldError) {
    errors.beloeb = input.amountFieldError;
  } else if (beloebNumber === undefined) {
    errors.beloeb = 'Beløb skal udfyldes';
  } else if (beloebNumber <= 0) {
    errors.beloeb = 'Beløb skal være større end 0';
  }

  if (input.dateFieldError) {
    errors.dato = input.dateFieldError;
  } else if (!input.dato) {
    errors.dato = 'Dato skal udfyldes';
  }

  return { errors, beloebNumber };
};

/**
 * Kerneberegning: inputvalidering + satstabel-opslag + resultatbygning/-sortering (top-5).
 * Ren funktion uden side-effekter – kalderen mapper udfaldet til React-state og shake.
 */
export const calculateLoentrinFinderResults = (
  input: LoentrinFinderCalculationInput
): LoentrinFinderCalculationOutcome => {
  const resolvedOverenskomstId = input.overenskomstId ?? '';
  const offentligOverenskomstType = getOffentligOverenskomstTypeById(resolvedOverenskomstId);
  const overenskomstLabel = resolveLoentrinFinderOverenskomstLabel(input.overenskomstId);

  if (!offentligOverenskomstType) {
    return { ok: false, errors: { dato: 'Offentlig overenskomst er ikke valgt' } };
  }

  const validation = validateLoentrinFinderInput(input);
  const hasInputErrors = Boolean(validation.errors.beloeb) || Boolean(validation.errors.dato);
  if (hasInputErrors || validation.beloebNumber === undefined || !input.dato) {
    return { ok: false, errors: validation.errors };
  }

  const parsedDate = parseISODate(input.dato);
  if (!parsedDate) {
    return { ok: false, errors: { ...validation.errors, dato: 'Dato skal udfyldes' } };
  }

  const danishDate = formatDanishDate(parsedDate);
  const loenTabel = getOffentligLoenTabelForDato(offentligOverenskomstType, danishDate);
  if (!loenTabel) {
    return {
      ok: false,
      errors: {
        ...validation.errors,
        dato: `Der findes ingen satser for ${overenskomstLabel} på den valgte dato`,
      },
    };
  }

  const results: LoentrinFinderResult[] = [];
  for (const entry of loenTabel.entries) {
    for (const gruppe of LOENGRUPPER) {
      const beloeb = input.ansaettelse === 'Timeløn' ? entry.timeLoen[gruppe] : entry.maanedsLoen[gruppe];
      results.push({
        loentrin: entry.loentrin,
        gruppe,
        beloeb,
        diff: Math.abs(beloeb - validation.beloebNumber),
      });
    }
  }

  results.sort((a, b) => {
    if (a.diff !== b.diff) return a.diff - b.diff;
    const trinDiff = parseLoentrinSortValue(a.loentrin) - parseLoentrinSortValue(b.loentrin);
    if (trinDiff !== 0) return trinDiff;
    return a.gruppe - b.gruppe;
  });

  return { ok: true, results: results.slice(0, 5) };
};
