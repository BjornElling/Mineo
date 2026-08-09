import {
  isDateDraftSeparatorChar,
  normalizeDateDraftSeparators,
  normalizeDateDraftOnCommit,
  isDateLikeDraftAllowed,
} from '../../utils/dateDraftNormalization';

// ─── isDateDraftSeparatorChar ──────────────────────────────────────────────

describe('isDateDraftSeparatorChar', () => {
  it('tom streng → false', () => {
    expect(isDateDraftSeparatorChar('')).toBe(false);
  });

  it('ciffer → false (ikke separator)', () => {
    expect(isDateDraftSeparatorChar('5')).toBe(false);
  });

  it('bogstav → false (alfanumerisk)', () => {
    expect(isDateDraftSeparatorChar('a')).toBe(false);
    expect(isDateDraftSeparatorChar('æ')).toBe(false);
  });

  it('bindestreg, punktum, skråstreg, mellemrum → true', () => {
    expect(isDateDraftSeparatorChar('-')).toBe(true);
    expect(isDateDraftSeparatorChar('.')).toBe(true);
    expect(isDateDraftSeparatorChar('/')).toBe(true);
    expect(isDateDraftSeparatorChar(' ')).toBe(true);
  });
});

// ─── normalizeDateDraftSeparators ──────────────────────────────────────────

describe('normalizeDateDraftSeparators', () => {
  it('punktum-separatorer → bindestreg', () => {
    expect(normalizeDateDraftSeparators('15.06.2024')).toBe('15-06-2024');
  });

  it('skråstreg-separatorer → bindestreg', () => {
    expect(normalizeDateDraftSeparators('15/06/2024')).toBe('15-06-2024');
  });

  it('blandede og gentagne separatorer kollapses til én bindestreg', () => {
    expect(normalizeDateDraftSeparators('15 . / 06--2024')).toBe('15-06-2024');
  });

  it('trimmer whitespace i kanterne', () => {
    expect(normalizeDateDraftSeparators('  15-06-2024  ')).toBe('15-06-2024');
  });

  it('rene cifre forbliver uændret', () => {
    expect(normalizeDateDraftSeparators('15062024')).toBe('15062024');
  });
});

// ─── normalizeDateDraftOnCommit ────────────────────────────────────────────

describe('normalizeDateDraftOnCommit', () => {
  it('trimmer kun whitespace', () => {
    expect(normalizeDateDraftOnCommit('  15-06-2024  ')).toBe('15-06-2024');
  });

  it('ændrer ikke interne separatorer', () => {
    expect(normalizeDateDraftOnCommit('15.06.2024')).toBe('15.06.2024');
  });
});

// ─── isDateLikeDraftAllowed ────────────────────────────────────────────────

