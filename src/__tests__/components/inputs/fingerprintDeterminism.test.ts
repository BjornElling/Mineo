import { describe, expect, it } from 'vitest';
import {
  createAmountParserSpec,
  createDateParserSpec,
  createIntegerParserSpec,
  createPercentParserSpec,
} from '../../../components/inputs/shared/fingerprintParserSpecs';

const expectOkAndIdempotent = <TModel, TCanonical, TFingerprint>(
  spec: { parse: (raw: string) => { kind: 'ok'; model: TModel; canonical: TCanonical; fingerprint: TFingerprint } | { kind: 'invalid' | 'config-error' } },
  raw: string
) => {
  const first = spec.parse(raw);
  expect(first.kind).toBe('ok');
  if (first.kind !== 'ok') {
    throw new Error(`Forventede kind='ok' for input "${raw}"`);
  }

  const second = spec.parse(raw);
  expect(second.kind).toBe('ok');
  if (second.kind !== 'ok') {
    throw new Error(`Forventede kind='ok' ved gentagen parse for input "${raw}"`);
  }

  expect(second.fingerprint).toBe(first.fingerprint);
  return first;
};

describe('fingerprint determinisme', () => {
  it('amount-parser giver stabile fingerprints for ok-cases', () => {
    const spec = createAmountParserSpec({
      precision: 2,
      allowNegative: true,
      maxIntegerDigits: 20,
      maxRawLength: 64,
    });

    const equivalent = ['1', '1,0', '1,00', '01,00'].map((raw) => expectOkAndIdempotent(spec, raw));
    for (const parsed of equivalent.slice(1)) {
      expect(parsed.fingerprint).toBe(equivalent[0]?.fingerprint);
    }

    const expression = expectOkAndIdempotent(spec, '(1+2)');
    expect(expression.fingerprint).toContain('e:');
  });

  it('integer-parser giver stabile fingerprints og canonical roundtrip for ok-cases', () => {
    const spec = createIntegerParserSpec({ minValue: 0, maxValue: 9999 });

    const equivalent = ['1', '01', '001'].map((raw) => expectOkAndIdempotent(spec, raw));
    for (const parsed of equivalent.slice(1)) {
      expect(parsed.fingerprint).toBe(equivalent[0]?.fingerprint);
    }

    for (const parsed of equivalent) {
      const canonicalRoundtrip = spec.parse(parsed.canonical);
      expect(canonicalRoundtrip.kind).toBe('ok');
      if (canonicalRoundtrip.kind !== 'ok') continue;
      expect(canonicalRoundtrip.fingerprint).toBe(parsed.fingerprint);
    }
  });

  it('percent-parser giver stabile fingerprints for ok-cases', () => {
    const spec = createPercentParserSpec({
      allowNegative: true,
      precision: 2,
      minValue: -100,
      maxValue: 100,
    });

    const equivalent = ['1', '1,0', '1,00', '01,00'].map((raw) => expectOkAndIdempotent(spec, raw));
    for (const parsed of equivalent.slice(1)) {
      expect(parsed.fingerprint).toBe(equivalent[0]?.fingerprint);
    }

    const negative = expectOkAndIdempotent(spec, '-1,25');
    expect(negative.fingerprint).toContain('p:');
  });

  it('date-parser giver stabile fingerprints og canonical roundtrip for ok-cases', () => {
    const spec = createDateParserSpec();

    const equivalent = ['1-1-2024', '01-01-2024', '01/01/2024', '01 01 2024'].map((raw) => expectOkAndIdempotent(spec, raw));
    for (const parsed of equivalent.slice(1)) {
      expect(parsed.fingerprint).toBe(equivalent[0]?.fingerprint);
    }

    for (const parsed of equivalent) {
      const canonicalRoundtrip = spec.parse(parsed.canonical);
      expect(canonicalRoundtrip.kind).toBe('ok');
      if (canonicalRoundtrip.kind !== 'ok') continue;
      expect(canonicalRoundtrip.fingerprint).toBe(parsed.fingerprint);
    }
  });
});
