import {
  parseDateDraftForCommit,
  DATE_YEAR_OUT_OF_RANGE_MESSAGE,
  NONEXISTENT_DAY_MESSAGE,
  MIN_REPRESENTABLE_DATE_YEAR,
  MAX_REPRESENTABLE_DATE_YEAR,
} from '../../utils/dateDraftCommit';
import { isISODateString } from '../../types/branded';

const commit = (draft: string, policy: 'reject' | 'infer' | 'assume20xx' = 'infer') =>
  parseDateDraftForCommit(draft, { twoDigitYearPolicy: policy });

describe('parseDateDraftForCommit', () => {
  it('tom streng → ok med tom danish og undefined iso', () => {
    expect(commit('')).toEqual({ ok: true, danish: '', iso: undefined });
    expect(commit('   ')).toEqual({ ok: true, danish: '', iso: undefined });
  });

  it('komplet dansk dato → ISO', () => {
    const result = commit('15-06-2024');
    expect(result).toEqual({ ok: true, danish: '15-06-2024', iso: '2024-06-15' });
  });

  it('separatorvarianter normaliseres', () => {
    expect(commit('15.06.2024')).toMatchObject({ ok: true, iso: '2024-06-15' });
    expect(commit('15/06/2024')).toMatchObject({ ok: true, iso: '2024-06-15' });
  });

  it('rene 8 cifre fortolkes som ddmmyyyy', () => {
    expect(commit('15062024')).toMatchObject({ ok: true, iso: '2024-06-15' });
  });

  it('rene 6 cifre fortolkes som ddmmyy med år-policy', () => {
    expect(commit('150624', 'assume20xx')).toMatchObject({ ok: true, iso: '2024-06-15' });
  });

  it('enkeltcifret dag/måned padder med nul', () => {
    expect(commit('1-2-2024')).toMatchObject({ ok: true, danish: '01-02-2024', iso: '2024-02-01' });
  });

  it('ugyldig dag (32) → invalid ved commit', () => {
    expect(commit('32-06-2024')).toMatchObject({ ok: false, kind: 'invalid' });
  });

  it('ugyldig måned (13) → invalid', () => {
    expect(commit('15-13-2024')).toMatchObject({ ok: false, kind: 'invalid' });
  });

  it('31. februar → invalid (eksisterer ikke)', () => {
    expect(commit('31-02-2024')).toMatchObject({ ok: false, kind: 'invalid' });
  });

  it('29. februar i skudår → gyldig', () => {
    expect(commit('29-02-2024')).toMatchObject({ ok: true, iso: '2024-02-29' });
  });

  it('29. februar i ikke-skudår → invalid', () => {
    expect(commit('29-02-2023')).toMatchObject({ ok: false, kind: 'invalid' });
  });

  it('bogstaver → invalid', () => {
    expect(commit('15-ab-2024')).toMatchObject({ ok: false, kind: 'invalid' });
  });

  it('for langt input → invalid', () => {
    expect(commit('15-06-2024-extra')).toMatchObject({ ok: false, kind: 'invalid' });
  });

  it('3-cifret år → invalid', () => {
    expect(commit('15-06-202')).toMatchObject({ ok: false, kind: 'invalid' });
  });

  /**
   * `31-12-1899` er en fuldt gyldig KALENDERdato, hvis ÅRSTAL blot ligger uden for det domæne, en
   * `ISODateString` kan repræsentere. Uden en maskinlæsbar årsag ville den blive afvist med præcis samme
   * flade besked som ren volapyk, og feltet ville vise den generiske «Fejl i indtastning» uden at fortælle
   * brugeren, hvilke datoer der faktisk er mulige.
   *
   * Kernen melder ÅRSAGEN, ikke den endelige tekst: teksten formuleres af feltet, som kender sine egne
   * grænser (`resolveDateFormatIssueText`). Kernens egen besked er kun fald-tilbage for flader uden en
   * grænse-erklæring, og den taler derfor om DATOEN – aldrig om et årsinterval, feltet ikke har.
   */
  describe('afvisningsårsagen er maskinlæsbar', () => {
    it('årstal under det repræsenterbare domæne får sin egen årsag', () => {
      expect(commit('31-12-1899')).toEqual({
        ok: false,
        kind: 'invalid',
        invalidKind: 'yearOutOfRepresentableRange',
        message: DATE_YEAR_OUT_OF_RANGE_MESSAGE,
      });
    });

    it('årstal over det repræsenterbare domæne meldes symmetrisk', () => {
      expect(commit('01-01-2101')).toMatchObject({
        ok: false,
        invalidKind: 'yearOutOfRepresentableRange',
        message: DATE_YEAR_OUT_OF_RANGE_MESSAGE,
      });
    });

    /**
     * Ordlyds-værn: et DATOfelt må aldrig tale om årstalsintervaller. Grænsen 1900..2100 er en
     * repræsentationsdetalje, og en besked om den ville modsige feltets faktiske grænse.
     */
    it('taler om datoen, ikke om et årsinterval', () => {
      expect(DATE_YEAR_OUT_OF_RANGE_MESSAGE).not.toMatch(/årstal/i);
      expect(DATE_YEAR_OUT_OF_RANGE_MESSAGE).not.toMatch(/1900|2100/);
    });

    it('begge yderpunkter er INDE i domænet', () => {
      expect(commit('01-01-1900')).toMatchObject({ ok: true, iso: '1900-01-01' });
      expect(commit('31-12-2100')).toMatchObject({ ok: true, iso: '2100-12-31' });
    });

    it('en ikke-eksisterende kalenderdag får sin egen konkrete årsag', () => {
      expect(commit('31-02-2026')).toMatchObject({
        ok: false,
        invalidKind: 'nonexistentDay',
        message: NONEXISTENT_DAY_MESSAGE,
      });
      expect(commit('29-02-2023')).toMatchObject({ ok: false, invalidKind: 'nonexistentDay' });
    });

    /**
     * Årstallet vurderes FØR kalenderdagen: når året alligevel er umuligt, er det den fejl brugeren skal
     * rette først – uanset hvilken dag der står foran.
     */
    it('et umuligt årstal vinder over en umulig dag', () => {
      expect(commit('31-02-1899')).toMatchObject({ invalidKind: 'yearOutOfRepresentableRange' });
    });

    it('uparsebar tekst forbliver `malformed` uden en konkret besked', () => {
      for (const draft of ['abc', '15-', '15-06-202', '15-ab-2024']) {
        expect(commit(draft)).toMatchObject({ ok: false, invalidKind: 'malformed' });
      }
    });

    /**
     * Liveness-værn: konstanterne er kun sande, så længe de matcher `isISODateString`, som er den ENE kilde
     * til hvad en gyldig ISO-dato er. Flyttes det ene interval uden det andet, bliver beskeden en løgn.
     */
    it('årstals-konstanterne matcher isISODateString', () => {
      const pad = (year: number) => `${String(year).padStart(4, '0')}-06-15`;
      expect(isISODateString(pad(MIN_REPRESENTABLE_DATE_YEAR))).toBe(true);
      expect(isISODateString(pad(MAX_REPRESENTABLE_DATE_YEAR))).toBe(true);
      expect(isISODateString(pad(MIN_REPRESENTABLE_DATE_YEAR - 1))).toBe(false);
      expect(isISODateString(pad(MAX_REPRESENTABLE_DATE_YEAR + 1))).toBe(false);
      // Konstanterne styrer, hvornår årsagen udløses – netop på domænets kant.
      expect(commit(`31-12-${MIN_REPRESENTABLE_DATE_YEAR - 1}`))
        .toMatchObject({ invalidKind: 'yearOutOfRepresentableRange' });
      expect(commit(`01-01-${MAX_REPRESENTABLE_DATE_YEAR + 1}`))
        .toMatchObject({ invalidKind: 'yearOutOfRepresentableRange' });
    });
  });

  describe('to-cifret år-policy', () => {
    it('reject → invalid ved commit', () => {
      expect(commit('15-06-24', 'reject')).toMatchObject({ ok: false, kind: 'invalid' });
    });

    it('assume20xx → 20xx', () => {
      expect(commit('15-06-24', 'assume20xx')).toMatchObject({ ok: true, iso: '2024-06-15' });
    });

    it('infer → intelligent fortolkning', () => {
      expect(commit('15-06-24', 'infer')).toMatchObject({ ok: true, iso: '2024-06-15' });
    });
  });
});
