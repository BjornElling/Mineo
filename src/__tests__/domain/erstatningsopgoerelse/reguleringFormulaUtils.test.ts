import {
  buildFormulaText,
  computeFormulaValue,
  formatOverenskomstAmount,
  formatOverenskomstPercent,
  formatPercentCellFromRaw,
  mergeFeriepengeDisplay,
  parsePercentInput,
  resolveFeriePctForFormula,
  wrapIndexFormulaAfterSlashWhenLong,
  type FormulaComponents,
  type FormulaVisibility,
} from '../../../domain/erstatningsopgoerelse/engines/reguleringFormulaUtils';

describe('computeFormulaValue', () => {
  it('fortolker pct-felter som procentpoint (12 = 12%)', () => {
    const components: FormulaComponents = {
      baseValue: 100,
      feriePct: 12,
      fritvalgPct: 0,
      shSoPct: 0,
      pensionPct: 10,
      storeBededagPct: 0,
    };
    expect(computeFormulaValue(components)).toBeCloseTo(123.2, 6);
  });

  it('behandler ugyldige tal fail-closed som 0', () => {
    const components: FormulaComponents = {
      baseValue: Number.NaN,
      feriePct: Number.NaN,
      fritvalgPct: Number.NaN,
      shSoPct: Number.NaN,
      pensionPct: Number.NaN,
      storeBededagPct: Number.NaN,
    };
    expect(computeFormulaValue(components)).toBe(0);
  });

  it('nul baseValue → 0 uanset tillæg', () => {
    const components: FormulaComponents = {
      baseValue: 0, feriePct: 12, fritvalgPct: 5, shSoPct: 2, pensionPct: 10, storeBededagPct: 1,
    };
    expect(computeFormulaValue(components)).toBe(0);
  });

  it('kun pension (ingen tillæg) → baseValue × (1 + pension/100)', () => {
    const components: FormulaComponents = {
      baseValue: 1000, feriePct: 0, fritvalgPct: 0, shSoPct: 0, pensionPct: 10, storeBededagPct: 0,
    };
    expect(computeFormulaValue(components)).toBeCloseTo(1100, 6);
  });

  it('Infinity behandles som 0 (fail-closed)', () => {
    const components: FormulaComponents = {
      baseValue: Infinity, feriePct: 0, fritvalgPct: 0, shSoPct: 0, pensionPct: 0, storeBededagPct: 0,
    };
    expect(computeFormulaValue(components)).toBe(0);
  });

  it('storeBededagPct indgår korrekt i tillaegPct og dermed i formelresultatet', () => {
    // baseValue=1000, ferie=12 %, storeBededag=0,45 %, pension=10 %
    // tillaegPct = 12,45 → faktor1 = 1,1245 → faktor2 = 1,10
    // resultat = 1000 × 1,1245 × 1,10 = 1236,95
    const components: FormulaComponents = {
      baseValue: 1000, feriePct: 12, fritvalgPct: 0, shSoPct: 0, pensionPct: 10, storeBededagPct: 0.45,
    };
    expect(computeFormulaValue(components)).toBeCloseTo(1236.95, 4);
  });

  it('storeBededagPct = 0 er neutral i formelresultatet', () => {
    const components: FormulaComponents = {
      baseValue: 1000, feriePct: 12, fritvalgPct: 0, shSoPct: 0, pensionPct: 10, storeBededagPct: 0,
    };
    // 1000 × 1,12 × 1,10 = 1232
    expect(computeFormulaValue(components)).toBeCloseTo(1232, 4);
  });
});

// ─── parsePercentInput ────────────────────────────────────────────────────────

