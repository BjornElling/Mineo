import { createFieldWarning } from '../../inputCore/fieldWarning';

describe('createFieldWarning', () => {
  it('gør en tom besked urepræsenterbar som aktiv advarsel', () => {
    expect(createFieldWarning('   ')).toBeUndefined();
  });

  it('binder warning-severity og normaliseret besked sammen', () => {
    expect(createFieldWarning('  Kontrollér værdien  ')).toEqual({
      severity: 'warning',
      message: 'Kontrollér værdien',
    });
  });
});
