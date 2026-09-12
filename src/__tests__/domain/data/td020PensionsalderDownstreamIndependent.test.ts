import { computeMerErstatningPensionsalder } from '../../../domain/erhvervsevnetab/eetMerErstatningPensionsalderCalculation';
import type { EetIssue } from '../../../domain/erhvervsevnetab/eetTypes';
import { fromKroner } from '../../../domain/money/money';
import { toISODateString, type ISODateString } from '../../../types/branded';

const iso = (value: string): ISODateString => toISODateString(value);

const run = (kapitaliseringsdato: string, beregningsdato: string) => {
  const issues: EetIssue[] = [];
  const computation = computeMerErstatningPensionsalder(
    {
      kapitaliseringer: [
        {
          rowId: 'td020-pensionsalder',
          afgoerelsesdato: iso(kapitaliseringsdato),
          kapitaliseringsdato: iso(kapitaliseringsdato),
          kapitaliseringspct: 25,
          grundloenOre: fromKroner(251580),
          erstatningsniveauPct: 80,
          amBidragPct: 0,
        },
      ],
      beregningsdato: iso(beregningsdato),
      skadedato: iso('2004-01-01'),
      fodselsdato: iso('1974-02-28'),
      before2024Skade: true,
      koen: undefined,
    },
    issues,
  );

  expect(issues).toEqual([]);
  expect(computation).not.toBeNull();
  return computation!;
};

describe('DATA-001/TD-020 – forhøjet pensionsalder som downstream-facit', () => {
  it('fører 2020-hændelsen 68→69 gennem den faktiske downstream-beregning', () => {
    const computation = run('2019-12-31', '2021-01-01');
    expect(computation.events).toHaveLength(1);
    expect(computation.events[0]).toMatchObject({
      forhoejelsesdato: iso('2020-12-31'),
      satsAar: 2021,
      gammelAlderLabel: '68 år',
      nyAlderLabel: '69 år',
      gammel: {
        kapitaliseringsbekendtgoerelseLabel: expect.stringContaining('1700/2015'),
        folkepensionsalderLabel: '68 år',
      },
      ny: {
        kapitaliseringsbekendtgoerelseLabel: expect.stringContaining('9871/2020'),
        folkepensionsalderLabel: '69 år',
      },
    });
  });

  it('fører 2025-hændelsen 69→70 gennem den faktiske downstream-beregning', () => {
    const computation = run('2024-01-01', '2026-01-01');
    expect(computation.events).toHaveLength(1);
    expect(computation.events[0]).toMatchObject({
      forhoejelsesdato: iso('2025-12-31'),
      satsAar: 2026,
      gammelAlderLabel: '69 år',
      nyAlderLabel: '70 år',
      gammel: {
        kapitaliseringsbekendtgoerelseLabel: expect.stringContaining('10029/2024'),
        folkepensionsalderLabel: '69 år',
      },
      ny: {
        kapitaliseringsbekendtgoerelseLabel: expect.stringContaining('10183/2025'),
        folkepensionsalderLabel: '70 år',
      },
    });
  });
});
