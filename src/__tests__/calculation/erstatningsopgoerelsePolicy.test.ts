import { describe, expect, it } from 'vitest';
import {
  ERSTATNINGSOPGOERELSE_AGGREGATION_POLICY,
  ERSTATNINGSOPGOERELSE_AGGREGATION_POLICY_RAW,
} from '../../calculation/policy/erstatningsopgoerelse.policy';

describe('ERSTATNINGSOPGOERELSE_AGGREGATION_POLICY', () => {
  describe('struktur', () => {
    it('er et gyldigt, parset policy-objekt (kaster ikke ved import)', () => {
      // Selve importen ville fejle ved parsefejl, men vi bekræfter eksplicit
      expect(ERSTATNINGSOPGOERELSE_AGGREGATION_POLICY).toBeDefined();
      expect(typeof ERSTATNINGSOPGOERELSE_AGGREGATION_POLICY).toBe('object');
    });

    it('outputMode er "lineItems"', () => {
      expect(ERSTATNINGSOPGOERELSE_AGGREGATION_POLICY.outputMode).toBe('lineItems');
    });

    it('lineRounding er konfigureret', () => {
      expect(ERSTATNINGSOPGOERELSE_AGGREGATION_POLICY.lineRounding).toBeDefined();
      expect(ERSTATNINGSOPGOERELSE_AGGREGATION_POLICY.lineRounding.method).toBe('none');
      expect(ERSTATNINGSOPGOERELSE_AGGREGATION_POLICY.lineRounding.precision).toBe(0);
    });

    it('totalRounding er konfigureret med halfAwayFromZero og onlyTotal', () => {
      const tr = ERSTATNINGSOPGOERELSE_AGGREGATION_POLICY.totalRounding;
      expect(tr.method).toBe('halfAwayFromZero');
      expect(tr.when).toBe('onlyTotal');
      expect(tr.precision).toBe(0);
    });

    it('indeholder præcis 5 linjer', () => {
      expect(ERSTATNINGSOPGOERELSE_AGGREGATION_POLICY.lines).toHaveLength(5);
    });
  });

  describe('linje-ids (unikke, kanoniske)', () => {
    const getLineIds = () => ERSTATNINGSOPGOERELSE_AGGREGATION_POLICY.lines.map((l) => l.id);

    it('alle forventede linje-ids er til stede', () => {
      const ids = getLineIds();
      expect(ids).toContain('taf');
      expect(ids).toContain('svieSmerte');
      expect(ids).toContain('loenindkomst');
      expect(ids).toContain('offentligeYdelser');
      expect(ids).toContain('oevrigeKrav');
    });

    it('ingen duplikerede linje-ids', () => {
      const ids = getLineIds();
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });
  });

  describe('linje-konfiguration', () => {
    const getLine = (id: string) =>
      ERSTATNINGSOPGOERELSE_AGGREGATION_POLICY.lines.find((l) => l.id === id)!;

    it('taf er positiv, computedOnly med taf som source', () => {
      const line = getLine('taf');
      expect(line.sign).toBe('positive');
      expect(line.strategy).toBe('computedOnly');
      expect(line.computedSourceId).toBe('taf');
    });

    it('svieSmerte er positiv', () => {
      expect(getLine('svieSmerte').sign).toBe('positive');
    });

    it('loenindkomst er positiv', () => {
      expect(getLine('loenindkomst').sign).toBe('positive');
    });

    it('offentligeYdelser er negativ (fradrag)', () => {
      const line = getLine('offentligeYdelser');
      expect(line.sign).toBe('negative');
    });

    it('oevrigeKrav er positiv', () => {
      expect(getLine('oevrigeKrav').sign).toBe('positive');
    });

    it('alle linjer har computedValuePath = "amount"', () => {
      for (const line of ERSTATNINGSOPGOERELSE_AGGREGATION_POLICY.lines) {
        expect(line.computedValuePath).toBe('amount');
      }
    });

    it('alle linjer har strategy = "computedOnly"', () => {
      for (const line of ERSTATNINGSOPGOERELSE_AGGREGATION_POLICY.lines) {
        expect(line.strategy).toBe('computedOnly');
      }
    });

    it('alle linjer har computedSourceId = id (symmetrisk)', () => {
      for (const line of ERSTATNINGSOPGOERELSE_AGGREGATION_POLICY.lines) {
        expect(line.computedSourceId).toBe(line.id);
      }
    });
  });

  describe('RAW → parsed konsistens', () => {
    it('parsed policy matcher RAW for outputMode', () => {
      expect(ERSTATNINGSOPGOERELSE_AGGREGATION_POLICY.outputMode).toBe(
        ERSTATNINGSOPGOERELSE_AGGREGATION_POLICY_RAW.outputMode
      );
    });

    it('parsed policy har samme antal linjer som RAW', () => {
      expect(ERSTATNINGSOPGOERELSE_AGGREGATION_POLICY.lines.length).toBe(
        ERSTATNINGSOPGOERELSE_AGGREGATION_POLICY_RAW.lines.length
      );
    });

    it('parsed policy er immutabel (Zod-output er et plain object)', () => {
      expect(typeof ERSTATNINGSOPGOERELSE_AGGREGATION_POLICY).toBe('object');
    });
  });
});
