import * as React from 'react';

/** Det fælles `ENTER`-mærke ved et synligt autofill-forslag i en tabelcelle. */
export const AutofillSuggestMarker = (): React.ReactElement => (
  <span
    className="mineo-autofill-suggest-marker"
    style={{
      position: 'absolute',
      right: 2,
      bottom: 1,
      fontSize: 7,
      fontWeight: 600,
      letterSpacing: '0.3px',
      lineHeight: 1,
      color: 'var(--mineo-color-active-grid-autofill)',
      pointerEvents: 'none',
    }}
    aria-hidden="true"
  >
    ENTER
  </span>
);
