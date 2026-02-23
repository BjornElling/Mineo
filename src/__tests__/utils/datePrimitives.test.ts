import { describe, expect, it } from 'vitest';
import { createDate } from '../../utils/datePrimitives';

describe('createDate', () => {
  it('opretter en UTC-dato korrekt', () => {
    const d = createDate(2024, 0, 1); // januar = 0
    expect(d.getUTCFullYear()).toBe(2024);
    expect(d.getUTCMonth()).toBe(0);
    expect(d.getUTCDate()).toBe(1);
  });

  it('2024-06-15 (monthIndex = 5)', () => {
    const d = createDate(2024, 5, 15);
    expect(d.getUTCFullYear()).toBe(2024);
    expect(d.getUTCMonth()).toBe(5);
    expect(d.getUTCDate()).toBe(15);
  });

  it('december 31 (monthIndex = 11)', () => {
    const d = createDate(2024, 11, 31);
    expect(d.getUTCFullYear()).toBe(2024);
    expect(d.getUTCMonth()).toBe(11);
    expect(d.getUTCDate()).toBe(31);
  });

  it('skudår: 29. februar 2024', () => {
    const d = createDate(2024, 1, 29); // februar = 1
    expect(d.getUTCFullYear()).toBe(2024);
    expect(d.getUTCMonth()).toBe(1);
    expect(d.getUTCDate()).toBe(29);
  });

  it('UTC tid er midnat (00:00:00.000)', () => {
    const d = createDate(2024, 5, 15);
    expect(d.getUTCHours()).toBe(0);
    expect(d.getUTCMinutes()).toBe(0);
    expect(d.getUTCSeconds()).toBe(0);
    expect(d.getUTCMilliseconds()).toBe(0);
  });

  it('DST-sikker: 2024-03-31 (dansk sommer-start)', () => {
    const d = createDate(2024, 2, 31); // marts = 2
    expect(d.getUTCFullYear()).toBe(2024);
    expect(d.getUTCMonth()).toBe(2);
    expect(d.getUTCDate()).toBe(31);
  });

  it('DST-sikker: 2024-10-27 (dansk vinter-start)', () => {
    const d = createDate(2024, 9, 27); // oktober = 9
    expect(d.getUTCFullYear()).toBe(2024);
    expect(d.getUTCMonth()).toBe(9);
    expect(d.getUTCDate()).toBe(27);
  });

  it('er deterministisk', () => {
    const d1 = createDate(2024, 5, 15);
    const d2 = createDate(2024, 5, 15);
    expect(d1.getTime()).toBe(d2.getTime());
  });

  it('returnerer et Date-objekt', () => {
    expect(createDate(2024, 5, 15)).toBeInstanceOf(Date);
  });
});
