import { erHeleKalendermaaneder } from '../../utils/periodeBeregning';

type Kalenderdato = readonly [år: number, måned: number, dag: number];

type Periode = Readonly<{
  start: Date;
  end: Date;
}>;

const utcDato = ([år, måned, dag]: Kalenderdato): Date => new Date(Date.UTC(år, måned - 1, dag));

const håndskrevetFacit = new Set(['2023-12', '2024-01', '2024-02', '2024-03']);

describe('erHeleKalendermaaneder – uafhængigt intervalfacit', () => {
  it('tæller fire unikke hele måneder ved årsskifte og overlappende perioder', () => {
    const perioder: readonly Periode[] = [
      { start: utcDato([2023, 12, 1]), end: utcDato([2024, 2, 29]) },
      { start: utcDato([2024, 2, 1]), end: utcDato([2024, 3, 31]) },
    ];

    // December, januar, februar og marts er de fire hele kalendermåneder.
    expect(erHeleKalendermaaneder(perioder)).toBe(håndskrevetFacit.size);
  });
});
