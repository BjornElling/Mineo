import { roundByMethod } from '../../utils/rounding';

export const round0 = (v: number): number => roundByMethod(v, 0, 'halfAwayFromZero');
export const round2 = (v: number): number => roundByMethod(v, 2, 'halfAwayFromZero');
export const round3 = (v: number): number => roundByMethod(v, 3, 'halfAwayFromZero');
export const round4 = (v: number): number => roundByMethod(v, 4, 'halfAwayFromZero');
export const roundNearest1000 = (v: number): number => roundByMethod(v / 1000, 0, 'halfAwayFromZero') * 1000;
export const ceil0 = (v: number): number => roundByMethod(v, 0, 'ceil');
