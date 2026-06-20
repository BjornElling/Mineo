import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import type { AslAfgoerelseRow } from '../../../schemas/formSchemas';
import { ERHVERVSEVNETAB_INITIAL_VALUES } from '../../../domain/erhvervsevnetab/erhvervsevnetabInitialValues';
import {
  buildAldersreduktionFormelTekst,
  computeEetEalCalculation,
} from '../../../domain/erhvervsevnetab/eetEalCalculation';
import { emptyAslAfgoerelseRowFields } from '../../../domain/erhvervsevnetab/eetAslAfgoerelser';
import { aarsloenAslMax, erhvervsevnetabEalMax, reguleringssats } from '../../../data/lovbestemteRates';
import { toISODateString } from '../../../types/branded';

const asAmount = (value: number): AmountValue => ({ kind: 'number', value });
const iso = (value: string) => toISODateString(value);
const aslRow = (patch: Partial<AslAfgoerelseRow> & Pick<AslAfgoerelseRow, 'id'>): AslAfgoerelseRow => ({
  ...emptyAslAfgoerelseRowFields,
  ...patch,
});

describe('computeEetEalCalculation', () => {
  it('beregner EAL-krav med regulering, maksimum og aldersreduktion', () => {
    const result = computeEetEalCalculation({
      erhvervsevnetab: {
        ...ERHVERVSEVNETAB_INITIAL_VALUES,
        beregningsdato: iso('2026-02-27'),
        aslAarsloen: asAmount(489000),
        ealAarsloen: undefined,
        ealEetPct: 75,
        aslAfgoerelser: [],
      },
      skadedato: iso('2019-06-01'),
      skadelidteFodselsdato: iso('1966-01-08'),
      reguleringssats,
      erhvervsevnetabEalMax,
      aarsloenAslMax,
    });

    expect(result.issues).toEqual([]);
    expect(result.computation).not.toBeNull();
    expect(result.computation?.reguleringsPctRounded4).toBe(22.8178);
    expect(result.computation?.reguleretAarsloen).toBe(600500);
    expect(result.computation?.eetBeregnet).toBe(4503750);
    expect(result.computation?.eetAnvendt).toBe(4503750);
    expect(result.computation?.aldersreduktionPct).toBe(24);
    expect(result.computation?.aldersreduktionBeloeb).toBe(1080900);
    expect(result.computation?.ealKrav).toBe(3422850);
  });

  it('advarer (ikke-blokerende) når beregningsdato ligger før skadedato', () => {
    const result = computeEetEalCalculation({
      erhvervsevnetab: {
        ...ERHVERVSEVNETAB_INITIAL_VALUES,
        // Beregningsdato FØR skadedato (ulogisk datokombination, typisk tastefejl).
        beregningsdato: iso('2018-01-01'),
        aslAarsloen: asAmount(489000),
        ealAarsloen: undefined,
        ealEetPct: 75,
        aslAfgoerelser: [],
      },
      skadedato: iso('2019-06-01'),
      skadelidteFodselsdato: iso('1966-01-08'),
      reguleringssats,
      erhvervsevnetabEalMax,
      aarsloenAslMax,
    });

    const warning = result.issues.find((issue) => issue.id === 'warn-beregningsdato-foer-skadedato');
    expect(warning).toBeDefined();
    expect(warning?.severity).toBe('warning');
    // Advarslen er ikke-blokerende: beregningen producerer stadig et (uopreguleret) krav.
    expect(result.computation).not.toBeNull();
    // Beregningsår < skadesår → ingen reguleringsår → faktor 1 (uopreguleret).
    expect(result.computation?.reguleringsaar).toEqual([]);
    expect(result.computation?.reguleretAarsloen).toBe(489000);
  });

  it('ingen datoorden-advarsel når beregningsdato er lig skadedato', () => {
    const result = computeEetEalCalculation({
      erhvervsevnetab: {
        ...ERHVERVSEVNETAB_INITIAL_VALUES,
        beregningsdato: iso('2019-06-01'),
        aslAarsloen: asAmount(489000),
        ealAarsloen: undefined,
        ealEetPct: 75,
        aslAfgoerelser: [],
      },
      skadedato: iso('2019-06-01'),
      skadelidteFodselsdato: iso('1966-01-08'),
      reguleringssats,
      erhvervsevnetabEalMax,
      aarsloenAslMax,
    });

    expect(result.issues.some((issue) => issue.id === 'warn-beregningsdato-foer-skadedato')).toBe(false);
  });

  it('vælger EET % fra seneste afgørelse med tie-break på virkningsdato og endelig prioritet', () => {
    const result = computeEetEalCalculation({
      erhvervsevnetab: {
        ...ERHVERVSEVNETAB_INITIAL_VALUES,
        beregningsdato: iso('2026-02-27'),
        aslAarsloen: asAmount(500000),
        ealAarsloen: undefined,
        ealEetPct: undefined,
        aslAfgoerelser: [
          aslRow({
            id: 'a',
            afgoerelsesDato: iso('2025-01-01'),
            virkningsDato: iso('2025-06-01'),
            eetPct: 40,
            afgoerelseType: 'Midlertidig',
          }),
          aslRow({
            id: 'b',
            afgoerelsesDato: iso('2025-01-01'),
            virkningsDato: iso('2025-09-01'),
            eetPct: 45,
            afgoerelseType: 'Endelig',
          }),
        ],
      },
      skadedato: iso('2020-01-01'),
      skadelidteFodselsdato: iso('1990-01-01'),
      reguleringssats,
      erhvervsevnetabEalMax,
      aarsloenAslMax,
    });

    expect(result.issues).toEqual([]);
    expect(result.computation?.eetPct).toBe(45);
    expect(result.computation?.eetPctSource).toBe('asl');
  });

  it('giver særskilt fejl ved to identiske endelige afgørelser', () => {
    const result = computeEetEalCalculation({
      erhvervsevnetab: {
        ...ERHVERVSEVNETAB_INITIAL_VALUES,
        beregningsdato: iso('2026-02-27'),
        aslAarsloen: asAmount(500000),
        ealAarsloen: undefined,
        ealEetPct: undefined,
        aslAfgoerelser: [
          aslRow({
            id: 'a',
            afgoerelsesDato: iso('2025-01-01'),
            virkningsDato: iso('2025-06-01'),
            eetPct: 40,
            afgoerelseType: 'Endelig',
          }),
          aslRow({
            id: 'b',
            afgoerelsesDato: iso('2025-01-01'),
            virkningsDato: iso('2025-06-01'),
            eetPct: 45,
            afgoerelseType: 'Endelig',
          }),
        ],
      },
      skadedato: iso('2020-01-01'),
      skadelidteFodselsdato: iso('1990-01-01'),
      reguleringssats,
      erhvervsevnetabEalMax,
      aarsloenAslMax,
    });

    expect(result.computation).toBeNull();
    expect(result.issues.some((issue) => issue.message.includes('identiske afgørelser'))).toBe(true);
  });

  it('giver fejl når EET % ikke kan bestemmes fra EAL eller ASL', () => {
    const result = computeEetEalCalculation({
      erhvervsevnetab: {
        ...ERHVERVSEVNETAB_INITIAL_VALUES,
        beregningsdato: iso('2026-02-27'),
        aslAarsloen: asAmount(500000),
        ealAarsloen: undefined,
        ealEetPct: undefined,
        aslAfgoerelser: [
          aslRow({
            id: 'a',
            afgoerelsesDato: iso('2025-01-01'),
            virkningsDato: iso('2025-06-01'),
            eetPct: undefined,
            afgoerelseType: 'Endelig',
          }),
        ],
      },
      skadedato: iso('2020-01-01'),
      skadelidteFodselsdato: iso('1990-01-01'),
      reguleringssats,
      erhvervsevnetabEalMax,
      aarsloenAslMax,
    });

    expect(result.computation).toBeNull();
    expect(result.issues.some((issue) => issue.message === 'Erhvervsevnetabsprocent er ikke udfyldt.')).toBe(true);
  });

  it('giver fejl når reguleringssats mangler for et nødvendigt år', () => {
    const result = computeEetEalCalculation({
      erhvervsevnetab: {
        ...ERHVERVSEVNETAB_INITIAL_VALUES,
        beregningsdato: iso('2026-02-27'),
        aslAarsloen: asAmount(500000),
        ealAarsloen: undefined,
        ealEetPct: 40,
        aslAfgoerelser: [],
      },
      skadedato: iso('2024-01-01'),
      skadelidteFodselsdato: iso('1990-01-01'),
      reguleringssats: { ...reguleringssats, 2025: undefined as unknown as number },
      erhvervsevnetabEalMax,
      aarsloenAslMax,
    });

    expect(result.computation).toBeNull();
    expect(result.issues.some((issue) => issue.message.includes('Reguleringssats mangler'))).toBe(true);
  });

  it('springer regulering og 500-afrunding over når skadesår og beregningsår er ens', () => {
    const result = computeEetEalCalculation({
      erhvervsevnetab: {
        ...ERHVERVSEVNETAB_INITIAL_VALUES,
        beregningsdato: iso('2026-02-27'),
        aslAarsloen: asAmount(500123),
        ealAarsloen: asAmount(500123),
        ealEetPct: 40,
        aslAfgoerelser: [],
      },
      skadedato: iso('2026-01-01'),
      skadelidteFodselsdato: iso('1990-01-01'),
      reguleringssats,
      erhvervsevnetabEalMax,
      aarsloenAslMax,
    });

    expect(result.issues).toEqual([]);
    expect(result.computation).not.toBeNull();
    expect(result.computation?.reguleringsaar).toEqual([]);
    expect(result.computation?.reguleringsPctRounded4).toBe(0);
    expect(result.computation?.aarsloen).toBe(500123);
    expect(result.computation?.reguleretAarsloen).toBe(500123);
  });

  it('viser advarsel når EAL EET % er under 15', () => {
    const result = computeEetEalCalculation({
      erhvervsevnetab: {
        ...ERHVERVSEVNETAB_INITIAL_VALUES,
        beregningsdato: iso('2026-02-27'),
        aslAarsloen: asAmount(500000),
        ealAarsloen: undefined,
        ealEetPct: 10,
        aslAfgoerelser: [],
      },
      skadedato: iso('2020-01-01'),
      skadelidteFodselsdato: iso('1990-01-01'),
      reguleringssats,
      erhvervsevnetabEalMax,
      aarsloenAslMax,
    });

    expect(result.issues.some((issue) => issue.severity === 'warning' && issue.message.includes('EET efter EAL på mindre end 15 %'))).toBe(true);
  });

  it('viser advarsel når ASL-fallback EET % er under 15', () => {
    const result = computeEetEalCalculation({
      erhvervsevnetab: {
        ...ERHVERVSEVNETAB_INITIAL_VALUES,
        beregningsdato: iso('2026-02-27'),
        aslAarsloen: asAmount(500000),
        ealAarsloen: undefined,
        ealEetPct: undefined,
        aslAfgoerelser: [
          aslRow({
            id: 'a',
            afgoerelsesDato: iso('2025-01-01'),
            virkningsDato: iso('2025-01-01'),
            eetPct: 10,
            afgoerelseType: 'Endelig',
          }),
        ],
      },
      skadedato: iso('2020-01-01'),
      skadelidteFodselsdato: iso('1990-01-01'),
      reguleringssats,
      erhvervsevnetabEalMax,
      aarsloenAslMax,
    });

    expect(result.issues.some((issue) => issue.severity === 'warning' && issue.message.includes('Der er angivet et EET på mindre end 15 %'))).toBe(true);
  });

  it('viser advarsel når EAL-årsløn svarer til maks årsløn for skadesåret', () => {
    const result = computeEetEalCalculation({
      erhvervsevnetab: {
        ...ERHVERVSEVNETAB_INITIAL_VALUES,
        beregningsdato: iso('2026-02-27'),
        aslAarsloen: asAmount(500000),
        ealAarsloen: asAmount(539000),
        ealEetPct: 20,
        aslAfgoerelser: [],
      },
      skadedato: iso('2019-01-01'),
      skadelidteFodselsdato: iso('1990-01-01'),
      reguleringssats,
      erhvervsevnetabEalMax,
      aarsloenAslMax,
    });

    expect(result.issues.some((issue) => issue.severity === 'warning' && issue.message.includes('fulde årsløn skal indtastes'))).toBe(true);
  });

  it('viser advarsel når EAL-årsløn er tom og ASL-årsløn svarer til maks årsløn for skadesåret', () => {
    const result = computeEetEalCalculation({
      erhvervsevnetab: {
        ...ERHVERVSEVNETAB_INITIAL_VALUES,
        beregningsdato: iso('2026-02-27'),
        aslAarsloen: asAmount(539000),
        ealAarsloen: undefined,
        ealEetPct: 20,
        aslAfgoerelser: [],
      },
      skadedato: iso('2019-01-01'),
      skadelidteFodselsdato: iso('1990-01-01'),
      reguleringssats,
      erhvervsevnetabEalMax,
      aarsloenAslMax,
    });

    expect(result.issues.some((issue) => issue.severity === 'warning' && issue.message.includes('fulde årsløn skal indtastes'))).toBe(true);
  });

  it('viser advarsel når skadedato er fra 1. juli 2024 og EAL-årsløn ikke er udfyldt', () => {
    const result = computeEetEalCalculation({
      erhvervsevnetab: {
        ...ERHVERVSEVNETAB_INITIAL_VALUES,
        beregningsdato: iso('2026-02-27'),
        aslAarsloen: asAmount(600000),
        ealAarsloen: undefined,
        ealEetPct: 20,
        aslAfgoerelser: [],
      },
      skadedato: iso('2024-07-01'),
      skadelidteFodselsdato: iso('1990-01-01'),
      reguleringssats,
      erhvervsevnetabEalMax,
      aarsloenAslMax,
    });

    expect(
      result.issues.some(
        (issue) =>
          issue.severity === 'warning' &&
          issue.message === 'For skader fra 1. juli 2024 og frem beregnes årsløn forskelligt efter EAL og ASL.'
      )
    ).toBe(true);
  });
});

