import type { CSSProperties } from 'react';

export const getStandardGridBodyRowStyle = (rowIndex: number): CSSProperties => {
  return {
    backgroundColor: rowIndex % 2 === 0 ? 'var(--color-table-row-even)' : 'var(--color-table-row-odd)',
  };
};

export type StandardGridCellStyle = Readonly<{
  align?: 'left' | 'center' | 'right';
}>;

export const getStandardGridCellStyle = ({ align = 'center' }: StandardGridCellStyle = {}): CSSProperties => {
  return {
    padding: 0,
    border: 'none',
    textAlign: align,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    cursor: 'default',
  };
};
