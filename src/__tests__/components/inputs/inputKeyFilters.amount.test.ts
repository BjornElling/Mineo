// @vitest-environment jsdom
import type { KeyboardEvent } from 'react';
import { filterAmountExpressionKeyDown } from '../../../components/inputs/inputKeyFilters';

const isBlockedInsertion = (
  value: string,
  key: string,
  cursor = value.length,
  options: Readonly<{ maxIntegerDigits?: number; allowDecimals?: boolean }> = {}
): boolean => {
  const input = document.createElement('input');
  input.value = value;
  input.setSelectionRange(cursor, cursor);
  let prevented = false;
  let stopped = false;
  const event = {
    key,
    currentTarget: input,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    nativeEvent: { isComposing: false },
    preventDefault: () => { prevented = true; },
    stopPropagation: () => { stopped = true; },
  } as unknown as KeyboardEvent<HTMLInputElement>;

  const allowDecimals = options.allowDecimals !== false;
  filterAmountExpressionKeyDown(event, {
    allowNegative: true,
    allowDecimals,
    ...(allowDecimals ? { maxDecimalDigits: 2 } : { maxDecimalDigits: 0 }),
    ...(options.maxIntegerDigits === undefined ? {} : { maxIntegerDigits: options.maxIntegerDigits }),
  });

  return prevented && stopped;
};

/** Kontraktens beløbsgrænse: 7 heltalscifre (§2.2). */
const SEVEN = 7;

describe('filterAmountExpressionKeyDown', () => {
  it('tillader to decimaler og blokerer den tredje', () => {
    expect(isBlockedInsertion('12,3', '4')).toBe(false);
    expect(isBlockedInsertion('12,34', '5')).toBe(true);
  });

  it('håndhæver grænsen i hvert talled i et beløbsudtryk', () => {
    expect(isBlockedInsertion('12,34 + 5,6', '7')).toBe(false);
    expect(isBlockedInsertion('12,34 + 5,67', '8')).toBe(true);
  });

  it('tillader redigering inden for de eksisterende to decimalpladser', () => {
    const input = document.createElement('input');
    input.value = '12,34';
    input.setSelectionRange(4, 5);
    let prevented = false;
    const event = {
      key: '5',
      currentTarget: input,
      ctrlKey: false,
      metaKey: false,
      altKey: false,
      nativeEvent: { isComposing: false },
      preventDefault: () => { prevented = true; },
      stopPropagation: () => undefined,
    } as unknown as KeyboardEvent<HTMLInputElement>;

    filterAmountExpressionKeyDown(event, {
      allowNegative: true,
      allowDecimals: true,
      maxDecimalDigits: 2,
    });

    expect(prevented).toBe(false);
  });

  // ── Heltalscifre: højst 7 pr. talled (§2.2) ──
  // Grænsen fandtes overhovedet ikke i tegnfilteret før; det kendte kun decimaler. Derfor kunne
  // `70368744177664` tastes og nå frem til beløbsschemaet (OBS-025/OBS-026).

  it('tillader det 7. heltalsciffer og blokerer det 8.', () => {
    expect(isBlockedInsertion('999999', '9', undefined, { maxIntegerDigits: SEVEN })).toBe(false);
    expect(isBlockedInsertion('9999999', '9', undefined, { maxIntegerDigits: SEVEN })).toBe(true);
  });

  it('måler grænsen PR. TALLED, ikke på hele draften', () => {
    // Kontrolgruppe mod en «for lang draft»-mekanisme: to fulde talled er tilsammen 15 tegn, men
    // hvert led er lovligt. Blokeres dette, måler værnet den samlede længde og ikke ciffergrænsen.
    expect(isBlockedInsertion('9999999+999999', '9', undefined, { maxIntegerDigits: SEVEN })).toBe(false);
    // …og det 8. ciffer i det ANDET led skal fortsat blokeres.
    expect(isBlockedInsertion('9999999+9999999', '9', undefined, { maxIntegerDigits: SEVEN })).toBe(true);
  });

  it('behandler hver operator og parentes som en talled-grænse', () => {
    for (const separator of ['+', '-', '*', '/', 'x', '(', ')', ' ']) {
      expect(
        isBlockedInsertion(`1${separator}9999999`, '9', undefined, { maxIntegerDigits: SEVEN })
      ).toBe(true);
      expect(
        isBlockedInsertion(`1${separator}999999`, '9', undefined, { maxIntegerDigits: SEVEN })
      ).toBe(false);
    }
  });

  it('regner decimaler uden for heltalsgrænsen', () => {
    // `9999999,99` har 9 cifre i alt, men kun 7 heltalscifre — det er kontraktens maksimum og skal
    // kunne tastes fuldt ud.
    expect(isBlockedInsertion('9999999,9', '9', undefined, { maxIntegerDigits: SEVEN })).toBe(false);
    expect(isBlockedInsertion('9999999,99', '9', undefined, { maxIntegerDigits: SEVEN })).toBe(true);
  });

  it('blokerer det 8. ciffer midt i et eksisterende talled', () => {
    // Cursoren kan stå inde i tallet; værnet måler derfor den kommende draft, ikke kun enden.
    expect(isBlockedInsertion('9999999', '5', 3, { maxIntegerDigits: SEVEN })).toBe(true);
  });

  it('et heltalsfelt afviser en decimalhale, men beholder de 7 cifre', () => {
    expect(isBlockedInsertion('999999', '9', undefined, { maxIntegerDigits: SEVEN, allowDecimals: false })).toBe(false);
    expect(isBlockedInsertion('9999999', '9', undefined, { maxIntegerDigits: SEVEN, allowDecimals: false })).toBe(true);
  });

  it('uden erklæret grænse blokeres ingen heltalscifre', () => {
    // Grænsen er OPT-IN i filteret. Det er bevidst: felter uden en erklæret ciffergrænse (fx et
    // fremtidigt felt med sin egen længde) må ikke arve beløbsgrænsen ved et tilfælde.
    expect(isBlockedInsertion('99999999999999', '9')).toBe(false);
  });
});
