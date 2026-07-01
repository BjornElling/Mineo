import type React from 'react';
import {
  findTypeaheadMatchIndex,
  isClearKey,
  isTypeaheadCharKey,
} from '../../../components/inputs/dropdownInteractionCore';

const key = (overrides: Partial<React.KeyboardEvent<HTMLElement>>): React.KeyboardEvent<HTMLElement> =>
  ({ key: 'a', altKey: false, ctrlKey: false, metaKey: false, ...overrides } as React.KeyboardEvent<HTMLElement>);

describe('dropdownInteractionCore.findTypeaheadMatchIndex', () => {
  const labels = ['Alfa', 'Beta', 'Bravo', 'Charlie'];

  it('matcher første option med matchende første bogstav (dansk locale, case-insensitivt)', () => {
    expect(findTypeaheadMatchIndex(labels, 'b', -1)).toBe(1);
    expect(findTypeaheadMatchIndex(labels, 'B', -1)).toBe(1);
  });

  it('cirkulær wrap mellem flere match', () => {
    expect(findTypeaheadMatchIndex(labels, 'b', 1)).toBe(2);
    expect(findTypeaheadMatchIndex(labels, 'b', 2)).toBe(1); // wrap tilbage til første
  });

  it('returnerer -1 når intet matcher', () => {
    expect(findTypeaheadMatchIndex(labels, 'z', -1)).toBe(-1);
  });

  it('springer tomme pladser over (dividers/disabled gives som tom streng)', () => {
    const withGaps = ['Alfa', '', 'Beta', '', 'Bravo'];
    expect(findTypeaheadMatchIndex(withGaps, 'b', -1)).toBe(2);
    expect(findTypeaheadMatchIndex(withGaps, 'b', 2)).toBe(4);
    expect(findTypeaheadMatchIndex(withGaps, 'b', 4)).toBe(2);
  });

  it('dansk æøå sammenlignes på første bogstav', () => {
    expect(findTypeaheadMatchIndex(['Æble', 'Øl', 'Åre'], 'ø', -1)).toBe(1);
  });
});

describe('dropdownInteractionCore.isTypeaheadCharKey', () => {
  it('sandt for enkelt skrivbart tegn uden modifikator', () => {
    expect(isTypeaheadCharKey(key({ key: 'a' }))).toBe(true);
  });

  it('falsk ved modifikator', () => {
    expect(isTypeaheadCharKey(key({ key: 'a', ctrlKey: true }))).toBe(false);
    expect(isTypeaheadCharKey(key({ key: 'a', metaKey: true }))).toBe(false);
    expect(isTypeaheadCharKey(key({ key: 'a', altKey: true }))).toBe(false);
  });

  it('falsk for ikke-tegn-taster og whitespace-only', () => {
    expect(isTypeaheadCharKey(key({ key: 'ArrowDown' }))).toBe(false);
    expect(isTypeaheadCharKey(key({ key: 'Enter' }))).toBe(false);
    expect(isTypeaheadCharKey(key({ key: ' ' }))).toBe(false);
  });
});

describe('dropdownInteractionCore.isClearKey', () => {
  it('sandt for Delete og Backspace', () => {
    expect(isClearKey(key({ key: 'Delete' }))).toBe(true);
    expect(isClearKey(key({ key: 'Backspace' }))).toBe(true);
  });

  it('falsk for andre taster', () => {
    expect(isClearKey(key({ key: 'a' }))).toBe(false);
    expect(isClearKey(key({ key: 'Escape' }))).toBe(false);
  });
});
