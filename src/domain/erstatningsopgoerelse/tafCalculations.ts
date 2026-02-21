import type { FerieperiodeRow } from '../../schemas/formSchemas';
import { parseISODate, type ISODateString } from '../../types/branded';
import { countInclusiveUtcDays } from '../../utils/utcDayMath';
import {
  optaelArbejdsdage as motorOptaelArbejdsdage,
  optaelArbejdsdageBreakdown as motorOptaelArbejdsdageBreakdown,
  optaelMaanederAfrundet as motorOptaelMaanederAfrundet,
  optaelMaanederPraecis as motorOptaelMaanederPraecis,
  type ArbejdsdageBeregningskontekst as MotorArbejdsdageBeregningskontekst,
  type ArbejdsdageBreakdown as MotorArbejdsdageBreakdown,
} from './periodiseringsMotor';

// NOTE: "Arbejdsdage" i denne kontekst er hverdage minus SH-dage og feriedage,
// mens "hverdage" er alle ugedage man-fre uden fradrag. Brug præcis terminologi i labels.

export const calculateKalenderdageInclusive = (
  fra: ISODateString | undefined,
  til: ISODateString | undefined
): number | null => {
  if (!fra || !til) return null;
  if (fra > til) return null;

  const fraDate = parseISODate(fra);
  const tilDate = parseISODate(til);
  if (!fraDate || !tilDate) return null;

  const days = countInclusiveUtcDays(fraDate, tilDate);
  return days !== null && days >= 1 ? days : null;
};

export const calculateTafAntalMaaneder = (
  fra: ISODateString | undefined,
  til: ISODateString | undefined,
  oevrigeFravaersdage: number = 0
): number | null => {
  return motorOptaelMaanederAfrundet({
    fra,
    til,
    oevrigeFravaersdage,
  });
};

export const calculateTafAntalMaanederPraecis = (
  fra: ISODateString | undefined,
  til: ISODateString | undefined,
  oevrigeFravaersdage: number = 0
): number | null => {
  return motorOptaelMaanederPraecis({
    fra,
    til,
    oevrigeFravaersdage,
  });
};

export type ArbejdsdageBeregningskontekst = MotorArbejdsdageBeregningskontekst;

export const calculateTafAntalArbejdsdage = (
  fra: ISODateString | undefined,
  til: ISODateString | undefined,
  ferieperioder: readonly FerieperiodeRow[],
  loseFeriedage: number,
  context: ArbejdsdageBeregningskontekst
): number | null => {
  return motorOptaelArbejdsdage({
    fra,
    til,
    ferieperioder,
    loseFeriedage,
    context,
  });
};

export type TafArbejdsdageBreakdown = MotorArbejdsdageBreakdown;

export const calculateTafArbejdsdageBreakdown = (
  fra: ISODateString | undefined,
  til: ISODateString | undefined,
  ferieperioder: readonly FerieperiodeRow[],
  loseFeriedage: number,
  context: ArbejdsdageBeregningskontekst
): TafArbejdsdageBreakdown | null => {
  return motorOptaelArbejdsdageBreakdown({
    fra,
    til,
    ferieperioder,
    loseFeriedage,
    context,
  });
};
