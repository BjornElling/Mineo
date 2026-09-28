import { resolveYdelsestype, ydelsestyper, ydelsestypeKeys } from '../../data/ydelsestyper';

describe('ydelsestyper registry', () => {
  it('har periodisering og periodiseringslabel for alle ydelsestyper', () => {
    for (const key of ydelsestypeKeys) {
      const config = ydelsestyper[key];
      expect(config).toBeDefined();
      expect(config.periodisering === 'kalenderdage' || config.periodisering === 'arbejdsdage').toBe(true);
      expect(config.periodiseringLabel.trim().length).toBeGreaterThan(0);
    }
  });

  it('har Efterløn med kalenderdage-periodisering', () => {
    const config = ydelsestyper.efterloen;
    expect(config).toBeDefined();
    expect(config.label).toBe('Efterløn');
    expect(config.periodisering).toBe('kalenderdage');
    expect(config.periodiseringLabel).toBe('Kalenderdage');
  });

  it('placerer Uddannelseshjælp efter SU og før Andet', () => {
    const suIndex = ydelsestypeKeys.indexOf('su');
    const uddannelseshjaelpIndex = ydelsestypeKeys.indexOf('uddannelseshjaelp');
    const andetIndex = ydelsestypeKeys.indexOf('andet');

    expect(suIndex).toBeGreaterThanOrEqual(0);
    expect(uddannelseshjaelpIndex).toBeGreaterThanOrEqual(0);
    expect(andetIndex).toBeGreaterThanOrEqual(0);
    expect(uddannelseshjaelpIndex).toBe(suIndex + 1);
    expect(andetIndex).toBe(uddannelseshjaelpIndex + 1);
  });

  it('alle 15 forventede ydelsestyper er registreret', () => {
    const expected = [
      'dagpenge', 'efterloen', 'feriepenge', 'flextilskud', 'foertidspension', 'kontanthjaelp', 'ledighedsydelse',
      'midlertidigt_eet', 'pension', 'ressourceforloebsydelse', 'revalideringsydelse',
      'sygedagpenge', 'su', 'uddannelseshjaelp', 'andet',
    ];
    expect(ydelsestypeKeys).toHaveLength(expected.length);
    for (const key of expected) {
      expect(ydelsestypeKeys).toContain(key);
    }
  });

  it('alle labels er unikke', () => {
    const labels = ydelsestypeKeys.map((k) => ydelsestyper[k].label);
    const uniqueLabels = new Set(labels);
    expect(uniqueLabels.size).toBe(labels.length);
  });

  it('feriepenge bruger arbejdsdage-periodisering og er placeret efter Efterløn', () => {
    const config = ydelsestyper.feriepenge;
    expect(config).toBeDefined();
    expect(config.label).toBe('Feriepenge');
    expect(config.periodisering).toBe('arbejdsdage');
    expect(config.periodiseringLabel).toBe('Arbejdsdage');
    expect(ydelsestypeKeys.indexOf('feriepenge')).toBe(ydelsestypeKeys.indexOf('efterloen') + 1);
  });

  it('kun sygedagpenge og feriepenge bruger arbejdsdage-periodisering', () => {
    const arbejdsdageKeys = ydelsestypeKeys.filter(
      (k) => ydelsestyper[k].periodisering === 'arbejdsdage'
    );
    expect(arbejdsdageKeys).toEqual(['feriepenge', 'sygedagpenge']);
  });

  it('tabelLabel er kun sat for ydelsestyper med lange labels (ledighedsydelse, revalideringsydelse, uddannelseshjaelp)', () => {
    expect(ydelsestyper.ledighedsydelse.tabelLabel).toBeDefined();
    expect(ydelsestyper.revalideringsydelse.tabelLabel).toBeDefined();
    expect(ydelsestyper.uddannelseshjaelp.tabelLabel).toBeDefined();
    // Andre har ingen tabelLabel
    expect(ydelsestyper.dagpenge.tabelLabel).toBeUndefined();
    expect(ydelsestyper.efterloen.tabelLabel).toBeUndefined();
    expect(ydelsestyper.sygedagpenge.tabelLabel).toBeUndefined();
  });

  it('resolver både kanoniske nøgler og tidligere gemte labels til samme nøgle', () => {
    const facit = [
      ['dagpenge', 'Dagpenge'],
      ['efterloen', 'Efterløn'],
      ['feriepenge', 'Feriepenge'],
      ['flextilskud', 'Flextilskud'],
      ['foertidspension', 'Førtidspension'],
      ['kontanthjaelp', 'Kontanthjælp'],
      ['ledighedsydelse', 'Ledighedsydelse'],
      ['midlertidigt_eet', 'Midlertidigt EET'],
      ['pension', 'Pension'],
      ['ressourceforloebsydelse', 'Ress. forløbsydelse'],
      ['revalideringsydelse', 'Revalideringsydelse'],
      ['sygedagpenge', 'Sygedagpenge'],
      ['su', 'SU'],
      ['uddannelseshjaelp', 'Uddannelseshjælp'],
      ['andet', 'Andet'],
    ] as const;

    for (const [key, label] of facit) {
      expect(resolveYdelsestype(key)).toMatchObject({ key, config: ydelsestyper[key] });
      expect(resolveYdelsestype(label)).toMatchObject({ key, config: ydelsestyper[key] });
    }
  });

  it('resolver historiske labels med whitespace og anden versalisering', () => {
    expect(resolveYdelsestype('  sYgEdAgPeNgE  ')).toMatchObject({
      key: 'sygedagpenge',
      config: ydelsestyper.sygedagpenge,
    });
    expect(resolveYdelsestype('  Ress. FORLØBSYDELSE  ')).toMatchObject({
      key: 'ressourceforloebsydelse',
      config: ydelsestyper.ressourceforloebsydelse,
    });
  });

  it('resolver ukendte og tomme ydelsestyper fail-closed', () => {
    expect(resolveYdelsestype('')).toBeNull();
    expect(resolveYdelsestype('   ')).toBeNull();
    expect(resolveYdelsestype('ukendt ydelse')).toBeNull();
  });
});