describe('parsePercentInput', () => {
  it('undefined → 0', () => {
    expect(parsePercentInput(undefined)).toBe(0);
  });

  it('tom streng → 0', () => {
    expect(parsePercentInput('')).toBe(0);
  });

  it('kun whitespace → 0', () => {
    expect(parsePercentInput('   ')).toBe(0);
  });

  it('heltal som streng → tal', () => {
    expect(parsePercentInput('12')).toBe(12);
  });

  it('med procent-tegn → tal uden procent-tegn', () => {
    expect(parsePercentInput('12%')).toBe(12);
  });

  it('dansk komma-decimal → parsed korrekt', () => {
    expect(parsePercentInput('12,5')).toBe(12.5);
  });

  it('dansk tusindtals-separator og komma-decimal → parsed korrekt', () => {
    // "1.234,56" → remove dots → "1234,56" → replace comma → 1234.56
    expect(parsePercentInput('1.234,56')).toBeCloseTo(1234.56, 6);
  });

  it('NaN-streng → 0', () => {
    expect(parsePercentInput('abc')).toBe(0);
  });

  it('nul → 0', () => {
    expect(parsePercentInput('0')).toBe(0);
  });
});

// ─── resolveFeriePctForFormula ────────────────────────────────────────────────

describe('resolveFeriePctForFormula', () => {
  it('row-værdi non-tom → brug row-værdi', () => {
    expect(resolveFeriePctForFormula('12', 8)).toBe(12);
  });

  it('row-værdi tom string → brug fallback', () => {
    expect(resolveFeriePctForFormula('', 8)).toBe(8);
  });

  it('row-værdi undefined → brug fallback', () => {
    expect(resolveFeriePctForFormula(undefined, 8)).toBe(8);
  });

  it('fallback undefined og row tom → 0', () => {
    expect(resolveFeriePctForFormula('', undefined)).toBe(0);
  });

  it('fallback NaN og row tom → 0', () => {
    expect(resolveFeriePctForFormula('', NaN)).toBe(0);
  });

  it('fallback Infinity og row tom → 0', () => {
    expect(resolveFeriePctForFormula('', Infinity)).toBe(0);
  });

  it('row-værdi med procent-tegn → parsed korrekt', () => {
    expect(resolveFeriePctForFormula('12%', 0)).toBe(12);
  });
});

// ─── formatPercentCellFromRaw ─────────────────────────────────────────────────

describe('formatPercentCellFromRaw', () => {
  it('undefined → "-"', () => {
    expect(formatPercentCellFromRaw(undefined)).toBe('-');
  });

  it('tom streng → "-"', () => {
    expect(formatPercentCellFromRaw('')).toBe('-');
  });

  it('"-" → "-"', () => {
    expect(formatPercentCellFromRaw('-')).toBe('-');
  });

  it('heltal som streng → formateret med 2 decimaler og " %"', () => {
    const result = formatPercentCellFromRaw('12');
    expect(result).toContain('12');
    expect(result).toContain('%');
  });

  it('dansk komma-decimal → formateret korrekt', () => {
    const result = formatPercentCellFromRaw('12,5');
    expect(result).toContain('12');
    expect(result).toContain('%');
  });

  it('ugyldig tal med procent-tegn → returnerer originalstreng med %', () => {
    const result = formatPercentCellFromRaw('abc%');
    expect(result).toBe('abc%');
  });

  it('ugyldig tal uden procent-tegn → returnerer originalstreng med " %"', () => {
    const result = formatPercentCellFromRaw('abc');
    expect(result).toBe('abc %');
  });
});

// ─── mergeFeriepengeDisplay ───────────────────────────────────────────────────

describe('mergeFeriepengeDisplay', () => {
  it('begge undefined → "-"', () => {
    expect(mergeFeriepengeDisplay(undefined, undefined)).toBe('-');
  });

  it('begge tomme strenge → "-"', () => {
    expect(mergeFeriepengeDisplay('', '')).toBe('-');
  });

  it('kun venstre sat → venstre', () => {
    expect(mergeFeriepengeDisplay('12,00 %', undefined)).toBe('12,00 %');
  });

  it('kun højre sat → højre', () => {
    expect(mergeFeriepengeDisplay(undefined, '100 kr')).toBe('100 kr');
  });

  it('begge ens → returnerer én gang', () => {
    expect(mergeFeriepengeDisplay('12,00 %', '12,00 %')).toBe('12,00 %');
  });

  it('samme procentværdi med forskellig formattering → returnerer én gang', () => {
    expect(mergeFeriepengeDisplay('15 %', '15,00 %')).toBe('15,00 %');
  });

  it('begge sat og forskellige → "venstre / højre"', () => {
    expect(mergeFeriepengeDisplay('12,00 %', '100 kr')).toBe('12,00 % / 100 kr');
  });

  it('"-" behandles som tom', () => {
    expect(mergeFeriepengeDisplay('-', 'abc')).toBe('abc');
  });
});

