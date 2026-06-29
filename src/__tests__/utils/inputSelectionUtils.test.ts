import { sanitizePastedAmount } from '../../utils/amountInputUtils';
import { mapSelectionThroughDraftNormalization } from '../../utils/inputSelectionUtils';

describe('inputSelectionUtils', () => {
  it('mapper caret gennem beløbsnormalisering der fjerner tusindpunktum', () => {
    const mapped = mapSelectionThroughDraftNormalization(
      '30.183,5',
      '30183,5',
      { selectionStart: 7, selectionEnd: 7 },
      sanitizePastedAmount
    );

    expect(mapped).toEqual({ selectionStart: 6, selectionEnd: 6 });
  });

  it('mapper caret gennem komma-sletning i grupperet beløb', () => {
    const mapped = mapSelectionThroughDraftNormalization(
      '30.18315',
      '3018315',
      { selectionStart: 6, selectionEnd: 6 },
      sanitizePastedAmount
    );

    expect(mapped).toEqual({ selectionStart: 5, selectionEnd: 5 });
  });
});
