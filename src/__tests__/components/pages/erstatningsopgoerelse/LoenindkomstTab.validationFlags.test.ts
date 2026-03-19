import { describe, expect, it } from 'vitest';

import { updateValidationFlagById } from '../../../../utils/validationFlagMap';

describe('updateValidationFlagById', () => {
  it('returns same object when repeated error=true update is unchanged', () => {
    const prev = { 'af-1': true } as const;

    const next = updateValidationFlagById(prev, 'af-1', true);

    expect(next).toBe(prev);
  });

  it('returns same object when repeated error=false update is unchanged', () => {
    const prev = {} as const;

    const next = updateValidationFlagById(prev, 'af-1', false);

    expect(next).toBe(prev);
  });

  it('adds entry when error becomes true', () => {
    const prev = {} as const;

    const next = updateValidationFlagById(prev, 'af-1', true);

    expect(next).toEqual({ 'af-1': true });
  });

  it('removes entry when error becomes false', () => {
    const prev = { 'af-1': true, 'af-2': true } as const;

    const next = updateValidationFlagById(prev, 'af-1', false);

    expect(next).toEqual({ 'af-2': true });
  });
});