describe('computeEetEalCalculation — delegering til opreguleringsmotor (akkumuleret reguleringssats)', () => {
  // Den tidligere inline-løkke (faktor *= 1 + sats/100 over [skadeår+1, beregningsår])
  // blev erstattet af opregulerMedAkkumuleretReguleringssats. Disse tests låser
  // (a) at den anvendte reguleringsprocent er numerisk identisk med det eksplicitte
  // akkumulerede produkt, og (b) at et hul i reguleringssatsen fail-closer.
  const baseInput = (overrides: { reguleringssats?: typeof reguleringssats } = {}) => ({
    erhvervsevnetab: {
      ...ERHVERVSEVNETAB_INITIAL_VALUES,
      beregningsdato: iso('2026-02-27'),
      aslAarsloen: asAmount(489000),
      ealAarsloen: undefined,
      ealEetPct: 75,
      aslAfgoerelser: [],
    },
    skadedato: iso('2019-06-01'),
    skadelidteFodselsdato: iso('1966-01-08'),
    reguleringssats: overrides.reguleringssats ?? reguleringssats,
    erhvervsevnetabEalMax,
    aarsloenAslMax,
  });

  it('anvender en reguleringsfaktor der er tal-identisk med det eksplicitte akkumulerede produkt', () => {
    const result = computeEetEalCalculation(baseInput());
    expect(result.computation).not.toBeNull();

    // Eksplicit reproduktion af den gamle inline-formel: produkt over [skadeår+1, beregningsår].
    let forventetFaktor = 1;
    for (let year = 2020; year <= 2026; year += 1) {
      forventetFaktor *= 1 + reguleringssats[year]! / 100;
    }
    const forventetPctRounded4 = Number(((forventetFaktor - 1) * 100).toFixed(4));
    expect(result.computation?.reguleringsPctRounded4).toBe(forventetPctRounded4);
    // Sanity: matcher den i forvejen verificerede værdi fra hovedtesten.
    expect(result.computation?.reguleringsPctRounded4).toBe(22.8178);
  });

  it('fail-closer (computation null + reguleringssats-missing) når en mellemliggende reguleringssats mangler', () => {
    const medHul: typeof reguleringssats = { ...reguleringssats };
    delete (medHul as Record<number, number>)[2022];

    const result = computeEetEalCalculation(baseInput({ reguleringssats: medHul }));
    expect(result.computation).toBeNull();
    expect(
      result.issues.some(
        (issue) => issue.severity === 'error' && issue.id === 'reguleringssats-missing' && issue.message.includes('2022')
      )
    ).toBe(true);
  });

  it('fail-closer også når kun startårets (skadeårets) reguleringssats mangler — motorens dækningskrav', () => {
    // Motoren kræver dækning for startåret selv om det ikke multipliceres ind i faktoren.
    // Den gamle inline-løkke flaggede IKKE skadeåret; dette er en bevidst udvidelse af
    // fail-closed (synlig feltfejl frem for tavs sti). I praksis dækker reguleringssats
    // 2005-2026 sammenhængende, så scenariet er kun nåbart ved et kunstigt hul.
    const medHul: typeof reguleringssats = { ...reguleringssats };
    delete (medHul as Record<number, number>)[2019]; // skadeår = 2019

    const result = computeEetEalCalculation(baseInput({ reguleringssats: medHul }));
    expect(result.computation).toBeNull();
    expect(
      result.issues.some(
        (issue) => issue.severity === 'error' && issue.id === 'reguleringssats-missing' && issue.message.includes('2019')
      )
    ).toBe(true);
  });
});

