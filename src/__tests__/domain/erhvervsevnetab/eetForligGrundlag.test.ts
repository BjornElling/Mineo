/**
 * Forligsgradens GRUNDLAG på de to EET-faner, der reducerer med den.
 *
 * Dette er filen, `eetCalculationGraph.ts` og `eetEalForligSchema` henviser til. Reglen er
 * ufravigelig og er udviklerens (2026-09-09):
 *
 *   EET efter EAL:  forlig x (EAL-krav)
 *   Differencekrav: forlig x (EAL-krav − løbende ydelser − kapitalbeløb − rest-EET − mer-erstatning)
 *
 * De to grundlag er FORSKELLIGE med vilje. Ville differencekravet reducere det rene EAL-krav, blev
 * kravet markant for lavt – en alvorlig beregningsfejl i en sag om store beløb. Mønsteret fra fane 4
 * må derfor aldrig brede sig til fane 5, og testene her måler netop den grænse:
 *
 *  1. Fane 4 reducerer sit eget krav, og `ealKravOre` bliver stående ureduceret ved siden af.
 *  2. Differencekravets EGEN EAL-beregning bærer ALDRIG en forligsblok (grafen sender `forlig: null`).
 *  3. Differencekravets bundlinje er forligsgraden af beløbet EFTER alle fradrag – og er beviseligt
 *     forskellig fra forligsgraden af det rene EAL-krav.
 */
import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import { FAELLES_AARSLOEN_INITIAL_VALUES } from '../../../domain/aslEalAarsloen/faellesAarsloenInitialValues';
import { ERHVERVSEVNETAB_INITIAL_VALUES } from '../../../domain/erhvervsevnetab/erhvervsevnetabInitialValues';
import { computeEetSnapshot } from '../../../domain/erhvervsevnetab/eetSnapshot';
import type { ErhvervsevnetabComposedValues, StamdataValues } from '../../../schemas/formSchemas';
import { fromKroner, toKroner } from '../../../domain/money/money';
import { round0 } from '../../../utils/roundingShortcuts';
import { toISODateString } from '../../../types/branded';

const iso = (value: string) => toISODateString(value);
const asAmount = (value: number): AmountValue => ({ kind: 'number', value });

const createValues = (): ErhvervsevnetabComposedValues => ({
  ...ERHVERVSEVNETAB_INITIAL_VALUES,
  ...FAELLES_AARSLOEN_INITIAL_VALUES,
  beregningsdato: iso('2026-06-01'),
  skadelidteFodselsdato: iso('1970-01-01'),
  aslAarsloen: asAmount(400000),
  ealAarsloen: asAmount(900000),
  aslAfgoerelser: [
    {
      id: 'delvist-endelig-1',
      afgoerelsesDato: iso('2018-12-01'),
      virkningsDato: iso('2019-01-01'),
      eetPct: 30,
      kapDato: iso('2019-01-01'),
      kapPct: 15,
      afgoerelseType: 'Delvist endelig',
      tidlKapDato: undefined,
      fsTilbageholdtEet: 'Nej',
    },
    {
      id: 'endelig-1',
      afgoerelsesDato: iso('2020-06-01'),
      virkningsDato: iso('2019-07-01'),
      eetPct: 50,
      kapDato: iso('2020-06-01'),
      kapPct: 25,
      afgoerelseType: 'Endelig',
      tidlKapDato: undefined,
      fsTilbageholdtEet: 'Nej',
    },
  ],
});

const createStamdata = (): StamdataValues => ({
  journalnr: '',
  advokat: '',
  sagsbehandler: '',
  skadelidte: 'Forligsgrundlag',
  skadestype: 'Arbejdsulykke',
  skadedato: iso('2018-06-01'),
  skadelidteFodselsdato: iso('1970-01-01'),
});

const computeWithForlig = (procent: number | undefined) => computeEetSnapshot({
  values: createValues(),
  stamdata: createStamdata(),
  fieldErrors: { stamdata: {}, erhvervsevnetab: {}, faellesAarsloen: {} },
  forlig: {
    values: { forligAnsvarsgradProcent: procent, forligAnsvarsgradBroek: '' },
    dato: iso('2022-05-01'),
    hasRejectedInput: false,
  },
});

describe('forligsgradens grundlag på de to EET-faner', () => {
  it('lader fane 4 reducere sit eget EAL-krav og beholder det ureducerede krav ved siden af', () => {
    const snapshot = computeWithForlig(50);
    const eal = snapshot.efterEal.computation;
    if (!eal) throw new Error('Forventede EAL-beregning');

    expect(eal.forlig).not.toBeNull();
    expect(eal.forlig?.label).toBe('50 %');
    expect(eal.forlig?.ealKravEfterForligOre).toBe(
      // Grundlaget er fanens EGET krav, og afrundingen er hele kroner som differencekravets.
      fromKroner(round0(toKroner(eal.ealKravOre) * 0.5))
    );
    // Det ureducerede krav er uændret og er det, differencekravet aftager.
    expect(toKroner(eal.ealKravOre)).toBeGreaterThan(toKroner(eal.forlig!.ealKravEfterForligOre));
  });

  it('giver differencekravets EGEN EAL-beregning INGEN forligsblok', () => {
    const snapshot = computeWithForlig(50);
    const difference = snapshot.differencekrav.computation;
    if (!difference) throw new Error('Forventede differencekrav');

    // Selve værnet: grafen kalder EAL-motoren med `forlig: null`. Bærer denne computation en
    // forligsblok, er forliget sivet ind i differencekravets grundlag, og bundlinjen er forkert.
    expect(difference.ealComputation?.forlig).toBeNull();
  });

  it('reducerer differencekravet med forligsgraden af beløbet EFTER alle ASL-fradrag', () => {
    const snapshot = computeWithForlig(50);
    const difference = snapshot.differencekrav.computation;
    if (!difference) throw new Error('Forventede differencekrav');

    expect(difference.forligFactor).toBe(0.5);
    expect(toKroner(difference.differencekravOre)).toBe(
      round0(toKroner(difference.differencekravFoerForligOre) * 0.5)
    );

    // Der ER trukket fradrag fra, så grundlaget er beviseligt mindre end EAL-kravet.
    expect(toKroner(difference.differencekravFoerForligOre)).toBeLessThan(toKroner(difference.ealKravOre));
    // Og dermed er bundlinjen forskellig fra forligsgraden af det rene EAL-krav – præcis den fejl,
    // reglen skal udelukke.
    expect(toKroner(difference.differencekravOre)).not.toBe(round0(toKroner(difference.ealKravOre) * 0.5));
  });

  it('viser ingen forligsblok på nogen af fanerne ved et forlig på 100 %', () => {
    const snapshot = computeWithForlig(100);
    const eal = snapshot.efterEal.computation;
    const difference = snapshot.differencekrav.computation;
    if (!eal || !difference) throw new Error('Forventede begge beregninger');

    // Et forlig på 100 % reducerer intet, og begge faner udelader derfor forligsomtalen (BB-197).
    expect(eal.forlig).toBeNull();
    expect(difference.forligFactor).toBeNull();
    expect(difference.forligLabel).toBeNull();
    expect(toKroner(difference.differencekravOre)).toBe(toKroner(difference.differencekravFoerForligOre));
  });

  it('udelader forligsblokken helt, når der ikke er angivet et forlig', () => {
    const snapshot = computeWithForlig(undefined);
    expect(snapshot.efterEal.computation?.forlig).toBeNull();
    expect(snapshot.differencekrav.computation?.forligLabel).toBeNull();
  });
});
