import { describe, expect, it } from 'vitest';
import { aggregationPolicySchema } from '../../../domain/erstatningsopgoerelse/erstatningsopgoerelseAggregationPolicy';

// Bygger et minimalt gyldigt policy-objekt
const validPolicy = () => ({
  outputMode: 'lineItems' as const,
  lineRounding: { method: 'halfAwayFromZero' as const, precision: 2 },
  totalRounding: { when: 'onlyTotal' as const, method: 'halfAwayFromZero' as const, precision: 0 },
  lines: [
    {
      id: 'taf',
      computedSourceId: 'taf',
      strategy: 'computedOnly' as const,
      sign: 'positive' as const,
    },
  ],
});

describe('aggregationPolicySchema', () => {
  describe('valid policies', () => {
    it('accepterer en gyldig minimal policy', () => {
      const result = aggregationPolicySchema.safeParse(validPolicy());
      expect(result.success).toBe(true);
    });

    it('accepterer alle rounding-methods', () => {
      for (const method of ['halfAwayFromZero', 'ceil', 'floor', 'none'] as const) {
        const policy = {
          ...validPolicy(),
          lineRounding: { method, precision: 0 },
        };
        const result = aggregationPolicySchema.safeParse(policy);
        expect(result.success).toBe(true);
      }
    });

    it('accepterer alle totalRounding.when-værdier', () => {
      for (const when of ['perLine', 'onlyTotal', 'perLineThenTotal', 'none'] as const) {
        const policy = {
          ...validPolicy(),
          totalRounding: { when, method: 'halfAwayFromZero' as const, precision: 0 },
        };
        const result = aggregationPolicySchema.safeParse(policy);
        expect(result.success).toBe(true);
      }
    });

    it('accepterer linje med computedValuePath (kræver computedSourceId)', () => {
      const policy = {
        ...validPolicy(),
        lines: [
          {
            id: 'taf',
            computedSourceId: 'tafEngine',
            computedValuePath: 'result.amount',
            strategy: 'computedOnly' as const,
            sign: 'positive' as const,
          },
        ],
      };
      const result = aggregationPolicySchema.safeParse(policy);
      expect(result.success).toBe(true);
    });

    it('accepterer sign = negative', () => {
      const policy = {
        ...validPolicy(),
        lines: [
          {
            id: 'fradrag',
            computedSourceId: 'fradragEngine',
            strategy: 'computedOnly' as const,
            sign: 'negative' as const,
          },
        ],
      };
      const result = aggregationPolicySchema.safeParse(policy);
      expect(result.success).toBe(true);
    });

    it('accepterer roundingOverride på linje', () => {
      const policy = {
        ...validPolicy(),
        lines: [
          {
            id: 'taf',
            computedSourceId: 'taf',
            strategy: 'computedOnly' as const,
            sign: 'positive' as const,
            roundingOverride: { method: 'ceil' as const, precision: 2 },
          },
        ],
      };
      const result = aggregationPolicySchema.safeParse(policy);
      expect(result.success).toBe(true);
    });

    it('accepterer precision = 0', () => {
      const policy = {
        ...validPolicy(),
        lineRounding: { method: 'halfAwayFromZero' as const, precision: 0 },
      };
      const result = aggregationPolicySchema.safeParse(policy);
      expect(result.success).toBe(true);
    });

    it('accepterer mange linjer', () => {
      const lines = ['taf', 'svieSmerte', 'loenindkomst', 'offentligeYdelser', 'oevrigeKrav'].map((id) => ({
        id,
        computedSourceId: id,
        strategy: 'computedOnly' as const,
        sign: 'positive' as const,
      }));
      const policy = { ...validPolicy(), lines };
      const result = aggregationPolicySchema.safeParse(policy);
      expect(result.success).toBe(true);
    });
  });

  describe('duplikerede line ids', () => {
    it('fejler ved duplikeret id', () => {
      const policy = {
        ...validPolicy(),
        lines: [
          {
            id: 'taf',
            computedSourceId: 'taf',
            strategy: 'computedOnly' as const,
            sign: 'positive' as const,
          },
          {
            id: 'taf',
            computedSourceId: 'tafDuplicate',
            strategy: 'computedOnly' as const,
            sign: 'positive' as const,
          },
        ],
      };
      const result = aggregationPolicySchema.safeParse(policy);
      expect(result.success).toBe(false);
      if (!result.success) {
        const msgs = result.error.issues.map((i) => i.message);
        expect(msgs.some((m) => m.includes('Duplicate line id: taf'))).toBe(true);
      }
    });

    it('accepterer to linjer med unikke ids', () => {
      const policy = {
        ...validPolicy(),
        lines: [
          { id: 'a', computedSourceId: 'a', strategy: 'computedOnly' as const, sign: 'positive' as const },
          { id: 'b', computedSourceId: 'b', strategy: 'computedOnly' as const, sign: 'positive' as const },
        ],
      };
      expect(aggregationPolicySchema.safeParse(policy).success).toBe(true);
    });
  });

  describe('computedValuePath uden computedSourceId', () => {
    it('fejler ved computedValuePath uden computedSourceId', () => {
      const policy = {
        ...validPolicy(),
        lines: [
          {
            id: 'taf',
            // computedSourceId er bevidst udeladt
            computedValuePath: 'result.amount',
            strategy: 'computedOnly' as const,
            sign: 'positive' as const,
          },
        ],
      };
      const result = aggregationPolicySchema.safeParse(policy);
      expect(result.success).toBe(false);
      if (!result.success) {
        const msgs = result.error.issues.map((i) => i.message);
        // Skal rapportere computedValuePath-fejl OG computedSourceId-fejl (strategy = computedOnly)
        expect(msgs.some((m) => m.includes('computedValuePath requires computedSourceId'))).toBe(true);
      }
    });
  });

  describe('strategy = computedOnly uden computedSourceId', () => {
    it('fejler ved computedOnly uden computedSourceId', () => {
      const policy = {
        ...validPolicy(),
        lines: [
          {
            id: 'taf',
            // computedSourceId udeladt
            strategy: 'computedOnly' as const,
            sign: 'positive' as const,
          },
        ],
      };
      const result = aggregationPolicySchema.safeParse(policy);
      expect(result.success).toBe(false);
      if (!result.success) {
        const msgs = result.error.issues.map((i) => i.message);
        expect(msgs.some((m) => m.includes('computedSourceId is required for line taf'))).toBe(true);
      }
    });
  });

  describe('strukturelle valideringsfejl', () => {
    it('fejler ved outputMode !== "lineItems"', () => {
      const policy = { ...validPolicy(), outputMode: 'other' };
      expect(aggregationPolicySchema.safeParse(policy).success).toBe(false);
    });

    it('fejler ved tom lines-array', () => {
      const policy = { ...validPolicy(), lines: [] };
      expect(aggregationPolicySchema.safeParse(policy).success).toBe(false);
    });

    it('fejler ved negativ precision', () => {
      const policy = {
        ...validPolicy(),
        lineRounding: { method: 'halfAwayFromZero' as const, precision: -1 },
      };
      expect(aggregationPolicySchema.safeParse(policy).success).toBe(false);
    });

    it('fejler ved ikke-integer precision', () => {
      const policy = {
        ...validPolicy(),
        lineRounding: { method: 'halfAwayFromZero' as const, precision: 1.5 },
      };
      expect(aggregationPolicySchema.safeParse(policy).success).toBe(false);
    });

    it('fejler ved ugyldig rounding-method', () => {
      const policy = {
        ...validPolicy(),
        lineRounding: { method: 'round', precision: 0 },
      };
      expect(aggregationPolicySchema.safeParse(policy).success).toBe(false);
    });

    it('fejler ved ugyldig sign', () => {
      const policy = {
        ...validPolicy(),
        lines: [
          { id: 'taf', computedSourceId: 'taf', strategy: 'computedOnly' as const, sign: 'neutral' },
        ],
      };
      expect(aggregationPolicySchema.safeParse(policy).success).toBe(false);
    });

    it('fejler ved tom linje-id', () => {
      const policy = {
        ...validPolicy(),
        lines: [
          { id: '', computedSourceId: 'taf', strategy: 'computedOnly' as const, sign: 'positive' as const },
        ],
      };
      expect(aggregationPolicySchema.safeParse(policy).success).toBe(false);
    });

    it('fejler ved tom computedSourceId', () => {
      const policy = {
        ...validPolicy(),
        lines: [
          { id: 'taf', computedSourceId: '', strategy: 'computedOnly' as const, sign: 'positive' as const },
        ],
      };
      expect(aggregationPolicySchema.safeParse(policy).success).toBe(false);
    });

    it('fejler ved manglende felter i policy', () => {
      expect(aggregationPolicySchema.safeParse({}).success).toBe(false);
      expect(aggregationPolicySchema.safeParse({ outputMode: 'lineItems' }).success).toBe(false);
    });
  });

  describe('roundingOverride edge cases', () => {
    it('accepterer roundingOverride med method=none', () => {
      const policy = {
        ...validPolicy(),
        lines: [
          {
            id: 'taf',
            computedSourceId: 'taf',
            strategy: 'computedOnly' as const,
            sign: 'positive' as const,
            roundingOverride: { method: 'none' as const, precision: 0 },
          },
        ],
      };
      expect(aggregationPolicySchema.safeParse(policy).success).toBe(true);
    });
  });

  describe('strategy enum eksklusivitet', () => {
    it('fejler ved ugyldig strategy-værdi', () => {
      const policy = {
        ...validPolicy(),
        lines: [
          { id: 'taf', computedSourceId: 'taf', strategy: 'manual' as any, sign: 'positive' as const },
        ],
      };
      expect(aggregationPolicySchema.safeParse(policy).success).toBe(false);
    });
  });

  describe('parsing muterer ikke input', () => {
    it('safeParse muterer ikke originalt objekt', () => {
      const input = validPolicy();
      const originalLines = input.lines.length;
      aggregationPolicySchema.safeParse(input);
      expect(input.lines.length).toBe(originalLines);
    });
  });

  describe('type-inference', () => {
    it('parse returnerer typet objekt med korrekte felter', () => {
      const result = aggregationPolicySchema.parse(validPolicy());
      expect(result.outputMode).toBe('lineItems');
      expect(result.lineRounding.method).toBe('halfAwayFromZero');
      expect(result.totalRounding.when).toBe('onlyTotal');
      expect(result.lines[0].id).toBe('taf');
      expect(result.lines[0].sign).toBe('positive');
      expect(result.lines[0].strategy).toBe('computedOnly');
    });
  });
});