describe('isDateLikeDraftAllowed', () => {
  const segments = [2, 2, 4] as const;

  it('komplet dd-mm-yyyy → tilladt', () => {
    expect(isDateLikeDraftAllowed('15-06-2024', segments)).toBe(true);
  });

  it('delvis indtastning → tilladt', () => {
    expect(isDateLikeDraftAllowed('1', segments)).toBe(true);
    expect(isDateLikeDraftAllowed('15-', segments)).toBe(true);
    expect(isDateLikeDraftAllowed('15-06', segments)).toBe(true);
  });

  it('3-cifret dag → ikke tilladt (segment for langt)', () => {
    expect(isDateLikeDraftAllowed('155', segments)).toBe(false);
  });

  it('3-cifret måned → ikke tilladt', () => {
    expect(isDateLikeDraftAllowed('15-066', segments)).toBe(false);
  });

  it('5-cifret år → ikke tilladt', () => {
    expect(isDateLikeDraftAllowed('15-06-20245', segments)).toBe(false);
  });

  it('for mange segmenter → ikke tilladt', () => {
    expect(isDateLikeDraftAllowed('15-06-2024-1', segments)).toBe(false);
  });

  it('bogstaver → ikke tilladt', () => {
    expect(isDateLikeDraftAllowed('15-ab-2024', segments)).toBe(false);
  });

  it('tom streng → tilladt', () => {
    expect(isDateLikeDraftAllowed('', segments)).toBe(true);
  });

  // ── Gentagne separatorer (BF-029) ──
  // Netop DENNE gruppe manglede, da segment-regexen blev udskiftet i `5c864afe` (2026-04-23).
  // Ciffer-lofterne havde tests og blev derfor bevaret; gentagne separatorer havde ingen, og
  // afvisningen af dem forsvandt uden at noget blev rødt. Fjernes værnet igen, bliver disse røde.

  // Cases er bevidst KORTE — `12-2--` frem for `12--2--2026`. En lang draft med ekstra separatorer
  // afvises nemlig også af segment-loftet («for mange segmenter»), fordi hver separator rykker
  // segmentindekset. Den ville derfor være grøn, selv hvis afvisningen af gentagne separatorer blev
  // slettet, og målte altså en KONKURRERENDE mekanisme frem for reglen her. Målt: under en mutation,
  // der fjerner `previousWasSeparator`-afvisningen, forbliver `12--2--2026` afvist, mens `12-2--`
  // bliver tilladt. Kun den korte case er derfor evidens.

  it('anden separator på stribe → ikke tilladt (BF-029)', () => {
    expect(isDateLikeDraftAllowed('12-2--', segments)).toBe(false);
    expect(isDateLikeDraftAllowed('12-2----------', segments)).toBe(false);
    expect(isDateLikeDraftAllowed('12--', segments)).toBe(false);
  });

  it('gentagne separatorer af BLANDET slags → ikke tilladt', () => {
    // Reglen er «to separatorer i træk», ikke «to ens tegn i træk».
    expect(isDateLikeDraftAllowed('12-.', segments)).toBe(false);
    expect(isDateLikeDraftAllowed('12- ', segments)).toBe(false);
    expect(isDateLikeDraftAllowed('12./', segments)).toBe(false);
  });

  it('den fulde BF-029-draft er afvist (uanset hvilken regel der fanger den)', () => {
    // Brugerens oprindelige reproduktion. Her kan BEGGE regler fange, og det er fint — testen
    // dokumenterer udfaldet for brugerfundet, mens de korte cases ovenfor beviser mekanismen.
    expect(isDateLikeDraftAllowed('12-2----------2026', segments)).toBe(false);
    expect(isDateLikeDraftAllowed('12--2--2026', segments)).toBe(false);
  });

  it('ÉN separator mellem hvert segment → fortsat tilladt', () => {
    // Kontrolgruppe: værnet må kun ramme den ANDEN separator, ikke den første.
    expect(isDateLikeDraftAllowed('12-2-2026', segments)).toBe(true);
    expect(isDateLikeDraftAllowed('12.2.2026', segments)).toBe(true);
    expect(isDateLikeDraftAllowed('12 2 2026', segments)).toBe(true);
    expect(isDateLikeDraftAllowed('1/1/28', segments)).toBe(true);
  });

  // ── Separatorer før første tal (§2.1: «ignoreres») ──

  it('separatorer før første tal → tilladt og betydningsløse', () => {
    expect(isDateLikeDraftAllowed('-12', segments)).toBe(true);
    expect(isDateLikeDraftAllowed('---12-2-2026', segments)).toBe(true);
    // De må ikke forbruge et segment: er de betydningsløse, er der stadig plads til alle tre dele.
    expect(isDateLikeDraftAllowed('.15-06-2024', segments)).toBe(true);
  });

  it('trailing separator → tilladt at TASTE (afvises først ved commit)', () => {
    // Den slettede `StyledDateField`-testcase «committer ikke ufuldstændig dato med trailing
    // separator» krævede, at `1-1-2-` kan tastes og først bliver en fejl ved settle. Blokeres den
    // her, kan brugeren ikke skrive separatoren før næste ciffer.
    expect(isDateLikeDraftAllowed('12-2-2026-', segments)).toBe(true);
    expect(isDateLikeDraftAllowed('1-1-2-', segments)).toBe(true);
  });

  it('vilkårligt ikke-alfanumerisk tegn er en gyldig separator', () => {
    // Værnet mod gentagne separatorer må IKKE snævre separatorsættet ind til den gamle regex'
    // `[.,/\- ]`. `1,1@28` blev tilføjet som testcase, da den gamle regex blev udskiftet, og skal
    // fortsat kunne tastes.
    expect(isDateLikeDraftAllowed('1,1@28', segments)).toBe(true);
  });
});
