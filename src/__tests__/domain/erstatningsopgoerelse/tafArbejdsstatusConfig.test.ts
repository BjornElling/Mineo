import { describe, expect, it } from 'vitest';
import { buildTafArbejdsstatusLinje, TAF_ARBEJDSSTATUS_CONFIG } from '../../../domain/erstatningsopgoerelse/tafArbejdsstatusConfig';
import type { Arbejdsstatus } from '../../../schemas/formSchemas';

const ALLE_STATUSER: Arbejdsstatus[] = [
  'Uarbejdsdygtig',
  'Delvist raskmeldt',
  'Fuldt arbejdsdygtig',
  'Fleksjob',
  'Revalidering',
  'Uddannelse',
  'Førtidspension',
  'Seniorpension',
  'Folkepension',
  'Efterløn',
  'Kontanthjælp',
];

// ─── TAF_ARBEJDSSTATUS_CONFIG ─────────────────────────────────────────────────

describe('TAF_ARBEJDSSTATUS_CONFIG', () => {
  it('indeholder alle 11 arbejdsstatus-nøgler', () => {
    const nøgler = Object.keys(TAF_ARBEJDSSTATUS_CONFIG);
    expect(nøgler).toHaveLength(11);
    for (const status of ALLE_STATUSER) {
      expect(TAF_ARBEJDSSTATUS_CONFIG).toHaveProperty(status);
    }
  });

  it('Uarbejdsdygtig: fortsat = true, ingen prefix/suffix', () => {
    const cfg = TAF_ARBEJDSSTATUS_CONFIG['Uarbejdsdygtig'];
    expect(cfg.fortsat).toBe(true);
    expect(cfg.prefix).toBeNull();
    expect(cfg.suffix).toBeNull();
    expect(cfg.statusTekst).toBe('uarbejdsdygtig');
  });

  it('Delvist raskmeldt: fortsat = true (stadig uarbejdsdygtig periode)', () => {
    const cfg = TAF_ARBEJDSSTATUS_CONFIG['Delvist raskmeldt'];
    expect(cfg.fortsat).toBe(true);
    expect(cfg.statusTekst).toBe('delvist uarbejdsdygtig');
  });

  it('Fuldt arbejdsdygtig: fortsat = false', () => {
    const cfg = TAF_ARBEJDSSTATUS_CONFIG['Fuldt arbejdsdygtig'];
    expect(cfg.fortsat).toBe(false);
  });

  it('Fleksjob: prefix = bevilget, suffix = Delvist uarbejdsdygtig', () => {
    const cfg = TAF_ARBEJDSSTATUS_CONFIG['Fleksjob'];
    expect(cfg.prefix).toBe('bevilget');
    expect(cfg.suffix).toBe('Delvist uarbejdsdygtig');
    expect(cfg.fortsat).toBe(false);
  });

  it('Førtidspension: prefix = på, suffix = Uarbejdsdygtig', () => {
    const cfg = TAF_ARBEJDSSTATUS_CONFIG['Førtidspension'];
    expect(cfg.prefix).toBe('på');
    expect(cfg.suffix).toBe('Uarbejdsdygtig');
    expect(cfg.fortsat).toBe(false);
  });
});

// ─── buildTafArbejdsstatusLinje ───────────────────────────────────────────────

