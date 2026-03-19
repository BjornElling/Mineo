import type { CSSProperties } from 'react';
import { tableColors } from '../../../config/tableTheme';

export const getStandardGridBodyRowStyle = (rowIndex: number): CSSProperties => {
  return {
    backgroundColor: rowIndex % 2 === 0 ? tableColors.evenRowBackground : tableColors.oddRowBackground,
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
    cursor: 'pointer',
  };
};
