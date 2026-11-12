import { computeEetDifferencekravCalculation } from '../../../domain/erhvervsevnetab/eetCalculationGraph';
import { ERHVERVSEVNETAB_INITIAL_VALUES } from '../../../domain/erhvervsevnetab/erhvervsevnetabInitialValues';
import { fromKroner, toKroner } from '../../../domain/money/money';
import { toISODateString } from '../../../types/branded';

// Uafhængige grænser: født 01-07-1955, folkepension 01-07-2022 og 2-årsgrænse
// 01-07-2020. Særfaktoren for skaden 01-04-2019 er 1,245 i de berørte år.
const calculate = (beregningsdato: string, afgoerelsesdato = '2019-06-01', gammelSkade = false) => {
  const result = computeEetDifferencekravCalculation({
    erhvervsevnetab: {
      ...ERHVERVSEVNETAB_INITIAL_VALUES,
      koen: 'Mand',
      beregningsdato: toISODateString(beregningsdato),
      aslAarsloen: { kind: 'number', value: gammelSkade ? 387000 : 401000 },
      aslAfgoerelser: [{
        id: 'endelig',
        fsTilbageholdtEet: 'Nej',
        afgoerelsesDato: toISODateString(afgoerelsesdato),
        virkningsDato: toISODateString(afgoerelsesdato),
        eetPct: 60,
        afgoerelseType: 'Endelig',
      }],
    },
    skadedato: toISODateString(gammelSkade ? '2005-04-01' : '2019-04-01'),
    skadelidteFodselsdato: toISODateString('1955-07-01'),
    endeligEetGoerMidlertidigEndeligMedTilbagevirkendeKraft: false,
    indregnMerErstatningVedForhoejetPensionsalder: false,
  });
  expect(result.issues.filter((issue) => issue.severity === 'error')).toEqual([]);
  expect(result.hasBlockingErrors).toBe(false);
  if (!result.computation) throw new Error('Forventede et beregnet differencekrav');
  return result.computation;
};

describe('Differencekravets grænser ved to år til folkepension', () => {
  it('bruger tabelfaktor dagen før 2-årsgrænsen', () => {
    const c = calculate('2020-06-30');
    expect(c.resterendeLoebendeYdelser).toBeNull();
    expect(c.proformaKapitalisering).toMatchObject({
      kapitaliseretPgaUnderToAarTilFp: false,
      maanederTilFolkepension: null,
    });
    expect(c.proformaKapitalisering?.kapitaliseringsfaktor).toBeGreaterThan(1.245);
    expect(c.afgoerelser[0]?.fradragesTil).toBe(toISODateString('2020-06-29'));
  });

  it.each([
    ['2020-07-01', '2020-06-30', 24, 1.245],
    // 30 resterende julidage / 31 plus 23 hele måneder, afrundet til fire decimaler.
    ['2020-07-02', '2020-07-01', 23.9677, 1.243],
    ['2022-04-16', '2022-04-15', 2.5, 0.13],
    ['2022-06-30', '2022-06-29', 0.0333, 0.002],
  ])('deler fradraget uden hul eller overlap ved beregning %s', (dato, sidsteLoebendeDag, maaneder, faktor) => {
    const c = calculate(dato);
    expect(c.fradragKapitaliseretEetOre).toBe(fromKroner(0));
    expect(c.resterendeLoebendeYdelser).toBeNull();
    expect(c.afgoerelser[0]?.fradragesTil).toBe(toISODateString(sidsteLoebendeDag));
    expect(c.proformaKapitalisering).toMatchObject({
      kapitaliseringsdato: toISODateString(dato),
      loebendeEetPct: 60,
      kapitaliseretPgaUnderToAarTilFp: true,
      saerfaktor: 1.245,
      maanederTilFolkepension: maaneder,
      kapitaliseringsfaktor: faktor,
    });
    const pk = c.proformaKapitalisering;
    if (!pk) throw new Error('Forventede proformakapitalisering');
    expect(pk.proformaBeloebOre).toBe(fromKroner(Math.ceil(toKroner(pk.aarsydelseOre) * faktor)));
    if (dato.startsWith('2022')) {
      expect(pk.aarsydelseOre).toBe(fromKroner(194397.06));
    }
  });

  it.each(['2022-07-01', '2022-07-02', '2022-12-01'])('stopper tidligere tilkendte løbende ydelser før folkepension ved beregning %s', (dato) => {
    const c = calculate(dato);
    const vedFolkepension = calculate('2022-07-01');
    expect(c.proformaKapitalisering).toBeNull();
    expect(c.resterendeLoebendeYdelser).toBeNull();
    expect(c.fradragKapitaliseretEetOre).toBe(fromKroner(0));
    expect(c.afgoerelser[0]?.fradragesTil).toBe(toISODateString('2022-06-30'));
    expect(c.fradragLoebendeYdelserOre).toBe(vedFolkepension.fradragLoebendeYdelserOre);
    // 7 × 15.314 + 12 × 15.648 + 12 × 16.013 + 6 × 16.200 kr.
    expect(c.fradragLoebendeYdelserOre).toBe(fromKroner(584330));
  });

  it.each(['2020-07-01', '2022-07-01', '2022-07-02'])('fratrækker fuld 2-årskapitalværdi ved ny endelig afgørelse %s', (afgoerelsesdato) => {
    const c = calculate('2022-12-01', afgoerelsesdato);
    const kap = c.kapComputation?.afgoerelser[0];
    expect(kap).toMatchObject({
      kapitaliseringsdato: toISODateString(afgoerelsesdato),
      kapitaliseringspct: 60,
      kapitaliseringsfaktor: 1.245,
      kapitaliseretPgaUnderToAarTilFp: true,
    });
    if (!kap) throw new Error('Forventede fuld kapitalisering');
    expect(c.fradragKapitaliseretEetOre).toBe(fromKroner(Math.ceil(toKroner(kap.aarsydelseOre) * 1.245)));
    expect(c.fradragLoebendeYdelserOre).toBe(fromKroner(0));
    expect(c.proformaKapitalisering).toBeNull();
    expect(c.resterendeLoebendeYdelser).toBeNull();
    if (afgoerelsesdato.startsWith('2022')) {
      expect(c.fradragKapitaliseretEetOre).toBe(fromKroner(242025));
    }
  });

  it('bevarer resterende løbende ydelser for skade før 1. juli 2007', () => {
    const c = calculate('2022-04-01', '2019-06-01', true);
    expect(c.proformaKapitalisering).toBeNull();
    expect(c.fradragKapitaliseretEetOre).toBe(fromKroner(0));
    expect(c.afgoerelser[0]?.fradragesTil).toBe(toISODateString('2022-03-31'));
    expect(c.resterendeLoebendeYdelser).toMatchObject({
      beregningsdato: toISODateString('2022-04-01'),
      dagenFoerFolkepensionsdato: toISODateString('2022-06-30'),
      loebendeEetPct: 60,
      tilbageraevendeMaaneder: 3,
    });
    const rest = c.resterendeLoebendeYdelser;
    if (!rest) throw new Error('Forventede resterende løbende ydelser');
    expect(rest.fradragBeloebOre).toBe(fromKroner(3 * toKroner(rest.maanedligYdelseOre)));
  });
});
