import { z } from 'zod';
import type { EODebugSnapshot } from './eoDebugSnapshot';
import type { SammentaellingDisplayRow } from './eoDebugSammentaelling';

const ControlMismatchReportV1Schema = z.object({
  version: z.literal('v1'),
  createdAt: z.string(),
  mismatches: z.array(
    z.object({
      key: z.string(),
      label: z.string(),
      beregnet: z.string(),
      tabel: z.string(),
    })
  ),
  sammentaelling: z.unknown(),
  context: z.object({
    skadesdato: z.string().optional(),
    skadestype: z.string().optional(),
    beregningsperiodeFra: z.string().optional(),
    beregningsperiodeTil: z.string().optional(),
    vedroererPeriodeFra: z.string().optional(),
    vedroererPeriodeTil: z.string().optional(),
  }),
  fieldErrors: z.unknown(),
});

export type ControlMismatchReport = z.infer<typeof ControlMismatchReportV1Schema>;
export const ControlMismatchReportSchema = ControlMismatchReportV1Schema;

export const buildControlMismatchReport = (
  snapshot: EODebugSnapshot,
  mismatches: readonly SammentaellingDisplayRow[]
): ControlMismatchReport => {
  const report: ControlMismatchReport = {
    version: 'v1',
    createdAt: snapshot.createdAt,
    mismatches: mismatches.map((row) => ({
      key: row.key,
      label: row.label,
      beregnet: row.control.beregnetDisplay,
      tabel: row.control.tabelDisplay,
    })),
    sammentaelling: snapshot.sammentaelling,
    context: {
      skadesdato: snapshot.stamdataValues.skadesdato,
      skadestype: snapshot.stamdataValues.skadestype,
      beregningsperiodeFra: snapshot.eoValues.periodeTilBeregningFra,
      beregningsperiodeTil: snapshot.eoValues.periodeTilBeregningTil,
      vedroererPeriodeFra: snapshot.eoValues.vedroererPeriodeFra,
      vedroererPeriodeTil: snapshot.eoValues.vedroererPeriodeTil,
    },
    fieldErrors: snapshot.fieldErrors,
  };
  return ControlMismatchReportV1Schema.parse(report);
};
