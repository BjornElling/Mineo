import { mapSelectionThroughDraftNormalization } from '../../utils/inputSelectionUtils';

/**
 * Testet adfærd er caret-mapningen, ikke en konkret beløbsnormalisering. Derfor
 * bruges en lokal, minimal normalisator der kun fjerner tusindpunktum – det er
 * netop den tegn-fjernelse caret'en skal forskydes henover. Tidligere blev
 * `sanitizePastedAmount` lånt hertil, hvilket koblede testen til en funktion
 * uden produktionsbrug.
 */
const stripThousandSeparators = (value: string): string => value.replace(/\./g, '');

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
});
