import { buildForligIndgaaetSaetning, evaluateForligsgrad, parseForligsgrad } from '../../../domain/erstatningsopgoerelse/engines/forligsgrad';

describe('parseForligsgrad', () => {
  it('returnerer korrekt factor/label for procentværdier (kanonisk dansk format)', () => {
    expect(parseForligsgrad({ forligAnsvarsgradProcent: 1, forligAnsvarsgradBroek: '' })).toEqual({ factor: 0.01, label: '1 %' });
    expect(parseForligsgrad({ forligAnsvarsgradProcent: 50, forligAnsvarsgradBroek: '' })).toEqual({ factor: 0.5, label: '50 %' });
    expect(parseForligsgrad({ forligAnsvarsgradProcent: 100, forligAnsvarsgradBroek: '' })).toEqual({ factor: 1, label: '100 %' });
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
    expect(parseForligsgrad({ forligAnsvarsgradProcent: 25, forligAnsvarsgradBroek: '1/3' })).toEqual({ factor: 0.25, label: '25 %' });
  });

  // Lås label-format for decimal-procent. forligLabel er brugervendt (vises i
  // svie/smerte-PDF-suffix og EO-kontrol), og decimaler tillades af StyledPercentField.
  // Label bruger den kanoniske formatPercent → dansk konvention (komma-decimal + mellemrum).
  it('label for decimal-procent bruger kanonisk dansk format ("12,5 %")', () => {
    expect(parseForligsgrad({ forligAnsvarsgradProcent: 12.5, forligAnsvarsgradBroek: '' })).toEqual({
      factor: 0.125,
      label: '12,5 %',
    });
  });
});

describe('evaluateForligsgrad', () => {
  it('returnerer status "empty" når intet forlig er angivet', () => {
    expect(evaluateForligsgrad({ forligAnsvarsgradProcent: undefined, forligAnsvarsgradBroek: '' })).toEqual({
      status: 'empty',
      forlig: null,
    });
    expect(evaluateForligsgrad({ forligAnsvarsgradProcent: undefined, forligAnsvarsgradBroek: undefined })).toEqual({
      status: 'empty',
      forlig: null,
    });
    // Procent 0 uden brøk = intet forlig (spejler at EO-validatoren ikke flagger 0).
    expect(evaluateForligsgrad({ forligAnsvarsgradProcent: 0, forligAnsvarsgradBroek: '' })).toEqual({
      status: 'empty',
      forlig: null,
    });
  });

  it('returnerer status "valid" med factor/label for gyldig procent', () => {
    expect(evaluateForligsgrad({ forligAnsvarsgradProcent: 50, forligAnsvarsgradBroek: '' })).toEqual({
      status: 'valid',
      forlig: { factor: 0.5, label: '50 %' },
    });
    expect(evaluateForligsgrad({ forligAnsvarsgradProcent: 100, forligAnsvarsgradBroek: '' })).toEqual({
      status: 'valid',
      forlig: { factor: 1, label: '100 %' },
    });
  });

  it('returnerer status "valid" med factor/label for gyldig brøk', () => {
    expect(evaluateForligsgrad({ forligAnsvarsgradProcent: undefined, forligAnsvarsgradBroek: '2/3' })).toEqual({
      status: 'valid',
      forlig: { factor: 2 / 3, label: '2/3' },
    });
  });

  it('returnerer status "invalid" (reason "both") når både procent og brøk er udfyldt', () => {
    const result = evaluateForligsgrad({ forligAnsvarsgradProcent: 50, forligAnsvarsgradBroek: '1/3' });
    expect(result.status).toBe('invalid');
    expect(result.forlig).toBeNull();
    expect(result).toMatchObject({ reason: 'both' });
    // Også når procent er 0 (sat) sammen med en brøk.
    expect(evaluateForligsgrad({ forligAnsvarsgradProcent: 0, forligAnsvarsgradBroek: '1/3' })).toMatchObject({
      status: 'invalid',
      reason: 'both',
    });
  });

  it('returnerer status "invalid" (reason "broek") for en brøk over 1 eller med ugyldig form', () => {
    expect(evaluateForligsgrad({ forligAnsvarsgradProcent: undefined, forligAnsvarsgradBroek: '3/2' })).toMatchObject({
      status: 'invalid',
      reason: 'broek',
    });
    expect(evaluateForligsgrad({ forligAnsvarsgradProcent: undefined, forligAnsvarsgradBroek: '5/0' })).toMatchObject({
      status: 'invalid',
      reason: 'broek',
    });
  });

  it('ændrer ikke parseForligsgrads adfærd (prioriterer fortsat procent ved begge udfyldt)', () => {
    // parseForligsgrad er bevidst urørt og prioriterer procent; evaluateForligsgrad er strengere
    // (begge udfyldt = invalid). De to funktioner tjener forskellige formål.
    expect(parseForligsgrad({ forligAnsvarsgradProcent: 25, forligAnsvarsgradBroek: '1/3' })).toEqual({ factor: 0.25, label: '25 %' });
    expect(evaluateForligsgrad({ forligAnsvarsgradProcent: 25, forligAnsvarsgradBroek: '1/3' }).status).toBe('invalid');
  });
});

describe('buildForligIndgaaetSaetning', () => {
  it('udelader dato når der ikke er en forligsdato', () => {
    expect(buildForligIndgaaetSaetning('1/3', null)).toBe('Der er indgået forlig i sagen på betaling af 1/3.');
  });

  it('inkluderer datoen når den er angivet', () => {
    expect(buildForligIndgaaetSaetning('1/3', '17. maj 2024')).toBe(
      'Der er den 17. maj 2024 indgået forlig i sagen på betaling af 1/3.'
    );
  });

  it('virker også med procent-label', () => {
    expect(buildForligIndgaaetSaetning('50 %', null)).toBe('Der er indgået forlig i sagen på betaling af 50 %.');
  });
});
