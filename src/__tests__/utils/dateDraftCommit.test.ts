import { parseDateDraftForCommit } from '../../utils/dateDraftCommit';

const commit = (draft: string, policy: 'reject' | 'infer' | 'assume20xx' = 'infer') =>
  parseDateDraftForCommit(draft, { mode: 'commit', twoDigitYearPolicy: policy });

const typing = (draft: string, policy: 'reject' | 'infer' | 'assume20xx' = 'infer') =>
  parseDateDraftForCommit(draft, { mode: 'typing', twoDigitYearPolicy: policy });

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

  describe('typing-mode', () => {
    it('to-cifret år → partial (afventer flere cifre)', () => {
      expect(typing('15-06-24')).toMatchObject({ ok: false, kind: 'partial' });
    });

    it('komplet dato → ok også under typing', () => {
      expect(typing('15-06-2024')).toMatchObject({ ok: true, iso: '2024-06-15' });
    });

    it('ugyldig dag → partial under typing (ikke invalid)', () => {
      expect(typing('32-06-2024')).toMatchObject({ ok: false, kind: 'partial' });
    });
  });
});
