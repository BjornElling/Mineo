import type { CSSProperties } from 'react';

export const TABLE_INPUT_HEIGHT = '32px';
export const TABLE_INPUT_PADDING_X = '8px';
export const TABLE_INPUT_PADDING_Y = '4px';

type TableInputRootStyleOptions = Readonly<{
  showError: boolean;
  isLooseTable: boolean;
  locked: boolean;
  borderRadius: string;
  borderColor: string;
}>;

type TableInputElementStyleOptions = Readonly<{
  textAlign: CSSProperties['textAlign'];
  cursor: CSSProperties['cursor'];
  caretColor: CSSProperties['caretColor'];
  color?: CSSProperties['color'];
}>;

export const getTableInputRootStyles = ({
  showError,
  isLooseTable,
  locked,
  borderRadius,
  borderColor,
}: TableInputRootStyleOptions) => {
  return {
    width: '100%',
    height: TABLE_INPUT_HEIGHT,
    boxSizing: 'border-box',
    font: 'inherit',
    fontSize: 'inherit',
    fontFamily: 'inherit',
    lineHeight: 'inherit',
    color: 'inherit',
    fontFeatureSettings: '"tnum"',
    paddingTop: TABLE_INPUT_PADDING_Y,
    paddingBottom: TABLE_INPUT_PADDING_Y,
    paddingLeft: TABLE_INPUT_PADDING_X,
    paddingRight: TABLE_INPUT_PADDING_X,
    borderRadius,
    border: '1px solid',
    borderColor: showError ? 'var(--color-input-border-error)' : borderColor,
    backgroundColor: isLooseTable && !locked ? 'var(--color-input-bg)' : 'transparent',
    '&:hover': {
      borderColor: showError
        ? 'var(--color-input-border-error)'
        : isLooseTable && !locked
          ? 'var(--color-input-border-hover)'
          : borderColor,
    },
    '&:focus-within': {
      borderColor: 'var(--color-input-border-focus)',
    },
  } as const;
};

export const getTableInputElementStyles = ({
  textAlign,
  cursor,
  caretColor,
  color = 'inherit',
}: TableInputElementStyleOptions) => {
  return {
    font: 'inherit',
    fontSize: 'inherit',
    lineHeight: 'inherit',
    color,
    textAlign,
    padding: 0,
    cursor,
    caretColor,
  } as const;
};
