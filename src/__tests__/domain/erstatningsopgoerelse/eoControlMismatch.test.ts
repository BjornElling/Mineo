import {
  collectSammentaellingControlMismatchMessages,
  getSammentaellingControlStatus,
  type SammentaellingControl,
  type SammentaellingDisplayRow,
} from '../../../domain/erstatningsopgoerelse/control/eoControlMismatch';

const control = (overrides: Partial<SammentaellingControl>): SammentaellingControl => ({
  beregnetDisplay: '-',
  tabelDisplay: '-',
  beregnetValue: null,
  tabelValue: null,
  loseFeriedage: 0,
  oevrigeFravaersdage: 0,
  ...overrides,
});

describe('eoControlMismatch (produktions-ejet kontrol-/audit-kerne)', () => {
  it('null/0 mod null/0 er ok (tomt mod tomt)', () => {
    expect(getSammentaellingControlStatus(control({ beregnetValue: 0, tabelValue: null }))).toBe('ok');
    expect(getSammentaellingControlStatus(control({ beregnetValue: null, tabelValue: 0 }))).toBe('ok');
  });

  it('lille floating-forskel inden for 0.005 er ok', () => {
    expect(getSammentaellingControlStatus(control({ beregnetValue: 100, tabelValue: 100.004 }))).toBe('ok');
  });

  it('forskel over tolerancen er error', () => {
    expect(getSammentaellingControlStatus(control({ beregnetValue: 100, tabelValue: 100.02 }))).toBe('error');
  });

  it('én side tom og den anden et tal er error', () => {
    expect(getSammentaellingControlStatus(control({ beregnetValue: 50, tabelValue: null }))).toBe('error');
  });

  it('collect samler kun error-rækker og formaterer "label: beregnet=…, tabel=…"', () => {
    const rows: SammentaellingDisplayRow[] = [
      { key: 'ok', label: 'Enig række', control: control({ beregnetValue: 10, tabelValue: 10 }) },
      {
        key: 'mismatch',
        label: 'Uenig række',
        control: control({ beregnetValue: 10, tabelValue: 12, beregnetDisplay: '10', tabelDisplay: '12' }),
      },
    ];
    expect(collectSammentaellingControlMismatchMessages(rows)).toEqual([
      'Uenig række: beregnet=10, tabel=12',
    ]);
  });
});
