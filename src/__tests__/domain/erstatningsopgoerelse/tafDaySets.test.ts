import type { ISODateString } from '../../../types/branded';
import {
  buildDatoSetInclusive,
  buildDatoSetInclusiveFromDates,
  buildFerieDageSet,
  buildShDageSet,
  buildShDageSetFromIsoRange,
  isWeekdayUtc,
  placeLoseFeriedage,
} from '../../../domain/erstatningsopgoerelse/engines/tafDaySets';
import { isoDateToDate } from '../../../domain/dates/isoDate';

const iso = (value: string): ISODateString => value as ISODateString;

// Kendte ugedage (UTC):
// 2024-01-01 = mandag
// 2024-01-06 = lørdag
// 2024-01-07 = søndag
// 2024-04-01 = mandag (efter påske/DST)

describe('isWeekdayUtc', () => {
  it('returnerer true for mandag (2024-01-01)', () => {
    expect(isWeekdayUtc(isoDateToDate(iso('2024-01-01')))).toBe(true);
  });

  it('returnerer true for fredag (2024-01-05)', () => {
    expect(isWeekdayUtc(isoDateToDate(iso('2024-01-05')))).toBe(true);
  });

  it('returnerer false for lørdag (2024-01-06)', () => {
    expect(isWeekdayUtc(isoDateToDate(iso('2024-01-06')))).toBe(false);
  });

  it('returnerer false for søndag (2024-01-07)', () => {
    expect(isWeekdayUtc(isoDateToDate(iso('2024-01-07')))).toBe(false);
  });

  it('håndterer søndag korrekt over DST-overgang (2024-03-31 = søndag)', () => {
    // 2024-03-31 er søndag OG DST-skift dag i Europa
    expect(isWeekdayUtc(isoDateToDate(iso('2024-03-31')))).toBe(false);
  });

  it('håndterer mandag korrekt over DST-overgang (2024-04-01 = mandag)', () => {
    expect(isWeekdayUtc(isoDateToDate(iso('2024-04-01')))).toBe(true);
  });
});

describe('buildDatoSetInclusiveFromDates', () => {
  it('inkluderer begge endepunkter (1 dag)', () => {
    const fra = isoDateToDate(iso('2024-01-15'));
    const til = isoDateToDate(iso('2024-01-15'));
    const set = buildDatoSetInclusiveFromDates(fra, til);
    expect(set.size).toBe(1);
    expect(set.has(iso('2024-01-15'))).toBe(true);
  });

  it('3 dage returnerer 3 elementer', () => {
    const fra = isoDateToDate(iso('2024-01-01'));
    const til = isoDateToDate(iso('2024-01-03'));
    const set = buildDatoSetInclusiveFromDates(fra, til);
    expect(set.size).toBe(3);
    expect(set.has(iso('2024-01-01'))).toBe(true);
    expect(set.has(iso('2024-01-02'))).toBe(true);
    expect(set.has(iso('2024-01-03'))).toBe(true);
  });

  it('januar 2024: 31 dage', () => {
    const fra = isoDateToDate(iso('2024-01-01'));
    const til = isoDateToDate(iso('2024-01-31'));
    const set = buildDatoSetInclusiveFromDates(fra, til);
    expect(set.size).toBe(31);
  });

  it('over månedsskift', () => {
    const fra = isoDateToDate(iso('2024-01-30'));
    const til = isoDateToDate(iso('2024-02-02'));
    const set = buildDatoSetInclusiveFromDates(fra, til);
    expect(set.size).toBe(4);
    expect(set.has(iso('2024-01-31'))).toBe(true);
    expect(set.has(iso('2024-02-01'))).toBe(true);
  });

  it('over DST-skift (2024-03-29 → 2024-04-01)', () => {
    const fra = isoDateToDate(iso('2024-03-29'));
    const til = isoDateToDate(iso('2024-04-01'));
    const set = buildDatoSetInclusiveFromDates(fra, til);
    expect(set.size).toBe(4);
    expect(set.has(iso('2024-03-31'))).toBe(true);
    expect(set.has(iso('2024-04-01'))).toBe(true);
  });

  it('over nytår', () => {
    const fra = isoDateToDate(iso('2023-12-30'));
    const til = isoDateToDate(iso('2024-01-02'));
    const set = buildDatoSetInclusiveFromDates(fra, til);
    expect(set.size).toBe(4);
    expect(set.has(iso('2023-12-31'))).toBe(true);
    expect(set.has(iso('2024-01-01'))).toBe(true);
  });

  it('kaster fejl når fraDate > tilDate', () => {
    const fra = isoDateToDate(iso('2024-01-31'));
    const til = isoDateToDate(iso('2024-01-01'));
    expect(() => buildDatoSetInclusiveFromDates(fra, til)).toThrow();
  });

  it('skudår: februar 2024 = 29 dage', () => {
    const fra = isoDateToDate(iso('2024-02-01'));
    const til = isoDateToDate(iso('2024-02-29'));
    const set = buildDatoSetInclusiveFromDates(fra, til);
    expect(set.size).toBe(29);
    expect(set.has(iso('2024-02-29'))).toBe(true);
  });

  it('ikke-skudår: februar 2023 = 28 dage', () => {
    const fra = isoDateToDate(iso('2023-02-01'));
    const til = isoDateToDate(iso('2023-02-28'));
    const set = buildDatoSetInclusiveFromDates(fra, til);
    expect(set.size).toBe(28);
    expect(set.has(iso('2023-02-29'))).toBe(false);
  });
});