describe('computeEetEalCalculation — aldersreduktionsprocent (invarianter)', () => {
  // Aldersreduktionsformlen: 0 ved alder <= 29, (alder - 29) ved 30-54,
  // (alder - 29) + (alder - 54) x 2 ved alder > 54, cappet til 70 %.
  // Vi sætter skadeår = beregningsår for at fjerne regulering og isolere procenten.
  const aldersreduktionPctVedAlder = (alderVedSkade: number): number | undefined => {
    // Fødselsdato 02-01 og skadedato 03-01 samme dag/måned-orden sikrer at alderen
    // er præcis (alder = skadeår - fødselsår) fordi fødselsdagen er passeret.
    const skadedato = iso('2026-03-01');
    const fodselsaar = 2026 - alderVedSkade;
    const result = computeEetEalCalculation({
      erhvervsevnetab: {
        ...ERHVERVSEVNETAB_INITIAL_VALUES,
        beregningsdato: iso('2026-06-01'),
        aslAarsloen: undefined,
        ealAarsloen: asAmount(500000),
        ealEetPct: 100,
        aslAfgoerelser: [],
      },
      skadedato,
      skadelidteFodselsdato: iso(`${fodselsaar}-02-01`),
      reguleringssats,
      erhvervsevnetabEalMax,
      aarsloenAslMax,
    });
    return result.computation?.aldersreduktionPct;
  };

  it('giver 0 % ved alder 29 og derunder', () => {
    expect(aldersreduktionPctVedAlder(20)).toBe(0);
    expect(aldersreduktionPctVedAlder(29)).toBe(0);
  });

  it('giver (alder - 29) i intervallet 30-54 år', () => {
    expect(aldersreduktionPctVedAlder(30)).toBe(1);
    expect(aldersreduktionPctVedAlder(40)).toBe(11);
    expect(aldersreduktionPctVedAlder(54)).toBe(25);
  });

  it('lægger 2 % pr. år over 54 oveni grundreduktionen', () => {
    expect(aldersreduktionPctVedAlder(55)).toBe(28); // (55-29) + (55-54)*2 = 26 + 2
    expect(aldersreduktionPctVedAlder(60)).toBe(43); // (60-29) + (60-54)*2 = 31 + 12
  });

  it('capper reduktionen til 70 % fra og med alder 69', () => {
    expect(aldersreduktionPctVedAlder(69)).toBe(70); // (69-29) + (69-54)*2 = 40 + 30
    expect(aldersreduktionPctVedAlder(70)).toBe(70); // ville være 73 uden cap
    expect(aldersreduktionPctVedAlder(80)).toBe(70);
  });

  it('holder den beregnede procent identisk med visningsformlens cap-intention', () => {
    // Visningsformlen markerer "(max 70 %)" netop når den ucappede procent ville overstige 70.
    // Her bekræftes at den beregnede procent aldrig overstiger den markering.
    for (let alder = 55; alder <= 90; alder += 1) {
      const beregnet = aldersreduktionPctVedAlder(alder);
      expect(beregnet).toBeLessThanOrEqual(70);
    }
  });
});

describe('buildAldersreduktionFormelTekst', () => {
  it('viser den cappede alder når alderen er over 69 år', () => {
    expect(buildAldersreduktionFormelTekst(72)).toBe('(72 - 29) + (72 - 54) x 2 (max 70 %) =');
  });

  it('viser den faktiske alder når alderen højst er 69 år', () => {
    expect(buildAldersreduktionFormelTekst(54)).toBe('(54 - 29) =');
    expect(buildAldersreduktionFormelTekst(69)).toBe('(69 - 29) + (69 - 54) x 2 =');
  });

  it('capped også visningsformlen ved 70 år', () => {
    expect(buildAldersreduktionFormelTekst(70)).toBe('(70 - 29) + (70 - 54) x 2 (max 70 %) =');
  });
});
