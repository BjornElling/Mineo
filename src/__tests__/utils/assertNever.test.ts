import { assertNever } from '../../utils/assertNever';

describe('assertNever', () => {
  it('kaster med den uventede runtime-værdi', () => {
    expect(() => assertNever('uventet' as never)).toThrow('Uventet værdi: uventet');
  });
});