describe('buildDatoSetInclusive', () => {
  it('giver samme resultat som buildDatoSetInclusiveFromDates for samme periode', () => {
    const fra = iso('2024-03-25');
    const til = iso('2024-04-05');
    const a = buildDatoSetInclusive(fra, til);
    const b = buildDatoSetInclusiveFromDates(isoDateToDate(fra), isoDateToDate(til));
    expect(a.size).toBe(b.size);
    for (const date of a) {
      expect(b.has(date)).toBe(true);
    }
  });
});

describe('buildFerieDageSet', () => {
  it('tom ferieperioder returnerer tomt sæt', () => {
    const datoSet = buildDatoSetInclusive(iso('2024-01-01'), iso('2024-01-07'));
    const result = buildFerieDageSet([], datoSet);
    expect(result.size).toBe(0);
  });

  it('feriedage der ikke er i datoSet medtages ikke', () => {
    const datoSet = buildDatoSetInclusive(iso('2024-01-01'), iso('2024-01-05'));
    // Ferieperiode udenfor datoSet
    const result = buildFerieDageSet(
      [{ fra: iso('2024-01-08'), til: iso('2024-01-12') }],
      datoSet
    );
    expect(result.size).toBe(0);
  });

  it('weekenddage i ferieperioden medtages ikke', () => {
    // 2024-01-06 = lørdag, 2024-01-07 = søndag
    const datoSet = buildDatoSetInclusive(iso('2024-01-01'), iso('2024-01-07'));
    const result = buildFerieDageSet(
      [{ fra: iso('2024-01-06'), til: iso('2024-01-07') }],
      datoSet
    );
    expect(result.size).toBe(0);
  });

  it('SH-dage i ferieperioden medtages ikke ved arbejdsdage', () => {
    const datoSet = buildDatoSetInclusive(iso('2023-12-30'), iso('2024-01-01'));
    const result = buildFerieDageSet(
      [{ fra: iso('2023-12-30'), til: iso('2024-01-01') }],
      datoSet
    );
    expect(result.size).toBe(0);
    expect(result.has(iso('2024-01-01'))).toBe(false);
  });

  it('weekenddage i ferieperioden medtages ved kalenderdage, men SH-dage gør ikke', () => {
    const datoSet = buildDatoSetInclusive(iso('2023-12-30'), iso('2024-01-01'));
    const result = buildFerieDageSet(
      [{ fra: iso('2023-12-30'), til: iso('2024-01-01') }],
      datoSet,
      { includeWeekends: true }
    );
    expect(result.size).toBe(2);
    expect(result.has(iso('2023-12-30'))).toBe(true);
    expect(result.has(iso('2023-12-31'))).toBe(true);
    expect(result.has(iso('2024-01-01'))).toBe(false);
  });

  it('weekendhelligdag medtages fortsat ved kalenderdage', () => {
    const datoSet = buildDatoSetInclusive(iso('2021-12-25'), iso('2021-12-25'));
    const result = buildFerieDageSet(
      [{ fra: iso('2021-12-25'), til: iso('2021-12-25') }],
      datoSet,
      { includeWeekends: true }
    );
    expect(result.size).toBe(1);
    expect(result.has(iso('2021-12-25'))).toBe(true);
  });

  it('hverdage i ferieperioden medtages', () => {
    // 2024-01-01 = mandag (og helligdag, men buildFerieDageSet tjekker ikke helligdage)
    // 2024-01-02 = tirsdag, 2024-01-03 = onsdag
    const datoSet = buildDatoSetInclusive(iso('2024-01-01'), iso('2024-01-05'));
    const result = buildFerieDageSet(
      [{ fra: iso('2024-01-02'), til: iso('2024-01-03') }],
      datoSet
    );
    expect(result.size).toBe(2);
    expect(result.has(iso('2024-01-02'))).toBe(true);
    expect(result.has(iso('2024-01-03'))).toBe(true);
  });

  it('overlappende ferieperioder tæller ikke dobbelt', () => {
    const datoSet = buildDatoSetInclusive(iso('2024-01-01'), iso('2024-01-05'));
    // Begge perioder dækker 2024-01-02 (tirsdag)
    const result = buildFerieDageSet(
      [
        { fra: iso('2024-01-02'), til: iso('2024-01-02') },
        { fra: iso('2024-01-02'), til: iso('2024-01-03') },
      ],
      datoSet
    );
    // 2024-01-02 er tirsdag, 2024-01-03 er onsdag — begge hverdage
    expect(result.size).toBe(2);
  });

  it('ignorerer periode hvor fra > til', () => {
    const datoSet = buildDatoSetInclusive(iso('2024-01-01'), iso('2024-01-05'));
    const result = buildFerieDageSet(
      [{ fra: iso('2024-01-05'), til: iso('2024-01-02') }],
      datoSet
    );
    expect(result.size).toBe(0);
  });

  it('ignorerer periode med manglende fra/til', () => {
    const datoSet = buildDatoSetInclusive(iso('2024-01-01'), iso('2024-01-05'));
    const result = buildFerieDageSet(
      [{ fra: undefined, til: iso('2024-01-03') }, { fra: iso('2024-01-01'), til: undefined }],
      datoSet
    );
    expect(result.size).toBe(0);
  });

  it('over DST-skift: hverdage tælles korrekt', () => {
    // 2024-03-29 fredag, 2024-03-31 søndag (DST-skift), 2024-04-01 mandag
    const datoSet = buildDatoSetInclusive(iso('2024-03-28'), iso('2024-04-05'));
    const result = buildFerieDageSet(
      [{ fra: iso('2024-03-29'), til: iso('2024-04-01') }],
      datoSet
    );
    // 29/3 = langfredag (SH) ✗, 30/3 = lørdag ✗, 31/3 = søndag ✗, 01/4 = 2. påskedag (SH) ✗
    expect(result.size).toBe(0);
    expect(result.has(iso('2024-03-29'))).toBe(false);
    expect(result.has(iso('2024-04-01'))).toBe(false);
  });
});

