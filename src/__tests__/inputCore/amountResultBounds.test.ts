import {
  MAX_AMOUNT_INPUT_VALUE,
  MIN_AMOUNT_INPUT_VALUE,
  amountResultBoundsValidator,
} from '../../inputCore/amountResultBounds';
import { eoOevrigeKravBeloebField } from '../../inputCore/catalog/erstatningsopgoerelseDescriptors';
import { buildFieldIssueSet } from '../../inputCore/inputIssue';
import { serializeFieldAddress } from '../../inputCore/fieldAddress';
import { toAnyFieldRef } from '../../inputCore/fieldDescriptor';

// `input-field-behavior-contract.md` §2.2/§8: ciffergrænsen blokerer det 8. heltalsciffer tegn for tegn,
// men et gyldigt UDTRYK kan regne sig forbi `±9.999.999,99`. Det kan først fanges ved settle og bliver
// derfor en canonical rød feltfejl med konkret tooltip.

const validate = amountResultBoundsValidator('test.amountResultBounds');

describe('amountResultBoundsValidator', () => {
  it('tom værdi giver intet issue', () => {
    expect(validate(undefined)).toBeUndefined();
  });

  it('kontraktens maksimum er GYLDIGT (grænsen er inklusiv)', () => {
    expect(validate({ kind: 'number', value: MAX_AMOUNT_INPUT_VALUE })).toBeUndefined();
    expect(validate({ kind: 'number', value: MIN_AMOUNT_INPUT_VALUE })).toBeUndefined();
  });

  it('markerer et beløb over maksimum med konkret grænse i beskeden', () => {
    const issue = validate({ kind: 'number', value: 10_000_000 });
    expect(issue?.reason).toBe('bounds');
    // `bounds`-beskeder vises ORDRET i tooltip; grænsen SKAL derfor stå i teksten.
    expect(issue?.message).toContain('9.999.999,99');
    expect(issue?.detail).toEqual({ maxValue: MAX_AMOUNT_INPUT_VALUE });
  });

  it('markerer et beløb under minimum', () => {
    const issue = validate({ kind: 'number', value: -10_000_000 });
    expect(issue?.reason).toBe('bounds');
    expect(issue?.message).toContain('9.999.999,99');
    expect(issue?.detail).toEqual({ minValue: MIN_AMOUNT_INPUT_VALUE });
  });

  it('fanger et UDTRYK, hvis resultat overskrider grænsen', () => {
    // Kernen i reglen: `9999999*2` har intet talled over 7 cifre, så tegnfilteret kan ikke fange det.
    const issue = validate({ kind: 'expression', expression: '9999999*2', value: 19_999_998 });
    expect(issue?.reason).toBe('bounds');
  });

  it('et udtryk inden for grænsen giver intet issue', () => {
    expect(validate({ kind: 'expression', expression: '5000000+4999999', value: 9_999_999 })).toBeUndefined();
  });

  it('reason er `bounds`, ikke `format` — værdien skal BEVARES canonical', () => {
    // §1.1/§2.2: en korrekt formateret værdi uden for en grænse afvises IKKE som råtekst. Var reason
    // `format`, ville værdien blive rejected og forsvinde fra `.eo`.
    expect(validate({ kind: 'number', value: 10_000_000 })?.reason).toBe('bounds');
  });
});

describe('defineField tilføjer resultatgrænsen deriveret', () => {
  it('et beløbsfelt har validatoren UDEN at descriptoren nævner den', () => {
    // Selve mekanismen: grænsen kommer fra `defineField`, ikke fra descriptorens egen validator-liste.
    // Uden dette kunne et nyt beløbsfelt opstå uden grænse, indtil nogen huskede den.
    const validators = eoOevrigeKravBeloebField.validators ?? [];
    const field = eoOevrigeKravBeloebField.bind('row-1');
    const view = { readCanonical: <V,>(): V => undefined as V };
    const issues = validators.map((v) => v({ kind: 'number', value: 10_000_000 }, field, view));
    expect(issues.some((issue) => issue?.reason === 'bounds')).toBe(true);
  });

  it('en værdi inden for grænsen giver ingen issues fra det deriverede værn', () => {
    const validators = eoOevrigeKravBeloebField.validators ?? [];
    const field = eoOevrigeKravBeloebField.bind('row-1');
    const view = { readCanonical: <V,>(): V => undefined as V };
    const issues = validators.map((v) => v({ kind: 'number', value: 1_000 }, field, view));
    expect(issues.every((issue) => issue === undefined)).toBe(true);
  });

  it('maskerer ikke et felts egen skarpere bounds-besked', () => {
    const field = eoOevrigeKravBeloebField.bind('row-1');
    const view = { readCanonical: <V,>(): V => undefined as V };
    const candidates = (field.descriptor.validators ?? []).flatMap((validate) => {
      const spec = validate({ kind: 'number', value: -1 }, field, view);
      if (spec === undefined) return [];
      return [{
        kind: 'field' as const,
        code: spec.code,
        severity: 'error' as const,
        field: toAnyFieldRef(field),
        reason: spec.reason,
        message: spec.message,
        ...(spec.detail === undefined ? {} : { detail: spec.detail }),
      }];
    });

    const active = buildFieldIssueSet(candidates).get(serializeFieldAddress(field.address));
    expect(active?.code).toBe('eo.oevrigeKravPerioder.beloeb.bounds');
    expect(active?.message).toContain('0');
  });
});
