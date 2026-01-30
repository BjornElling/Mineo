import { z } from 'zod';

const roundingMethodSchema = z.enum(['halfAwayFromZero', 'ceil', 'floor', 'none']);
const roundingWhenSchema = z.enum(['perLine', 'onlyTotal', 'perLineThenTotal', 'none']);
const valueSourceStrategySchema = z.enum(['computedOnly']);
const signSchema = z.enum(['positive', 'negative', 'fromSource']);

const lineRoundingSchema = z.object({
  method: roundingMethodSchema,
  precision: z.number().int().min(0),
});

const totalRoundingSchema = lineRoundingSchema.extend({
  when: roundingWhenSchema,
});

const linePolicySchema = z.object({
  id: z.string().min(1),
  computedSourceId: z.string().min(1).optional(),
  computedValuePath: z.string().min(1).optional(),
  strategy: valueSourceStrategySchema,
  sign: signSchema,
  roundingOverride: lineRoundingSchema.optional(),
});

export const aggregationPolicySchema = z
  .object({
    lines: z.array(linePolicySchema).min(1),
    lineRounding: lineRoundingSchema,
    totalRounding: totalRoundingSchema,
    outputMode: z.literal('lineItems'),
  })
  .superRefine((value, ctx) => {
    const ids = new Set<string>();
    for (const line of value.lines) {
      if (ids.has(line.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate line id: ${line.id}`,
          path: ['lines'],
        });
      }
      ids.add(line.id);

      if (line.computedValuePath && !line.computedSourceId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `computedValuePath requires computedSourceId for line ${line.id}`,
          path: ['lines'],
        });
      }
      if (line.strategy === 'computedOnly' && !line.computedSourceId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `computedSourceId is required for line ${line.id}`,
          path: ['lines'],
        });
      }
    }
  });

export type AggregationPolicy = z.infer<typeof aggregationPolicySchema>;
export type AggregationLinePolicy = z.infer<typeof linePolicySchema>;
export type AggregationLineRounding = z.infer<typeof lineRoundingSchema>;
export type AggregationTotalRounding = z.infer<typeof totalRoundingSchema>;
export type AggregationValueSourceStrategy = z.infer<typeof valueSourceStrategySchema>;
export type AggregationSign = z.infer<typeof signSchema>;
