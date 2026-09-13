import { erHeleKalendermaaneder } from '../../utils/periodeBeregning';

type Periode = Readonly<{
  start: Date;
  end: Date;
}>;

const utcDato = (år: number, måned: number, dag: number): Date =>
  new Date(Date.UTC(år, måned - 1, dag));

describe('erHeleKalendermaaneder – uafhængigt afvisningsfacit', () => {
  it('afviser februar 2024, når perioden slutter den 28. i skudåret', () => {
    const perioder: readonly Periode[] = [
      { start: utcDato(2024, 2, 1), end: utcDato(2024, 2, 28) },
    ];

    // Februar 2024 har 29 dage, så perioden er ikke en hel kalendermåned.
    expect(erHeleKalendermaaneder(perioder)).toBeNull();
  });
});
