import {
  VARIGE_MEN_FEM_PROCENT_WARNING,
  resolveVarigeMenWarning,
} from '../../../domain/varigemen/varigeMenPolicy';

describe('resolveVarigeMenWarning', () => {
  it('viser den aftalte ikke-blokerende advarsel ved præcis 5 procent', () => {
    expect(resolveVarigeMenWarning(5)).toEqual({
      severity: 'warning',
      message: VARIGE_MEN_FEM_PROCENT_WARNING,
    });
  });

  it.each([undefined, 4, 6])('viser ingen advarsel ved %s', (value) => {
    expect(resolveVarigeMenWarning(value)).toBeUndefined();
  });
});