// ─── wrapIndexFormulaAfterSlashWhenLong ──────────────────────────────────────

describe('wrapIndexFormulaAfterSlashWhenLong', () => {
  it('kort streng → uændret', () => {
    const short = 'A / B';
    expect(wrapIndexFormulaAfterSlashWhenLong(short)).toBe(short);
  });

  it('allerede med linjeskift → uændret', () => {
    const withNewline = 'A /\nB';
    expect(wrapIndexFormulaAfterSlashWhenLong(withNewline)).toBe(withNewline);
  });

  it('lang streng med præcis 2 dele → wrap ved "/"', () => {
    const left = 'A'.repeat(50);
    const right = 'B'.repeat(50);
    const value = `${left} / ${right}`;
    const result = wrapIndexFormulaAfterSlashWhenLong(value);
    expect(result).toBe(`${left} /\n${right}`);
  });

  it('lang streng med 3 dele → uændret (ikke nøjagtig 2 dele)', () => {
    const value = `${'A'.repeat(35)} / ${'B'.repeat(35)} / ${'C'.repeat(35)}`;
    expect(wrapIndexFormulaAfterSlashWhenLong(value)).toBe(value);
  });

  it('lang streng uden "/" → uændret', () => {
    const value = 'X'.repeat(100);
    expect(wrapIndexFormulaAfterSlashWhenLong(value)).toBe(value);
  });

  it('custom maxInlineLength respekteres', () => {
    const value = 'AB / CD';
    expect(wrapIndexFormulaAfterSlashWhenLong(value, 5)).toBe('AB /\nCD');
  });
});

// ─── formatOverenskomstPercent ────────────────────────────────────────────────

describe('formatOverenskomstPercent', () => {
  it('null → "-"', () => {
    expect(formatOverenskomstPercent(null)).toBe('-');
  });

  it('undefined → "-"', () => {
    expect(formatOverenskomstPercent(undefined)).toBe('-');
  });

  it('0.5 → "50,00 %"', () => {
    expect(formatOverenskomstPercent(0.5)).toBe('50,00 %');
  });

  it('0.1234 → "12,34 %"', () => {
    expect(formatOverenskomstPercent(0.1234)).toBe('12,34 %');
  });

  it('0 → "0,00 %"', () => {
    expect(formatOverenskomstPercent(0)).toBe('0,00 %');
  });
});

// ─── formatOverenskomstAmount ─────────────────────────────────────────────────

describe('formatOverenskomstAmount', () => {
  it('null → "-"', () => {
    expect(formatOverenskomstAmount(null)).toBe('-');
  });

  it('undefined → "-"', () => {
    expect(formatOverenskomstAmount(undefined)).toBe('-');
  });

  it('1000 → "1.000,00"', () => {
    expect(formatOverenskomstAmount(1000)).toBe('1.000,00');
  });

  it('1234.5 → "1.234,50"', () => {
    expect(formatOverenskomstAmount(1234.5)).toBe('1.234,50');
  });

  it('0 → "0,00"', () => {
    expect(formatOverenskomstAmount(0)).toBe('0,00');
  });
});

// ─── buildFormulaText ────────────────────────────────────────────────────────

