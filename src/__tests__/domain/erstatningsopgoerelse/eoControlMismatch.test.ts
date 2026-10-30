import {
  beregnetVaerdi,
  buildSammentaellingControl,
  collectSammentaellingControlMismatchMessages,
  formatSammentaellingVaerdi,
  getSammentaellingControlStatus,
  grundlagMangler,
  SAMMENTAELLING_TOM_VISNING,
  type SammentaellingControl,
  type SammentaellingDisplayRow,
} from '../../../domain/erstatningsopgoerelse/control/eoControlMismatch';

/**
 * Kontrolrækker bygges gennem produktionskonstruktøren – de kan ikke længere skrives i hånden.
 * Det er hele pointen med brandet: testen prøver samme vej som koden.
 */
const control = (overrides: Readonly<{
  beregnetValue?: number | null;
  tabelValue?: number | null;
  beregnetDisplay?: string;
  tabelDisplay?: string;
}>): SammentaellingControl => buildSammentaellingControl({
  beregnet: beregnetVaerdi(overrides.beregnetValue ?? null, overrides.beregnetDisplay ?? '-'),
  tabel: { value: overrides.tabelValue ?? null, display: overrides.tabelDisplay ?? '-' },
});

describe('eoControlMismatch (produktions-ejet kontrol-/audit-kerne)', () => {
  it('null/0 mod null/0 er tomt mod tomt: ingen uoverensstemmelse og intet mærke (BB-386)', () => {
    expect(getSammentaellingControlStatus(control({ beregnetValue: 0, tabelValue: null }))).toBe('tom');
    expect(getSammentaellingControlStatus(control({ beregnetValue: null, tabelValue: 0 }))).toBe('tom');
  });

  it('et beløb under en halv øre er tomt i både sammenligning og visning', () => {
    // Før stod «0,00» over for «-» med et rødt kryds mellem to sider, der begge reelt var tomme.
    expect(getSammentaellingControlStatus(control({ beregnetValue: 0.004, tabelValue: null }))).toBe('tom');
    expect(formatSammentaellingVaerdi(0.004, () => '0,00')).toBe(SAMMENTAELLING_TOM_VISNING);
    expect(formatSammentaellingVaerdi(0, () => '0')).toBe(SAMMENTAELLING_TOM_VISNING);
    expect(formatSammentaellingVaerdi(null, () => 'x')).toBe(SAMMENTAELLING_TOM_VISNING);
    expect(formatSammentaellingVaerdi(0.006, () => '0,01')).toBe('0,01');
  });

  it('tomt mod tomt med et vist tal (fradrag ved siden af) er kontrolleret og får ✓', () => {
    expect(getSammentaellingControlStatus(control({
      beregnetValue: 0,
      tabelValue: 0,
      tabelDisplay: '2 (- 2)',
    }))).toBe('ok');
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

  describe('manglende grundlag', () => {
    /**
     * Reglen konstruktøren håndhæver: en uoverensstemmelse kan kun opstå mellem to FAKTISK dannede
     * opgørelser. Uden den blev et tomt påkrævet felt eller to overlappende perioder til
     * `control:sammentaelling_mismatch` – en systemfejl, der åbner «Teknisk fejl registreret»
     * (brugerfund 2026-09-17).
     */
    const udenGrundlag = buildSammentaellingControl({
      beregnet: grundlagMangler,
      tabel: { value: 263, display: '263' },
    });

    it('tømmer BEGGE sider, så et tabeltal ikke kan stå alene', () => {
      expect(udenGrundlag.beregnetValue).toBeNull();
      expect(udenGrundlag.tabelValue).toBeNull();
      expect(udenGrundlag.beregnetDisplay).toBe('-');
      expect(udenGrundlag.tabelDisplay).toBe('-');
    });

    it('giver ingen uoverensstemmelse', () => {
      expect(getSammentaellingControlStatus(udenGrundlag)).toBe('tom');
      expect(collectSammentaellingControlMismatchMessages([
        { key: 'uden-grundlag', label: 'Arbejdsdage i beregningsperiode', control: udenGrundlag },
      ])).toEqual([]);
    });

    it('skjuler derimod IKKE en opgørelse, der blev dannet uden værdi', () => {
      // Grundlaget var der; opgørelsen kunne bare ikke dannes. Det er et ægte fund og skal meldes.
      expect(getSammentaellingControlStatus(control({ beregnetValue: null, tabelValue: 263 }))).toBe('error');
    });
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
