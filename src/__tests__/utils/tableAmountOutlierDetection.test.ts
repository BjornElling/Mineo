import { findAmountOutliers } from '../../utils/tableAmountOutlierDetection';

// BB-297 (udviklerafgørelse 2026-10-19): kun «ti gange større», sammenlignet med medianen af gruppens øvrige rækker.

const maaneder = (antal: number, beloeb: number, group = 'g') =>
  Array.from({ length: antal }, (_, index) => ({ id: `m${index}`, group, value: beloeb }));

describe('findAmountOutliers', () => {
  it('flager et nul for meget, men ikke en bonus på det dobbelte', () => {
    const outliers = findAmountOutliers([
      ...maaneder(11, 30_000),
      { id: 'tastefejl', group: 'g', value: 3_000_000 },
      { id: 'bonus', group: 'g', value: 60_000 },
    ]);

    expect([...outliers]).toEqual(['tastefejl']);
  });

  it('flager en række lige over ti gange medianen, men ikke præcis ti gange', () => {
    expect(findAmountOutliers([...maaneder(3, 1_000), { id: 'x', group: 'g', value: 10_001 }]).has('x')).toBe(true);
    expect(findAmountOutliers([...maaneder(3, 1_000), { id: 'x', group: 'g', value: 10_000 }]).has('x')).toBe(false);
  });

  it('vurderer ikke uden mindst tre andre rækker i samme gruppe', () => {
    expect(findAmountOutliers([...maaneder(2, 30_000), { id: 'x', group: 'g', value: 3_000_000 }]).size).toBe(0);
    // Andre grupper tæller ikke med.
    expect(findAmountOutliers([
      ...maaneder(2, 30_000),
      ...maaneder(5, 30_000, 'anden').map((row) => ({ ...row, id: `a-${row.id}` })),
      { id: 'x', group: 'g', value: 3_000_000 },
    ]).size).toBe(0);
  });

  it('sammenligner kun inden for gruppen – en lav løn efter skaden gør ikke lønnen før skaden høj', () => {
    expect(findAmountOutliers([
      ...maaneder(6, 30_000, 'beregningsperiode'),
      ...maaneder(6, 2_000, 'erstatningsperiode').map((row) => ({ ...row, id: `e-${row.id}` })),
    ]).size).toBe(0);
  });

  it('ser bort fra rækker på 0 kr. og negative rækker – både som kandidat og som sammenligning', () => {
    const outliers = findAmountOutliers([
      ...maaneder(3, 30_000),
      ...maaneder(6, 0).map((row) => ({ ...row, id: `nul-${row.id}` })),
      { id: 'tilbagebetaling', group: 'g', value: -2_000 },
      { id: 'x', group: 'g', value: 400_000 },
    ]);

    expect([...outliers]).toEqual(['x']);
  });

  it('bruger medianen, så to høje rækker blandt mange normale ses hver for sig', () => {
    const outliers = findAmountOutliers([
      ...maaneder(10, 30_000),
      { id: 'a', group: 'g', value: 3_000_000 },
      { id: 'b', group: 'g', value: 3_000_000 },
    ]);

    expect([...outliers].sort()).toEqual(['a', 'b']);
  });
});
