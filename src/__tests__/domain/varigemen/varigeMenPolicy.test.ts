import {
  VARIGE_MEN_FEM_PROCENT_WARNING,
  resolveVarigeMenWarning,
} from '../../../domain/varigemen/varigeMenPolicy';

describe('resolveVarigeMenWarning', () => {
  it.each([1, 2, 3, 4])(
    'viser den aftalte ikke-blokerende advarsel ved %s procent',
    (value) => {
      expect(resolveVarigeMenWarning(value)).toEqual({
        severity: 'warning',
        message: VARIGE_MEN_FEM_PROCENT_WARNING,
      });
    },
  );

  it.each([undefined, 0, 5, 6])('viser ingen advarsel ved %s', (value) => {
    expect(resolveVarigeMenWarning(value)).toBeUndefined();
  });
});