describe('buildFormulaText', () => {
  const allVisible: FormulaVisibility = {
    showFritvalg: true, showShSo: true, showPension: true, showStoreBededag: true,
  };

  const noExtras: FormulaComponents = {
    baseValue: 100, feriePct: 0, fritvalgPct: 0, shSoPct: 0, pensionPct: 0, storeBededagPct: 0,
  };

  it('ingen tillæg → kun baseValue', () => {
    const result = buildFormulaText(noExtras, allVisible);
    expect(result).toBe('100,00');
  });

  it('kun ferie → baseValue x (100 % + ferieStr)', () => {
    const components: FormulaComponents = {
      baseValue: 1000, feriePct: 12, fritvalgPct: 0, shSoPct: 0, pensionPct: 0, storeBededagPct: 0,
    };
    const result = buildFormulaText(components, allVisible);
    expect(result).toContain('x');
    expect(result).toContain('100 %');
    expect(result).toContain('12 %');
  });

  it('kun pension (showPension=true) → baseValue x (100 % + pensionStr)', () => {
    const components: FormulaComponents = {
      baseValue: 1000, feriePct: 0, fritvalgPct: 0, shSoPct: 0, pensionPct: 10, storeBededagPct: 0,
    };
    const result = buildFormulaText(components, allVisible);
    expect(result).toContain('100 %');
    expect(result).toContain('10 %');
  });

  it('showPension=false → pension udelades selvom pensionPct != 0', () => {
    const components: FormulaComponents = {
      baseValue: 1000, feriePct: 0, fritvalgPct: 0, shSoPct: 0, pensionPct: 10, storeBededagPct: 0,
    };
    const nosPension: FormulaVisibility = { showFritvalg: true, showShSo: true, showPension: false, showStoreBededag: true };
    const result = buildFormulaText(components, nosPension);
    // Ingen tillæg og pension skjult → kun baseValue
    expect(result).toBe('1.000,00');
  });

  it('ferie + pension → to faktorer (x ... x ...)', () => {
    const components: FormulaComponents = {
      baseValue: 100, feriePct: 12, fritvalgPct: 0, shSoPct: 0, pensionPct: 10, storeBededagPct: 0,
    };
    const result = buildFormulaText(components, allVisible);
    const xCount = (result.match(/ x /g) ?? []).length;
    expect(xCount).toBe(2);
  });

  it('showFritvalg=false → fritvalg udelades selvom fritvalgPct != 0', () => {
    const components: FormulaComponents = {
      baseValue: 100, feriePct: 0, fritvalgPct: 5, shSoPct: 0, pensionPct: 0, storeBededagPct: 0,
    };
    const noFritvalg: FormulaVisibility = { showFritvalg: false, showShSo: true, showPension: true, showStoreBededag: true };
    const result = buildFormulaText(components, noFritvalg);
    expect(result).toBe('100,00');
  });

  it('showStoreBededag=true og storeBededagPct != 0 → bededagsandel indgår i formelteksten', () => {
    const components: FormulaComponents = {
      baseValue: 1000, feriePct: 12, fritvalgPct: 0, shSoPct: 0, pensionPct: 0, storeBededagPct: 0.45,
    };
    const result = buildFormulaText(components, allVisible);
    // Skal indeholde den formatterede bededagsprocent (0,45 %)
    expect(result).toContain('0,45');
    expect(result).toContain('%');
  });

  it('showStoreBededag=false → bededagsandel udelades selvom storeBededagPct != 0', () => {
    const components: FormulaComponents = {
      baseValue: 1000, feriePct: 0, fritvalgPct: 0, shSoPct: 0, pensionPct: 0, storeBededagPct: 0.45,
    };
    const noBededag: FormulaVisibility = { showFritvalg: true, showShSo: true, showPension: true, showStoreBededag: false };
    const result = buildFormulaText(components, noBededag);
    // Ingen andre tillæg + bededag skjult → kun baseValue
    expect(result).toBe('1.000,00');
    expect(result).not.toContain('0,45');
  });

  it('ferie + storeBededag + pension → ferie og bededag i første faktor, pension i anden', () => {
    const components: FormulaComponents = {
      baseValue: 1000, feriePct: 12, fritvalgPct: 0, shSoPct: 0, pensionPct: 10, storeBededagPct: 0.45,
    };
    const result = buildFormulaText(components, allVisible);
    const xCount = (result.match(/ x /g) ?? []).length;
    // Tillæg (ferie + bededag) udgør én faktor; pension udgør en anden
    expect(xCount).toBe(2);
    expect(result).toContain('12');
    expect(result).toContain('0,45');
    expect(result).toContain('10');
  });
});
