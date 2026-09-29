// @vitest-environment jsdom

import {
  mapSelectionThroughDraftNormalization,
  restoreInputSelectionAfterControlledChange,
} from '../../utils/inputSelectionUtils';

/**
 * Testet adfærd er caret-mapningen, ikke en konkret beløbsnormalisering. Derfor
 * bruges en lokal, minimal normalisator der kun fjerner tusindpunktum – det er
 * netop den tegn-fjernelse caret'en skal forskydes henover. Tidligere blev
 * `sanitizePastedAmount` lånt hertil, hvilket koblede testen til en funktion
 * uden produktionsbrug.
 */
const stripThousandSeparators = (value: string): string => value.replace(/\./g, '');

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('inputSelectionUtils', () => {
  it('mapper caret gennem beløbsnormalisering der fjerner tusindpunktum', () => {
    const mapped = mapSelectionThroughDraftNormalization(
      '30.183,5',
      '30183,5',
      { selectionStart: 7, selectionEnd: 7 },
      stripThousandSeparators
    );

    expect(mapped).toEqual({ selectionStart: 6, selectionEnd: 6 });
  });

  it('mapper caret gennem komma-sletning i grupperet beløb', () => {
    const mapped = mapSelectionThroughDraftNormalization(
      '30.18315',
      '3018315',
      { selectionStart: 6, selectionEnd: 6 },
      stripThousandSeparators
    );

    expect(mapped).toEqual({ selectionStart: 5, selectionEnd: 5 });
  });

  it('returnerer ingen mapping når en af selection-grænserne mangler', () => {
    expect(mapSelectionThroughDraftNormalization(
      '123',
      '123',
      { selectionStart: null, selectionEnd: 1 },
      stripThousandSeparators
    )).toBeNull();
    expect(mapSelectionThroughDraftNormalization(
      '123',
      '123',
      { selectionStart: 1, selectionEnd: null },
      stripThousandSeparators
    )).toBeNull();
  });

  it('sorterer en reversed selection og clamped begge punkter til drafts grænser', () => {
    expect(mapSelectionThroughDraftNormalization(
      '12.34',
      '1234',
      { selectionStart: 99, selectionEnd: -5 },
      stripThousandSeparators
    )).toEqual({ selectionStart: 0, selectionEnd: 4 });
  });

  it('gendanner selection straks uden animation-frame', () => {
    vi.stubGlobal('requestAnimationFrame', undefined);
    const input = document.createElement('input');
    const setSelectionRange = vi.spyOn(input, 'setSelectionRange');

    restoreInputSelectionAfterControlledChange(input, { selectionStart: 1, selectionEnd: 3 });

    expect(setSelectionRange).toHaveBeenCalledTimes(1);
    expect(setSelectionRange).toHaveBeenCalledWith(1, 3);
  });

  it('gendanner selection igen i animation-frame og ignorerer null-input', () => {
    const requestAnimationFrame = vi.fn((callback: (timestamp: number) => void) => {
      callback(0);
      return 1;
    });
    vi.stubGlobal('requestAnimationFrame', requestAnimationFrame);
    const input = document.createElement('input');
    const setSelectionRange = vi.spyOn(input, 'setSelectionRange');

    restoreInputSelectionAfterControlledChange(input, { selectionStart: 1, selectionEnd: 3 });
    restoreInputSelectionAfterControlledChange(null, { selectionStart: 1, selectionEnd: 3 });

    expect(requestAnimationFrame).toHaveBeenCalledTimes(1);
    expect(setSelectionRange).toHaveBeenCalledTimes(2);
  });

  it('ignorerer browserens afvisning af setSelectionRange', () => {
    vi.stubGlobal('requestAnimationFrame', undefined);
    const input = document.createElement('input');
    vi.spyOn(input, 'setSelectionRange').mockImplementation(() => {
      throw new Error('selection understøttes ikke');
    });

    expect(() => restoreInputSelectionAfterControlledChange(input, { selectionStart: 1, selectionEnd: 3 })).not.toThrow();
  });
});
