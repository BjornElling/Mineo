import { asciiSlug } from '../../utils/asciiSlug';

describe('asciiSlug', () => {
  describe('danske særtegn translittereres i stedet for at blive spist', () => {
    // Dette er hele grunden til at primitivet findes. Den tidligere form på de tre
    // callsites var `NFKD` + `[^a-z0-9]`, og `ø` har INGEN NFKD-dekomposition, så
    // den blev erstattet af en separator. Disse cases fejler på den gamle form.
    it('oversætter ø/æ/å efter kodebasens egen oe/ae/aa-konvention', () => {
      expect(asciiSlug('Årsløn')).toBe('aarsloen');
      expect(asciiSlug('Ærø')).toBe('aeroe');
      expect(asciiSlug('Forsørgertab')).toBe('forsoergertab');
      expect(asciiSlug('Erstatningsopgørelse')).toBe('erstatningsopgoerelse');
    });

    it('taber ikke tegn til separatorer (ingen bare bindestreger midt i ordet)', () => {
      // Den gamle form gav 'rsl-n' / 'a-r-'; her må der ikke optræde en separator
      // hvor der stod et dansk bogstav.
      expect(asciiSlug('Årsløn')).not.toContain('-');
      expect(asciiSlug('Ærø')).not.toContain('-');
    });

    it('matcher de identifikatorer kodebasen selv bruger for samme domænebegreb', () => {
      // Værn mod at nogen skifter til den kortere ø→o-konvention: den ville give
      // slugs der afviger fra modulnavnene (aarsloen/, loenindkomst/, opgoerelse).
      expect(asciiSlug('årsløn')).toBe('aarsloen');
      expect(asciiSlug('lønindkomst')).toBe('loenindkomst');
    });
  });

  describe('øvrige diakritiske tegn', () => {
    it('fjerner accenter via NFKD', () => {
      expect(asciiSlug('café')).toBe('cafe');
      expect(asciiSlug('naïve')).toBe('naive');
    });

    it('oversætter tyske/svenske nabotegn', () => {
      expect(asciiSlug('Öresund')).toBe('oeresund');
      expect(asciiSlug('Straße')).toBe('strasse');
      expect(asciiSlug('Müller')).toBe('mueller');
    });
  });

  describe('separator', () => {
    it('bruger bindestreg som default og kollapser løb af øvrige tegn', () => {
      expect(asciiSlug('Erstatningsopgørelse – bilag 3')).toBe('erstatningsopgoerelse-bilag-3');
    });

    it('respekterer en eksplicit separator', () => {
      // safeCompute-fejlkoderne bruger '_' – formatet er load-bearing.
      expect(asciiSlug('aarsloenBeregning.periodeBeregning', { separator: '_' }))
        .toBe('aarsloenberegning_periodeberegning');
    });

    it('trimmer separatorer fra begge ender', () => {
      expect(asciiSlug('  – hej –  ')).toBe('hej');
      expect(asciiSlug('...test...', { separator: '_' })).toBe('test');
    });
  });

  describe('fallback', () => {
    it('returnerer tom streng når intet er sluggbart og ingen fallback er givet', () => {
      expect(asciiSlug('   ')).toBe('');
      expect(asciiSlug('---')).toBe('');
      expect(asciiSlug('')).toBe('');
    });

    it('returnerer fallback når resultatet ville være tomt', () => {
      expect(asciiSlug('   ', { fallback: 'unknown' })).toBe('unknown');
      expect(asciiSlug('!!!', { fallback: 'indtaegtskilde' })).toBe('indtaegtskilde');
    });

    it('bruger ikke fallback når der findes mindst ét sluggbart tegn', () => {
      expect(asciiSlug('a', { fallback: 'unknown' })).toBe('a');
    });
  });

  describe('dokumenteret ikke-injektivitet', () => {
    it('kollapser etiketter der kun adskiller sig uden for [a-z0-9]', () => {
      // Bevidst egenskab – se modulets doc. Testen fastholder den som et VALG,
      // så en fremtidig læser ikke tror det er en utilsigtet kollision.
      expect(asciiSlug('Løn')).toBe(asciiSlug('Loen'));
      expect(asciiSlug('A B')).toBe(asciiSlug('A-B'));
    });
  });
});
