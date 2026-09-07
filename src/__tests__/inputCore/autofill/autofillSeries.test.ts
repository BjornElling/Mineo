import {
  applyDateAutofillStep,
  dateAutofillStepBetween,
  floorDivideMonthIndex,
  fromAbsoluteMonth,
  projectAbsoluteMonthSeries,
  projectConstantAmountSeries,
  projectDateSeries,
  projectMonthOfYearSeries,
  projectWeekSeries,
  projectYearSeries,
  toAbsoluteMonth,
} from '../../../inputCore/autofill/autofillSeries';
import { createDate, isoWeeksInYear } from '../../../utils/dateUtils';
import { toISODateString } from '../../../types/branded';

const iso = (value: string) => toISODateString(value);

describe('autofillSeries', () => {
  describe('dateAutofillStepBetween', () => {
    it('genkender et fast dagsinterval', () => {
      expect(dateAutofillStepBetween(createDate(2026, 0, 1), createDate(2026, 0, 8)))
        .toEqual({ kind: 'days', days: 7 });
      expect(dateAutofillStepBetween(createDate(2026, 0, 1), createDate(2026, 0, 15)))
        .toEqual({ kind: 'days', days: 14 });
      expect(dateAutofillStepBetween(createDate(2026, 0, 1), createDate(2026, 0, 29)))
        .toEqual({ kind: 'days', days: 28 });
    });

    it('genkender samme dag i næste måned frem for dagsafstanden', () => {
      expect(dateAutofillStepBetween(createDate(2026, 0, 1), createDate(2026, 1, 1)))
        .toEqual({ kind: 'monthsSameDay', months: 1 });
    });

    it('genkender sidste dag i måneden, også når dagstallet skifter', () => {
      // 31-01 → 28-02 er 28 dage, men mønstret er «sidste dag i næste måned».
      expect(dateAutofillStepBetween(createDate(2026, 0, 31), createDate(2026, 1, 28)))
        .toEqual({ kind: 'monthsLastDay', months: 1 });
    });

    it('giver samme dag i måneden, når ingen af datoerne er månedens sidste dag', () => {
      // 15-01 → 15-02: hverken sidste dag; samme dagstal vinder.
      expect(dateAutofillStepBetween(createDate(2026, 0, 15), createDate(2026, 1, 15)))
        .toEqual({ kind: 'monthsSameDay', months: 1 });
    });

    it('lader sidste-dag-formen vinde over samme-dag-formen, hvor de PEGER forskelligt', () => {
      // 30-04 → 30-06: begge er månedens sidste dag OG har samme dagstal. Forrangen er derfor målbar:
      // sidste-dag-formen fortsætter til 31-08, samme-dag-formen ville give 30-08.
      expect(dateAutofillStepBetween(createDate(2026, 3, 30), createDate(2026, 5, 30)))
        .toEqual({ kind: 'monthsLastDay', months: 2 });
      expect(projectDateSeries([iso('2026-04-30'), iso('2026-06-30')])).toBe('2026-08-31');
    });

    it('giver et nulskridt for to identiske datoer', () => {
      expect(dateAutofillStepBetween(createDate(2026, 4, 4), createDate(2026, 4, 4)))
        .toEqual({ kind: 'days', days: 0 });
    });

    it('afviser en afstand over dagsloftet', () => {
      expect(dateAutofillStepBetween(createDate(2020, 0, 1), createDate(2026, 0, 1))).toBeNull();
    });
  });

  describe('applyDateAutofillStep', () => {
    it('lader sidste-dag-mønstret vokse til målmånedens længde', () => {
      const next = applyDateAutofillStep(createDate(2026, 1, 28), { kind: 'monthsLastDay', months: 1 });
      expect(next.getUTCFullYear()).toBe(2026);
      expect(next.getUTCMonth()).toBe(2);
      expect(next.getUTCDate()).toBe(31);
    });

    it('clamper samme-dag-mønstret til målmånedens længde', () => {
      const next = applyDateAutofillStep(createDate(2026, 0, 30), { kind: 'monthsSameDay', months: 1 });
      expect(next.getUTCMonth()).toBe(1);
      expect(next.getUTCDate()).toBe(28);
    });

    it('krydser årsskiftet for både dags- og månedsskridt', () => {
      const byDays = applyDateAutofillStep(createDate(2025, 11, 28), { kind: 'days', days: 7 });
      expect(byDays.getUTCFullYear()).toBe(2026);
      expect(byDays.getUTCMonth()).toBe(0);
      expect(byDays.getUTCDate()).toBe(4);

      const byMonths = applyDateAutofillStep(createDate(2025, 11, 1), { kind: 'monthsSameDay', months: 1 });
      expect(byMonths.getUTCFullYear()).toBe(2026);
      expect(byMonths.getUTCMonth()).toBe(0);
      expect(byMonths.getUTCDate()).toBe(1);
    });
  });

  describe('projectDateSeries', () => {
    it('kræver mindst to prøver', () => {
      expect(projectDateSeries([iso('2026-01-01')])).toBeNull();
      expect(projectDateSeries([])).toBeNull();
    });

    it('fortsætter et ugeinterval', () => {
      expect(projectDateSeries([iso('2026-01-01'), iso('2026-01-08')])).toBe('2026-01-15');
    });

    it('fortsætter et fire-ugers interval', () => {
      expect(projectDateSeries([iso('2026-01-05'), iso('2026-02-02')])).toBe('2026-03-02');
    });

    it('fortsætter et månedsinterval hen over årsskiftet', () => {
      expect(projectDateSeries([iso('2025-11-01'), iso('2025-12-01')])).toBe('2026-01-01');
    });

    it('fortsætter sidste-dag-i-måneden hen over februar', () => {
      expect(projectDateSeries([iso('2026-01-31'), iso('2026-02-28')])).toBe('2026-03-31');
    });

    it('lader det HYPPIGSTE skridt vinde over et enkelt hul i serien', () => {
      // Månedsserie med juli udeladt: skridtene er +1, +1, +1, +1, +1, +2, +1, +1, +1.
      const months = [
        '2026-01-01', '2026-02-01', '2026-03-01', '2026-04-01', '2026-05-01', '2026-06-01',
        '2026-08-01', '2026-09-01', '2026-10-01', '2026-11-01',
      ].map(iso);
      expect(projectDateSeries(months)).toBe('2026-12-01');
    });

    it('lader det seneste skridt afgøre en uafgjort hyppighed', () => {
      // Ét ugeskridt og ét månedsskridt: det seneste (måned) vinder.
      expect(projectDateSeries([iso('2026-01-01'), iso('2026-01-08'), iso('2026-02-08')]))
        .toBe('2026-03-08');
    });

    it('gentager samme dato, når serien står stille', () => {
      expect(projectDateSeries([iso('2026-03-03'), iso('2026-03-03')])).toBe('2026-03-03');
    });

    it('giver intet forslag, når mønstret ville løbe uden for det repræsenterbare domæne', () => {
      expect(projectDateSeries([iso('2100-11-01'), iso('2100-12-01')])).toBeNull();
    });
  });

  describe('projectWeekSeries', () => {
    it('fortsætter til næste uge hen over årsskiftet', () => {
      // 2025 har 52 ISO-uger; uge 52/2025 → uge 01/2026.
      expect(projectWeekSeries([{ week: 51, year: 2025 }, { week: 52, year: 2025 }]))
        .toEqual({ week: 1, year: 2026 });
    });

    it('respekterer et 53-ugers år ved årsskiftet', () => {
      // 2020 har 53 ISO-uger; uge 52/2020 → uge 53/2020 → uge 01/2021.
      expect(projectWeekSeries([{ week: 51, year: 2020 }, { week: 52, year: 2020 }]))
        .toEqual({ week: 53, year: 2020 });
      expect(projectWeekSeries([{ week: 52, year: 2020 }, { week: 53, year: 2020 }]))
        .toEqual({ week: 1, year: 2021 });
    });

    it('fortsætter et to-ugers interval', () => {
      expect(projectWeekSeries([{ week: 1, year: 2026 }, { week: 3, year: 2026 }]))
        .toEqual({ week: 5, year: 2026 });
    });

    it('fortsætter et fire-ugers interval', () => {
      expect(projectWeekSeries([{ week: 5, year: 2026 }, { week: 9, year: 2026 }]))
        .toEqual({ week: 13, year: 2026 });
    });

    it('kræver mindst to prøver', () => {
      expect(projectWeekSeries([{ week: 5, year: 2026 }])).toBeNull();
    });
  });

  describe('måned og år', () => {
    it('oversætter frem og tilbage mellem par og absolut månedsindeks', () => {
      expect(toAbsoluteMonth(2025, 12)).toBe(2025 * 12 + 11);
      expect(fromAbsoluteMonth(toAbsoluteMonth(2025, 12))).toEqual({ year: 2025, month: 12 });
      expect(fromAbsoluteMonth(toAbsoluteMonth(2026, 1))).toEqual({ year: 2026, month: 1 });
    });

    it('lader årstallet vokse, når måneden wrapper', () => {
      const next = projectAbsoluteMonthSeries([toAbsoluteMonth(2025, 11), toAbsoluteMonth(2025, 12)]);
      expect(next).not.toBeNull();
      expect(fromAbsoluteMonth(next ?? 0)).toEqual({ year: 2026, month: 1 });
    });

    it('foreslår december efter januar-juni og august-november', () => {
      const pairs = [1, 2, 3, 4, 5, 6, 8, 9, 10, 11].map((month) => toAbsoluteMonth(2026, month));
      const next = projectAbsoluteMonthSeries(pairs);
      expect(fromAbsoluteMonth(next ?? 0)).toEqual({ year: 2026, month: 12 });
    });

    it('wrapper månedsserien uden årskolonne', () => {
      expect(projectMonthOfYearSeries([11, 12])).toBe(1);
      expect(projectMonthOfYearSeries([12, 1])).toBe(2);
      expect(projectMonthOfYearSeries([4, 4])).toBe(4);
      expect(projectMonthOfYearSeries([13, 14])).toBeNull();
    });

    it('fortsætter en ren årsserie lineært', () => {
      expect(projectYearSeries([2024, 2025])).toBe(2026);
      expect(projectYearSeries([2025, 2025])).toBe(2025);
      expect(projectYearSeries([2099, 2100])).toBeNull();
    });
  });

  describe('projectConstantAmountSeries', () => {
    it('gentager beløbet, når de to seneste prøver er ens', () => {
      expect(projectConstantAmountSeries([30000, 30000])).toBe(30000);
      expect(projectConstantAmountSeries([30000, 31000, 31000])).toBe(31000);
      expect(projectConstantAmountSeries([0, 0])).toBe(0);
      expect(projectConstantAmountSeries([-1500.5, -1500.5])).toBe(-1500.5);
    });

    it('foreslår ALDRIG en tilvækst', () => {
      expect(projectConstantAmountSeries([30000, 31000])).toBeNull();
      expect(projectConstantAmountSeries([1000, 2000, 3000])).toBeNull();
    });

    it('kræver mindst to prøver', () => {
      expect(projectConstantAmountSeries([30000])).toBeNull();
      expect(projectConstantAmountSeries([])).toBeNull();
    });
  });
  describe('hul i serien mod ægte kadence (skridt-tiebreak)', () => {
    it('lader basisskridtet vinde, når et hul giver uafgjort hyppighed', () => {
      // januar, februar, april: skridtene er +1 og +2, ét af hver. +2 ER +1 med et hul, så mønstret
      // er +1, og næste værdi er maj – ikke juni.
      expect(projectDateSeries([iso('2026-01-01'), iso('2026-02-01'), iso('2026-04-01')]))
        .toBe('2026-05-01');
      expect(projectMonthOfYearSeries([1, 2, 4])).toBe(5);
      expect(projectWeekSeries([{ week: 1, year: 2026 }, { week: 2, year: 2026 }, { week: 4, year: 2026 }]))
        .toEqual({ week: 5, year: 2026 });
    });

    it('lader en ÆGTE kadence med flertal stå, selv om den er et multiplum af et enkelt andet skridt', () => {
      // Kvartaler (+3, +3) og ét enkelt +1: basisskridt-reglen er KUN en tiebreak, så +3 vinder på
      // hyppighed. Anvendt på den SIDSTE prøve (01-08) giver det 01-11; havde +1 vundet, ville
      // forslaget være 01-09.
      expect(projectDateSeries([
        iso('2026-01-01'), iso('2026-04-01'), iso('2026-07-01'), iso('2026-08-01'),
      ])).toBe('2026-11-01');
    });

    it('falder tilbage til det seneste skridt, når de uafgjorte er af forskellig ART', () => {
      // Et dagsskridt og et månedsskridt kan ikke være basisskridt for hinanden; det seneste vinder.
      expect(projectDateSeries([iso('2026-01-01'), iso('2026-01-08'), iso('2026-02-08')]))
        .toBe('2026-03-08');
    });
  });

  describe('faldende serier', () => {
    it('fremskriver nedad, når rækkerne er sorteret faldende', () => {
      expect(projectDateSeries([iso('2026-03-01'), iso('2026-02-01')])).toBe('2026-01-01');
      expect(projectWeekSeries([{ week: 3, year: 2026 }, { week: 2, year: 2026 }]))
        .toEqual({ week: 1, year: 2026 });
      const descending = projectAbsoluteMonthSeries([toAbsoluteMonth(2026, 2), toAbsoluteMonth(2026, 1)]);
      expect(fromAbsoluteMonth(descending ?? 0)).toEqual({ year: 2025, month: 12 });
    });
  });

  describe('sommertidsskifte', () => {
    it('regner et ugeinterval hen over begge danske sommertidsskifter', () => {
      // Marts (start) og oktober (slut). Aritmetikken er UTC-dage, så skiftet må ikke flytte en dag.
      expect(projectDateSeries([iso('2026-03-22'), iso('2026-03-29')])).toBe('2026-04-05');
      expect(projectDateSeries([iso('2026-10-18'), iso('2026-10-25')])).toBe('2026-11-01');
    });
  });

  describe('urepræsenterbare og ugyldige tal', () => {
    it('giver intet ugeforslag uden for det repræsenterbare årsdomæne eller over skridtloftet', () => {
      const lastWeekOf2100 = isoWeeksInYear(2100);
      expect(projectWeekSeries([
        { week: lastWeekOf2100 - 1, year: 2100 },
        { week: lastWeekOf2100, year: 2100 },
      ])).toBeNull();
      // Godt to år mellem to prøver er ikke et ugemønster.
      expect(projectWeekSeries([{ week: 1, year: 2026 }, { week: 1, year: 2028 }])).toBeNull();
    });

    it('springer ikke-heltallige prøver over frem for at forplante dem', () => {
      expect(projectMonthOfYearSeries([Number.NaN, 1, 2])).toBe(3);
      expect(projectYearSeries([Number.NaN, 2025, 2026])).toBe(2027);
      expect(projectMonthOfYearSeries([Number.NaN, Number.NaN])).toBeNull();
      expect(projectYearSeries([Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY])).toBeNull();
    });

    it('afviser et beløb, der ikke kan repræsenteres canonical', () => {
      expect(projectConstantAmountSeries([Number.NaN, Number.NaN])).toBeNull();
      expect(projectConstantAmountSeries([Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY])).toBeNull();
      expect(projectConstantAmountSeries([1e20, 1e20])).toBeNull();
      // Tre decimaler kan ikke være et canonical beløb (præcision 2).
      expect(projectConstantAmountSeries([0.001, 0.001])).toBeNull();
    });
  });

  describe('floorDivideMonthIndex', () => {
    it('etagedeler også negative månedsindeks korrekt', () => {
      expect(floorDivideMonthIndex(0)).toBe(0);
      expect(floorDivideMonthIndex(11)).toBe(0);
      expect(floorDivideMonthIndex(12)).toBe(1);
      expect(floorDivideMonthIndex(-1)).toBe(-1);
      expect(floorDivideMonthIndex(-12)).toBe(-1);
      expect(floorDivideMonthIndex(-13)).toBe(-2);
      expect(fromAbsoluteMonth(-1)).toEqual({ year: -1, month: 12 });
    });
  });
});
