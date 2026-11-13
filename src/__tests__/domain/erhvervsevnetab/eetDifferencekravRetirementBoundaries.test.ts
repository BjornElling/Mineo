import { computeEetDifferencekravCalculation } from '../../../domain/erhvervsevnetab/eetCalculationGraph';
import { ERHVERVSEVNETAB_INITIAL_VALUES } from '../../../domain/erhvervsevnetab/erhvervsevnetabInitialValues';
import { fromKroner, toKroner } from '../../../domain/money/money';
import { toISODateString } from '../../../types/branded';
import { computeEetLoebendeYdelser, resolveLoebendeOphoerVisning } from '../../../domain/erhvervsevnetab/eetLoebendeYdelserCalculation';

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
        kapDato: !gammelSkade && afgoerelsesdato >= '2020-07-01' ? toISODateString(afgoerelsesdato) : undefined,
        kapPct: !gammelSkade && afgoerelsesdato >= '2020-07-01' ? 60 : undefined,
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
  it.each(['2021-10-01', '2021-12-01', '2022-01-01'])('stopper endelig løbende ydelse to år før folkepension, også ved kapitalisering %s', (kapDato) => {
    const input = {
      erhvervsevnetab: {
        ...ERHVERVSEVNETAB_INITIAL_VALUES,
        beregningsdato: toISODateString('2022-04-01'),
        aslAarsloen: { kind: 'number' as const, value: 401000 },
        aslAfgoerelser: [{
          id: 'endelig',
          fsTilbageholdtEet: 'Nej' as const,
          afgoerelsesDato: toISODateString('2021-10-01'),
          virkningsDato: toISODateString('2019-06-01'),
          eetPct: 60,
          afgoerelseType: 'Endelig' as const,
          kapDato: toISODateString(kapDato),
          kapPct: 60,
        }],
      },
      skadedato: toISODateString('2019-04-01'),
      skadelidteFodselsdato: toISODateString('1955-07-01'),
    };
    const loebende = computeEetLoebendeYdelser(input);
    expect(loebende.issues.filter((issue) => issue.severity === 'error')).toEqual([]);
    const afgoerelse = loebende.computation?.afgoerelser[0];
    expect(afgoerelse?.ophoerDato).toBe('2020-06-30');
    // Tilbagevirkende ydelse efter 2021-satsen: 13 hele måneder × 16.013 kr.
    expect(afgoerelse?.iAltBeregnetEetOre).toBe(fromKroner(208169));
    const difference = computeEetDifferencekravCalculation({
      ...input,
      endeligEetGoerMidlertidigEndeligMedTilbagevirkendeKraft: false,
      indregnMerErstatningVedForhoejetPensionsalder: false,
    });
    expect(difference.computation?.fradragLoebendeYdelserOre).toBe(fromKroner(208169));
    expect(difference.computation?.afgoerelser[0]?.fradragesTil).toBe('2020-06-30');
  });

  it('giver ingen løbende ydelse ved virkning inden for toårsvinduet og senere kapitalisering', () => {
    const result = computeEetLoebendeYdelser({
      erhvervsevnetab: {
        ...ERHVERVSEVNETAB_INITIAL_VALUES,
        beregningsdato: toISODateString('2022-04-01'),
        aslAarsloen: { kind: 'number', value: 401000 },
        aslAfgoerelser: [{
          id: 'endelig', fsTilbageholdtEet: 'Nej',
          afgoerelsesDato: toISODateString('2021-10-01'),
          virkningsDato: toISODateString('2021-10-01'),
          eetPct: 60, afgoerelseType: 'Endelig',
          kapDato: toISODateString('2021-12-01'), kapPct: 60,
        }],
      },
      skadedato: toISODateString('2019-04-01'),
      skadelidteFodselsdato: toISODateString('1955-07-01'),
    });
    expect(result.issues.filter((issue) => issue.severity === 'error')).toEqual([]);
    const afgoerelse = result.computation?.afgoerelser[0];
    expect(afgoerelse?.perioder).toEqual([]);
    expect(afgoerelse?.iAltBeregnetEetOre).toBe(fromKroner(0));
    if (!afgoerelse) throw new Error('Forventede en afgørelse uden løbende ydelse');
    expect(resolveLoebendeOphoerVisning(afgoerelse).kind).toBe('ingen-periode');
  });

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

  // Udviklerafgørelse 2026-11-13: midlertidige ydelser, som en senere endelig afgørelse gør endelige,
  // behandles som endelige i hele perioden. Er den endelige afgørelse omfattet af toårsreglen, fratrækkes
  // de kun til dagen før toårsgrænsen (30-06-2020); kapitalbeløbet dækker de sidste to år.
  describe('midlertidige ydelser gjort endelige af en endelig afgørelse omfattet af toårsreglen', () => {
    const calculateMedMidlertidig = (skadedato: string, tilbagevirkende: boolean, endeligVirkningsdato = '2019-06-01') =>
      computeEetDifferencekravCalculation({
        erhvervsevnetab: {
          ...ERHVERVSEVNETAB_INITIAL_VALUES,
          beregningsdato: toISODateString('2022-04-01'),
          aslAarsloen: { kind: 'number', value: 401000 },
          aslAfgoerelser: [{
            id: 'midlertidig', fsTilbageholdtEet: 'Nej',
            afgoerelsesDato: toISODateString('2019-06-01'), eetPct: 60, afgoerelseType: 'Midlertidig',
          }, {
            id: 'endelig', fsTilbageholdtEet: 'Nej',
            afgoerelsesDato: toISODateString('2021-10-01'), virkningsDato: toISODateString(endeligVirkningsdato),
            eetPct: 60, afgoerelseType: 'Endelig', kapDato: toISODateString('2021-12-01'), kapPct: 60,
          }],
        },
        skadedato: toISODateString(skadedato),
        skadelidteFodselsdato: toISODateString('1955-07-01'),
        endeligEetGoerMidlertidigEndeligMedTilbagevirkendeKraft: tilbagevirkende,
        indregnMerErstatningVedForhoejetPensionsalder: false,
      });

    it('fratrækker den tilbagevirkende ydelse kun til dagen før toårsgrænsen', () => {
      const result = calculateMedMidlertidig('2019-04-01', true);
      expect(result.issues.filter((issue) => issue.severity === 'error')).toEqual([]);
      const midlertidig = result.computation?.afgoerelser.find((a) => a.rowId === 'midlertidig');
      // Fane 2 viser fortsat ydelsen til 31-10-2021 efter overlapreglen; kun fradraget afkortes.
      expect(midlertidig?.fradragesTil).toBe('2021-10-31');
      expect(midlertidig?.tilbagevirkendeKraftFradrag).toEqual({
        endeligVirkningsdato: '2019-06-01', fra: '2019-06-01', til: '2020-06-30', beloebOre: fromKroner(201086),
      });
      expect(result.computation?.fradragLoebendeYdelserOre).toBe(fromKroner(201086));
      expect(result.computation?.fradragKapitaliseretEetOre).toBeGreaterThan(0);
    });

    it('giver intet tilbagevirkende fradrag, når den endelige virkning ligger inden for toårsvinduet', () => {
      const result = calculateMedMidlertidig('2019-04-01', true, '2020-09-01');
      const midlertidig = result.computation?.afgoerelser.find((a) => a.rowId === 'midlertidig');
      expect(midlertidig?.tilbagevirkendeKraftFradrag).toBeNull();
      expect(result.computation?.fradragLoebendeYdelserOre).toBe(0);
    });

    it('fratrækker intet uden indstillingen', () => {
      expect(calculateMedMidlertidig('2019-04-01', false).computation?.fradragLoebendeYdelserOre).toBe(0);
    });

    it('afkorter også det altid foretagne fradrag ved skader før 16. juni 2011', () => {
      const result = calculateMedMidlertidig('2009-04-01', true);
      expect(result.issues.filter((issue) => issue.severity === 'error')).toEqual([]);
      const midlertidig = result.computation?.afgoerelser.find((a) => a.rowId === 'midlertidig');
      expect(midlertidig?.fradragForetages).toBe(true);
      expect(midlertidig?.fradragesTil).toBe('2020-06-30');
      expect(midlertidig?.beloebOre).toBe(fromKroner(261642));
      expect(midlertidig?.tilbagevirkendeKraftFradrag).toBeNull();
    });

    it('fratrækker ved skader før 16. juni 2011 den midlertidige ydelse frem til en endelig virkning i vinduet', () => {
      const result = calculateMedMidlertidig('2009-04-01', false, '2020-09-01');
      const midlertidig = result.computation?.afgoerelser.find((a) => a.rowId === 'midlertidig');
      // Ydelsen før den endelige virkningsdato var midlertidig og fratrækkes fuldt.
      expect(midlertidig?.fradragesTil).toBe('2020-08-31');
    });
  });
});
