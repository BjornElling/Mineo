import { parseForligsgrad } from '../../../domain/erstatningsopgoerelse/engines/forligsgrad';

describe('parseForligsgrad', () => {
  it('returnerer korrekt factor/label for procentværdier', () => {
    expect(parseForligsgrad({ forligAnsvarsgradProcent: 1, forligAnsvarsgradBroek: '' })).toEqual({ factor: 0.01, label: '1%' });
    expect(parseForligsgrad({ forligAnsvarsgradProcent: 50, forligAnsvarsgradBroek: '' })).toEqual({ factor: 0.5, label: '50%' });
    expect(parseForligsgrad({ forligAnsvarsgradProcent: 100, forligAnsvarsgradBroek: '' })).toEqual({ factor: 1, label: '100%' });
  });

  it('returnerer null for ugyldige procentværdier', () => {
    expect(parseForligsgrad({ forligAnsvarsgradProcent: 0, forligAnsvarsgradBroek: '' })).toBeNull();
    expect(parseForligsgrad({ forligAnsvarsgradProcent: 101, forligAnsvarsgradBroek: '' })).toBeNull();
  });

  it('returnerer korrekt factor/label for gyldige brøker', () => {
    expect(parseForligsgrad({ forligAnsvarsgradProcent: undefined, forligAnsvarsgradBroek: '1/1' })).toEqual({ factor: 1, label: '1/1' });
    expect(parseForligsgrad({ forligAnsvarsgradProcent: undefined, forligAnsvarsgradBroek: '1/3' })).toEqual({ factor: 1 / 3, label: '1/3' });
    expect(parseForligsgrad({ forligAnsvarsgradProcent: undefined, forligAnsvarsgradBroek: '2/7' })).toEqual({ factor: 2 / 7, label: '2/7' });
    expect(parseForligsgrad({ forligAnsvarsgradProcent: undefined, forligAnsvarsgradBroek: '1,25/3,5' })).toEqual({ factor: 1.25 / 3.5, label: '1,25/3,5' });
  });

  it('returnerer null for ugyldige brøker', () => {
    expect(parseForligsgrad({ forligAnsvarsgradProcent: undefined, forligAnsvarsgradBroek: '0/5' })).toBeNull();
    expect(parseForligsgrad({ forligAnsvarsgradProcent: undefined, forligAnsvarsgradBroek: '0,0/3' })).toBeNull();
    expect(parseForligsgrad({ forligAnsvarsgradProcent: undefined, forligAnsvarsgradBroek: '5/0' })).toBeNull();
    expect(parseForligsgrad({ forligAnsvarsgradProcent: undefined, forligAnsvarsgradBroek: '3/2' })).toBeNull();
    expect(parseForligsgrad({ forligAnsvarsgradProcent: undefined, forligAnsvarsgradBroek: '2,5/1,5' })).toBeNull();
    expect(parseForligsgrad({ forligAnsvarsgradProcent: undefined, forligAnsvarsgradBroek: '' })).toBeNull();
    expect(parseForligsgrad({ forligAnsvarsgradProcent: undefined, forligAnsvarsgradBroek: '   ' })).toBeNull();
  });

  it('trimmer whitespace omkring gyldig brøk', () => {
    expect(parseForligsgrad({ forligAnsvarsgradProcent: undefined, forligAnsvarsgradBroek: ' 1/3 ' })).toEqual({ factor: 1 / 3, label: '1/3' });
  });

  it('prioriterer procent når både procent og brøk er sat', () => {
    expect(parseForligsgrad({ forligAnsvarsgradProcent: 25, forligAnsvarsgradBroek: '1/3' })).toEqual({ factor: 0.25, label: '25%' });
  });
});
