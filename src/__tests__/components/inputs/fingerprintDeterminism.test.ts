import {
  createAmountParserSpec,
  createDateParserSpec,
  createIntegerParserSpec,
  createPercentParserSpec,
} from '../../../utils/parserSpecs';

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
    const expressionVariant = expectOkAndIdempotent(spec, '(2+1)');
    expect(expressionVariant.fingerprint).not.toBe(expression.fingerprint);

    const one = spec.parse('1,00');
    const two = spec.parse('2,00');
    expect(one.kind).toBe('ok');
    expect(two.kind).toBe('ok');
    if (one.kind === 'ok' && two.kind === 'ok') {
      expect(one.fingerprint).not.toBe(two.fingerprint);
    }
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

    const one = spec.parse('1');
    const two = spec.parse('2');
    expect(one.kind).toBe('ok');
    expect(two.kind).toBe('ok');
    if (one.kind === 'ok' && two.kind === 'ok') {
      expect(one.fingerprint).not.toBe(two.fingerprint);
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

    const one = spec.parse('1,00');
    const two = spec.parse('2,00');
    expect(one.kind).toBe('ok');
    expect(two.kind).toBe('ok');
    if (one.kind === 'ok' && two.kind === 'ok') {
      expect(one.fingerprint).not.toBe(two.fingerprint);
    }
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

    const first = spec.parse('01-01-2024');
    const second = spec.parse('02-01-2024');
    expect(first.kind).toBe('ok');
    expect(second.kind).toBe('ok');
    if (first.kind === 'ok' && second.kind === 'ok') {
      expect(first.fingerprint).not.toBe(second.fingerprint);
    }
  });

  it('amount-parser bevarer tomværdi og afviser ugyldigt input', () => {
    const spec = createAmountParserSpec({
      precision: 2,
      allowNegative: false,
      maxIntegerDigits: 20,
      maxRawLength: 64,
    });

    expect(spec.empty).toEqual({ model: undefined, canonical: '', fingerprint: '__EMPTY__' });
    expect(spec.parse('   ')).toEqual({ kind: 'ok', model: undefined, canonical: '', fingerprint: '__EMPTY__' });
    expect(spec.parse('1a')).toEqual({ kind: 'invalid', raw: '1a', errorCode: 'number' });
    expect(spec.parse('-1')).toEqual({ kind: 'invalid', raw: '-1', errorCode: 'number' });
  });

  it('integer-parser dækker tom-, format-, numerik- og intervalfejl', () => {
    const bounded = createIntegerParserSpec({ minValue: 10, maxValue: 20 });

    expect(bounded.parse('   ')).toEqual({ kind: 'ok', model: '', canonical: '', fingerprint: '__EMPTY__' });
    expect(bounded.parse('1,0')).toEqual({ kind: 'invalid', raw: '1,0', errorCode: 'invalid-format' });
    expect(bounded.parse('9')).toEqual({ kind: 'invalid', raw: '9', errorCode: 'below-min' });
    expect(bounded.parse('21')).toEqual({ kind: 'invalid', raw: '21', errorCode: 'above-max' });

    const notFinite = bounded.parse('9'.repeat(400));
    expect(notFinite).toEqual({ kind: 'invalid', raw: '9'.repeat(400), errorCode: 'invalid-format' });

    const unbounded = createIntegerParserSpec({});
    expect(unbounded.parse('7')).toEqual({ kind: 'ok', model: '7', canonical: '7', fingerprint: 'i:7' });
  });

  it('percent-parser dækker tom-, format-, fortegns-, decimal- og intervalfejl', () => {
    const bounded = createPercentParserSpec({
      allowNegative: true,
      precision: 2,
      minValue: 0,
      maxValue: 100,
    });

    expect(bounded.parse('   ')).toEqual({ kind: 'ok', model: '', canonical: '', fingerprint: '__EMPTY__' });
    expect(bounded.parse('-1')).toEqual({ kind: 'invalid', raw: '-1', errorCode: 'below-min' });
    expect(bounded.parse('1,2,3')).toEqual({ kind: 'invalid', raw: '1,2,3', errorCode: 'invalid-format' });
    expect(bounded.parse(',1')).toEqual({ kind: 'invalid', raw: ',1', errorCode: 'invalid-format' });
    expect(bounded.parse('1,a')).toEqual({ kind: 'invalid', raw: '1,a', errorCode: 'invalid-format' });
    expect(bounded.parse('1,234')).toEqual({ kind: 'invalid', raw: '1,234', errorCode: 'too-many-decimals' });
    expect(bounded.parse('101')).toEqual({ kind: 'invalid', raw: '101', errorCode: 'above-max' });

    const nonNegative = createPercentParserSpec({ allowNegative: false, precision: 2 });
    expect(nonNegative.parse('-1')).toEqual({ kind: 'invalid', raw: '-1', errorCode: 'negative-not-allowed' });

    const notFinite = bounded.parse('9'.repeat(400));
    expect(notFinite).toEqual({ kind: 'invalid', raw: '9'.repeat(400), errorCode: 'invalid-format' });

    const unbounded = createPercentParserSpec({ allowNegative: true, precision: 2 });
    expect(unbounded.parse('-1,25')).toEqual({ kind: 'ok', model: '-1,25', canonical: '-1.25', fingerprint: 'p:-1.25' });
  });

  it('date-parser skelner mellem tom, ugyldigt format og ugyldig kalenderdato', () => {
    const spec = createDateParserSpec();

    expect(spec.parse('   ')).toEqual({ kind: 'ok', model: '', canonical: '', fingerprint: '__EMPTY__' });
    expect(spec.parse('2024-01-01')).toEqual({ kind: 'invalid', raw: '2024-01-01', errorCode: 'invalid-format' });
    expect(spec.parse('31-02-2024')).toEqual({ kind: 'invalid', raw: '31-02-2024', errorCode: 'invalid-date' });
  });
});