describe('buildShDageSet', () => {
  it('returnerer tomt sæt for tom datoSet', () => {
    const fraDate = isoDateToDate(iso('2024-01-01'));
    const tilDate = isoDateToDate(iso('2024-01-31'));
    const emptySet = new Set<ISODateString>();
    const result = buildShDageSet(fraDate, tilDate, emptySet);
    expect(result.size).toBe(0);
  });

  it('nytårsdag 2024-01-01 er mandag → SH-dag', () => {
    const fraDate = isoDateToDate(iso('2024-01-01'));
    const tilDate = isoDateToDate(iso('2024-01-01'));
    const datoSet = buildDatoSetInclusive(iso('2024-01-01'), iso('2024-01-01'));
    const result = buildShDageSet(fraDate, tilDate, datoSet);
    expect(result.has(iso('2024-01-01'))).toBe(true);
  });

  it('helligdag der falder på weekend er ikke SH-dag', () => {
    // Juledag 2022-12-25 er søndag
    const fraDate = isoDateToDate(iso('2022-12-25'));
    const tilDate = isoDateToDate(iso('2022-12-25'));
    const datoSet = buildDatoSetInclusive(iso('2022-12-25'), iso('2022-12-25'));
    const result = buildShDageSet(fraDate, tilDate, datoSet);
    expect(result.has(iso('2022-12-25'))).toBe(false);
  });

  it('helligdag der ikke er i datoSet medtages ikke', () => {
    // Nytårsdag 2024 er mandag, men vi giver kun datoSet med 2024-01-02
    const fraDate = isoDateToDate(iso('2024-01-01'));
    const tilDate = isoDateToDate(iso('2024-01-31'));
    const datoSet = buildDatoSetInclusive(iso('2024-01-02'), iso('2024-01-31'));
    const result = buildShDageSet(fraDate, tilDate, datoSet);
    expect(result.has(iso('2024-01-01'))).toBe(false);
  });

  it('Store Bededag 2023: er helligdag (år <= 2023)', () => {
    // Store Bededag 2023 = 5. maj 2023 (fredag)
    const fraDate = isoDateToDate(iso('2023-05-05'));
    const tilDate = isoDateToDate(iso('2023-05-05'));
    const datoSet = buildDatoSetInclusive(iso('2023-05-05'), iso('2023-05-05'));
    const result = buildShDageSet(fraDate, tilDate, datoSet);
    expect(result.has(iso('2023-05-05'))).toBe(true);
  });

  it('Store Bededag 2024: er IKKE helligdag (år >= 2024)', () => {
    // Store Bededag 2024 ville have været 26. april 2024 (fredag) — men den er afskaffet
    const fraDate = isoDateToDate(iso('2024-04-26'));
    const tilDate = isoDateToDate(iso('2024-04-26'));
    const datoSet = buildDatoSetInclusive(iso('2024-04-26'), iso('2024-04-26'));
    const result = buildShDageSet(fraDate, tilDate, datoSet);
    expect(result.has(iso('2024-04-26'))).toBe(false);
  });

  it('januar 2024 har præcis 1 SH-dag (nytårsdag, mandag)', () => {
    const fraDate = isoDateToDate(iso('2024-01-01'));
    const tilDate = isoDateToDate(iso('2024-01-31'));
    const datoSet = buildDatoSetInclusive(iso('2024-01-01'), iso('2024-01-31'));
    const result = buildShDageSet(fraDate, tilDate, datoSet);
    expect(result.size).toBe(1);
    expect(result.has(iso('2024-01-01'))).toBe(true);
  });

  it('over DST-skift (marts→april 2024) finder påske-SH-dage', () => {
    // Påske 2024: langfredag 29/3, påskedag 31/3 (søndag = ikke SH), anden påskedag 01/4 (mandag)
    const fraDate = isoDateToDate(iso('2024-03-29'));
    const tilDate = isoDateToDate(iso('2024-04-05'));
    const datoSet = buildDatoSetInclusive(iso('2024-03-29'), iso('2024-04-05'));
    const result = buildShDageSet(fraDate, tilDate, datoSet);
    // Langfredag 29/3 = fredag ✓, Skærtorsdag 28/3 (uden for range) ✗
    // Påskedag 31/3 = søndag ✗, Anden påskedag 01/4 = mandag ✓
    expect(result.has(iso('2024-03-29'))).toBe(true); // Langfredag
    expect(result.has(iso('2024-04-01'))).toBe(true); // Anden påskedag
  });

  it('håndterer range der spænder over to kalenderår', () => {
    const fraDate = isoDateToDate(iso('2023-12-25'));
    const tilDate = isoDateToDate(iso('2024-01-01'));
    const datoSet = buildDatoSetInclusive(iso('2023-12-25'), iso('2024-01-01'));
    const result = buildShDageSet(fraDate, tilDate, datoSet);
    // 2023-12-25 = mandag (juledag) ✓
    // 2023-12-26 = tirsdag (anden juledag) ✓
    // 2024-01-01 = mandag (nytårsdag) ✓
    expect(result.has(iso('2023-12-25'))).toBe(true);
    expect(result.has(iso('2023-12-26'))).toBe(true);
    expect(result.has(iso('2024-01-01'))).toBe(true);
  });
});