describe('buildTafArbejdsstatusLinje', () => {
  const dato = '02-01-2024';

  it('Uarbejdsdygtig: fortsat, ingen prefix/suffix → "fortsat uarbejdsdygtig."', () => {
    const linje = buildTafArbejdsstatusLinje(dato, 'Uarbejdsdygtig');
    expect(linje).toBe(`Den ${dato} var skadelidte fortsat uarbejdsdygtig.`);
  });

  it('Delvist raskmeldt: fortsat, ingen prefix/suffix → "fortsat delvist uarbejdsdygtig."', () => {
    const linje = buildTafArbejdsstatusLinje(dato, 'Delvist raskmeldt');
    expect(linje).toBe(`Den ${dato} var skadelidte fortsat delvist uarbejdsdygtig.`);
  });

  it('Fuldt arbejdsdygtig: default → "var ... raskmeldt."', () => {
    const linje = buildTafArbejdsstatusLinje(dato, 'Fuldt arbejdsdygtig');
    expect(linje).toBe(`Den ${dato} var skadelidte raskmeldt.`);
  });

  it('Fuldt arbejdsdygtig: opgjort til periodeTil → "blev ... raskmeldt."', () => {
    const linje = buildTafArbejdsstatusLinje(dato, 'Fuldt arbejdsdygtig', { opgjortFremTilPeriodeTil: true });
    expect(linje).toBe(`Den ${dato} blev skadelidte raskmeldt.`);
  });

  it('Fleksjob: prefix=bevilget, suffix=Delvist uarbejdsdygtig → "bevilget fleksjob og således fortsat delvist uarbejdsdygtig."', () => {
    const linje = buildTafArbejdsstatusLinje(dato, 'Fleksjob');
    expect(linje).toBe(`Den ${dato} var skadelidte bevilget fleksjob og således fortsat delvist uarbejdsdygtig.`);
  });

  it('Revalidering: prefix=i, suffix=Delvist uarbejdsdygtig', () => {
    const linje = buildTafArbejdsstatusLinje(dato, 'Revalidering');
    expect(linje).toBe(`Den ${dato} var skadelidte i revalidering og således fortsat delvist uarbejdsdygtig.`);
  });

  it('Uddannelse: prefix=under, ingen suffix → "under uddannelse."', () => {
    const linje = buildTafArbejdsstatusLinje(dato, 'Uddannelse');
    expect(linje).toBe(`Den ${dato} var skadelidte under uddannelse.`);
  });

  it('Førtidspension: prefix=på, suffix=Uarbejdsdygtig (lowercase i output)', () => {
    const linje = buildTafArbejdsstatusLinje(dato, 'Førtidspension');
    expect(linje).toBe(`Den ${dato} var skadelidte på førtidspension og således fortsat uarbejdsdygtig.`);
  });

  it('Seniorpension: prefix=på, ingen suffix → "på seniorpension."', () => {
    const linje = buildTafArbejdsstatusLinje(dato, 'Seniorpension');
    expect(linje).toBe(`Den ${dato} var skadelidte på seniorpension.`);
  });

  it('Folkepension: prefix=på, ingen suffix → "på folkepension."', () => {
    const linje = buildTafArbejdsstatusLinje(dato, 'Folkepension');
    expect(linje).toBe(`Den ${dato} var skadelidte på folkepension.`);
  });

  it('Efterløn: prefix=på, ingen suffix → "på efterløn."', () => {
    const linje = buildTafArbejdsstatusLinje(dato, 'Efterløn');
    expect(linje).toBe(`Den ${dato} var skadelidte på efterløn.`);
  });

  it('Kontanthjælp: prefix=på, ingen suffix → "på kontanthjælp."', () => {
    const linje = buildTafArbejdsstatusLinje(dato, 'Kontanthjælp');
    expect(linje).toBe(`Den ${dato} var skadelidte på kontanthjælp.`);
  });

  it('suffix normaliseres: stor forbogstav → lille i output', () => {
    // 'Uarbejdsdygtig' → 'uarbejdsdygtig', 'Delvist uarbejdsdygtig' → 'delvist uarbejdsdygtig'
    const linje1 = buildTafArbejdsstatusLinje(dato, 'Førtidspension');
    expect(linje1).toContain('fortsat uarbejdsdygtig.');

    const linje2 = buildTafArbejdsstatusLinje(dato, 'Fleksjob');
    expect(linje2).toContain('fortsat delvist uarbejdsdygtig.');
  });

  it('dato bruges verbatim i output', () => {
    const specialDato = '31-12-2025';
    const linje = buildTafArbejdsstatusLinje(specialDato, 'Uarbejdsdygtig');
    expect(linje).toContain(`Den ${specialDato}`);
  });
});