describe('buildShDageSetFromIsoRange', () => {
  it('giver samme resultat som buildShDageSet med tilsvarende datoSet', () => {
    const fra = iso('2024-01-01');
    const til = iso('2024-12-31');
    const result = buildShDageSetFromIsoRange(fra, til);

    const fraDate = isoDateToDate(fra);
    const tilDate = isoDateToDate(til);
    const datoSet = buildDatoSetInclusiveFromDates(fraDate, tilDate);
    const expected = buildShDageSet(fraDate, tilDate, datoSet);

    expect(result.size).toBe(expected.size);
    for (const date of result) {
      expect(expected.has(date)).toBe(true);
    }
  });

  it('returnerer tomt sæt når fra > til', () => {
    const result = buildShDageSetFromIsoRange(iso('2024-12-31'), iso('2024-01-01'));
    expect(result.size).toBe(0);
  });
});

describe('placeLoseFeriedage', () => {
  it('returnerer tomt sæt ved count = 0', () => {
    const result = placeLoseFeriedage(iso('2024-01-01'), iso('2024-01-05'), 0, new Set());
    expect(result.size).toBe(0);
  });

  it('returnerer tomt sæt når fra > til', () => {
    const result = placeLoseFeriedage(iso('2024-01-05'), iso('2024-01-01'), 3, new Set());
    expect(result.size).toBe(0);
  });

  it('placerer feriedage på de første hverdage', () => {
    // 2024-01-01 = mandag, 2024-01-02 = tirsdag, 2024-01-03 = onsdag
    const result = placeLoseFeriedage(iso('2024-01-01'), iso('2024-01-05'), 2, new Set());
    expect(result.size).toBe(2);
    expect(result.has(iso('2024-01-01'))).toBe(true);
    expect(result.has(iso('2024-01-02'))).toBe(true);
  });

  it('springer blokerede dage over', () => {
    // 2024-01-01 = mandag: blokeret. Næste: 2024-01-02 = tirsdag
    const blocked = new Set<ISODateString>([iso('2024-01-01')]);
    const result = placeLoseFeriedage(iso('2024-01-01'), iso('2024-01-05'), 1, blocked);
    expect(result.size).toBe(1);
    expect(result.has(iso('2024-01-02'))).toBe(true);
  });

  it('springer weekenddage over automatisk', () => {
    // 2024-01-06 = lørdag, 2024-01-07 = søndag → næste hverdag = 2024-01-08 (mandag)
    const result = placeLoseFeriedage(iso('2024-01-06'), iso('2024-01-12'), 1, new Set());
    expect(result.size).toBe(1);
    expect(result.has(iso('2024-01-08'))).toBe(true);
  });

  it('clamper negative count til 0 (toNonNegativeInt)', () => {
    const result = placeLoseFeriedage(iso('2024-01-01'), iso('2024-01-05'), -5, new Set());
    expect(result.size).toBe(0);
  });

  it('placerer ikke flere end tilgængelige hverdage', () => {
    // 2024-01-01 er mandag — kun 5 hverdage i ugen (01-05). Vi beder om 10.
    const result = placeLoseFeriedage(iso('2024-01-01'), iso('2024-01-05'), 10, new Set());
    // Kun 5 hverdage i perioden (men 01-01 er nytårsdag, ikke blokeret af buildShDageSet)
    expect(result.size).toBe(5);
  });

  it('over DST-skift: placeringsfinder korrekte hverdage', () => {
    // 2024-03-29 = fredag, 2024-03-30 = lørdag, 2024-03-31 = søndag (DST-skift), 2024-04-01 = mandag
    const result = placeLoseFeriedage(iso('2024-03-29'), iso('2024-04-05'), 2, new Set());
    expect(result.size).toBe(2);
    expect(result.has(iso('2024-03-29'))).toBe(true); // fredag
    expect(result.has(iso('2024-04-01'))).toBe(true); // mandag (spring weekend + DST)
  });

  it('tæller korrekt over månedsskift', () => {
    // 2024-01-29 = mandag, 2024-01-30 = tirsdag, 2024-01-31 = onsdag, 2024-02-01 = torsdag
    const result = placeLoseFeriedage(iso('2024-01-29'), iso('2024-02-02'), 4, new Set());
    expect(result.size).toBe(4);
    expect(result.has(iso('2024-01-29'))).toBe(true);
    expect(result.has(iso('2024-02-01'))).toBe(true);
  });

  it('NaN count behandles som 0 (toNonNegativeInt)', () => {
    const result = placeLoseFeriedage(iso('2024-01-01'), iso('2024-01-05'), NaN, new Set());
    expect(result.size).toBe(0);
  });

  it('Infinity count behandles som 0 (toNonNegativeInt)', () => {
    // toNonNegativeInt kræver Number.isFinite → Infinity giver 0
    const result = placeLoseFeriedage(iso('2024-01-01'), iso('2024-01-03'), Infinity, new Set());
    expect(result.size).toBe(0);
  });
});
