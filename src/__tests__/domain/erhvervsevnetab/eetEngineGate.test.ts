import { FAELLES_AARSLOEN_INITIAL_VALUES } from '../../../domain/aslEalAarsloen/faellesAarsloenInitialValues';
import { ERHVERVSEVNETAB_INITIAL_VALUES } from '../../../domain/erhvervsevnetab/erhvervsevnetabInitialValues';
import { computeEetSnapshot } from '../../../domain/erhvervsevnetab/eetSnapshot';
import * as loebendeYdelser from '../../../domain/erhvervsevnetab/eetLoebendeYdelserCalculation';
import * as kapitalisering from '../../../domain/erhvervsevnetab/eetKapitaliseringCalculation';
import * as ealCalculation from '../../../domain/erhvervsevnetab/eetEalCalculation';
import * as differencekrav from '../../../domain/erhvervsevnetab/eetCalculationGraph';
import type { ErhvervsevnetabComposedValues, StamdataValues } from '../../../schemas/formSchemas';
import { toISODateString } from '../../../types/branded';

// INVARIANT (`form-contract.md` §2.3, `error-contract.md` §5, design §1.10/§3.9): hvert EET-panel kalder KUN
// sin motor, når panelets EGNE afhængigheder er ready.
//
// Testene spionerer på de faktiske motormoduler. Et `computation: null` alene beviser intet — motoren kan
// være kørt og selv have givet op. `not.toHaveBeenCalled()` beviser gaten strukturelt.
//
// Hver test kontrollerer BEGGE retninger: at det afhængige panel blokeres, OG at et uafhængigt panel stadig
// beregnes. Uden den anden halvdel ville en global gate (som §1.10 forbyder) også få testen til at passere.

const createValues = (
  overrides: Partial<ErhvervsevnetabComposedValues> = {}
): ErhvervsevnetabComposedValues => ({
  ...ERHVERVSEVNETAB_INITIAL_VALUES,
  ...FAELLES_AARSLOEN_INITIAL_VALUES,
  beregningsdato: toISODateString('2026-03-19'),
  skadelidteFodselsdato: toISODateString('1980-01-01'),
  koen: 'Kvinde',
  aslAarsloen: { kind: 'number', value: 600000 },
  ealAarsloen: { kind: 'number', value: 600000 },
  ealEetPct: 25,
  aslAfgoerelser: [
    {
      id: 'row-1',
      afgoerelsesDato: toISODateString('2026-02-01'),
      virkningsDato: toISODateString('2026-02-01'),
      eetPct: 25,
      kapDato: toISODateString('2026-03-01'),
      kapPct: 10,
      afgoerelseType: 'Endelig',
      tidlKapDato: undefined,
      fsTilbageholdtEet: 'Nej',
    },
  ],
  ...overrides,
});

const createStamdata = (): StamdataValues => ({
  journalnr: '',
  advokat: '',
  sagsbehandler: '',
  skadelidte: 'Test',
  skadestype: 'Arbejdsulykke',
  skadedato: toISODateString('2024-07-01'),
  skadelidteFodselsdato: toISODateString('1980-01-01'),
});

const NO_FIELD_ERRORS = {
  stamdata: {},
  erhvervsevnetab: {},
  faellesAarsloen: {},
} as const;

const FIELD_ERROR = { message: 'Ugyldig værdi' } as const;

type SnapshotArgs = Parameters<typeof computeEetSnapshot>[0];

describe('EET: panelmotoren kaldes kun for en ready dependency-gruppe', () => {
  let spies: Record<'loebende' | 'kapitalisering' | 'eal' | 'difference', ReturnType<typeof vi.spyOn>>;

  beforeEach(() => {
    spies = {
      loebende: vi.spyOn(loebendeYdelser, 'computeEetLoebendeYdelser'),
      kapitalisering: vi.spyOn(kapitalisering, 'computeEetKapitaliseringCalculation'),
      eal: vi.spyOn(ealCalculation, 'computeEetEalCalculation'),
      difference: vi.spyOn(differencekrav, 'computeEetDifferencekravCalculation'),
    };
  });

  afterEach(() => {
    for (const spy of Object.values(spies)) spy.mockRestore();
  });

  const compute = (fieldErrors: SnapshotArgs['fieldErrors'], overrides: Partial<SnapshotArgs> = {}) =>
    computeEetSnapshot({
      values: createValues(),
      stamdata: createStamdata(),
      fieldErrors,
      ...overrides,
    });

  it('kalder alle fire panelmotorer, når intet felt er rødt', () => {
    compute(NO_FIELD_ERRORS);

    // Bemærk: løbende/EAL/kapitalisering kaldes MERE end én gang, fordi differencekravets graf bevidst kører
    // søstermotorerne igen med ANDET input — ASL-rækker filtreret til beregningsdatoen og `dagFoerBeregningsdato`
    // (`eetCalculationGraph.ts:25-77`). De ekstra kald er derfor ikke duplikeret arbejde, og de må IKKE erstattes
    // af de gatede søsterresultater: det ville ændre differencekravets tal. Gaten sikrer kun, at graf-kaldene
    // slet ikke sker, når differencekravets egne afhængigheder er røde (se testene nedenfor).
    expect(spies.loebende).toHaveBeenCalled();
    expect(spies.kapitalisering).toHaveBeenCalled();
    expect(spies.eal).toHaveBeenCalled();
    expect(spies.difference).toHaveBeenCalledTimes(1);
  });

  it('rød beregningsdato blokerer Løbende/Efter-EAL/Difference og BEVARER Kapitalisering', () => {
    // Beregningsdato er ikke en kapitaliserings-afhængighed. Det er den dependency-specifikke opdeling
    // i §1.10: gaten må ikke overblokere.
    const snapshot = compute({
      ...NO_FIELD_ERRORS,
      erhvervsevnetab: { beregningsdato: FIELD_ERROR },
    });

    expect(spies.loebende).not.toHaveBeenCalled();
    expect(spies.eal).not.toHaveBeenCalled();
    expect(spies.difference).not.toHaveBeenCalled();
    expect(spies.kapitalisering).toHaveBeenCalledTimes(1);
    expect(snapshot.kapitalisering.hasBlockingErrors).toBe(false);
    expect(snapshot.kapitalisering.computation).not.toBeNull();
  });

  it('rød EAL-% blokerer Efter-EAL + Difference og BEVARER Løbende + Kapitalisering', () => {
    // Uden gaten ville en maskeret EAL-% falde tilbage til ASL-rækkernes eetPct
    // (`eetEalCalculation.ts:158-181`), så resultatet ville se ud som om brugeren ikke havde udfyldt EAL-%.
    const snapshot = compute({
      ...NO_FIELD_ERRORS,
      erhvervsevnetab: { ealEetPct: FIELD_ERROR },
    });

    expect(spies.eal).not.toHaveBeenCalled();
    expect(spies.difference).not.toHaveBeenCalled();
    expect(spies.loebende).toHaveBeenCalledTimes(1);
    expect(spies.kapitalisering).toHaveBeenCalledTimes(1);
    expect(snapshot.efterEal.computation).toBeNull();
  });

  it('rød EAL-årsløn blokerer Efter-EAL, så der ikke kan opstå en falsk ASL-årsløns-fallback', () => {
    // `resolveAarsloen` (`eetEalCalculation.ts:184-193`) falder tilbage til ASL-årslønnen, når EAL-årslønnen
    // ikke er et tal > 0. En rød primærværdi må ikke omfortolkes til tomhed.
    compute({
      ...NO_FIELD_ERRORS,
      faellesAarsloen: { ealAarsloen: FIELD_ERROR },
    });

    expect(spies.eal).not.toHaveBeenCalled();
    expect(spies.difference).not.toHaveBeenCalled();
    expect(spies.loebende).toHaveBeenCalledTimes(1);
    expect(spies.kapitalisering).toHaveBeenCalledTimes(1);
  });

  it('rød ASL-årsløn med en BRUGBAR EAL-årsløn bevarer Efter-EAL (ingen overblokering)', () => {
    // Fallbacken nås ikke, når EAL-årslønnen er udfyldt → ASL er slet ikke en Efter-EAL-afhængighed.
    compute({
      ...NO_FIELD_ERRORS,
      faellesAarsloen: { aslAarsloen: FIELD_ERROR },
    });

    expect(spies.loebende).not.toHaveBeenCalled();
    expect(spies.kapitalisering).not.toHaveBeenCalled();
    expect(spies.difference).not.toHaveBeenCalled();
    expect(spies.eal).toHaveBeenCalledTimes(1);
  });

  it('rød ASL-årsløn med TOM EAL-årsløn blokerer Efter-EAL — fallbacken nås', () => {
    // Den anden retning af fallback-invarianten: her LÆSER motoren ASL-årslønnen, så en rød ASL-værdi må ikke
    // maskeres til tomhed og fodre beregningen.
    compute(
      { ...NO_FIELD_ERRORS, faellesAarsloen: { aslAarsloen: FIELD_ERROR } },
      { values: createValues({ ealAarsloen: undefined }) }
    );

    expect(spies.eal).not.toHaveBeenCalled();
  });

  it('en rød ASL-rækkecelle med en BRUGBAR EAL-% bevarer Efter-EAL', () => {
    // Rækkefejl kommer ind som ét `field-asl-afgoerelser`-aggregat fra reader-projektionen.
    compute({
      ...NO_FIELD_ERRORS,
      erhvervsevnetab: { aslAfgoerelser: FIELD_ERROR },
    });

    expect(spies.loebende).not.toHaveBeenCalled();
    expect(spies.kapitalisering).not.toHaveBeenCalled();
    expect(spies.difference).not.toHaveBeenCalled();
    expect(spies.eal).toHaveBeenCalledTimes(1);
  });

  it('en rød ASL-rækkecelle med TOM EAL-% blokerer Efter-EAL — eetPct-fallbacken nås', () => {
    compute(
      { ...NO_FIELD_ERRORS, erhvervsevnetab: { aslAfgoerelser: FIELD_ERROR } },
      { values: createValues({ ealEetPct: undefined }) }
    );

    expect(spies.eal).not.toHaveBeenCalled();
  });

  it('en EAL-% på 0 tæller som tom, så ASL-rækkefejlen blokerer Efter-EAL', () => {
    // Motoren behandler `ealEetPct === 0` som "ikke angivet" (`eetEalCalculation.ts:169`); gaten skal spejle det.
    compute(
      { ...NO_FIELD_ERRORS, erhvervsevnetab: { aslAfgoerelser: FIELD_ERROR } },
      { values: createValues({ ealEetPct: 0 }) }
    );

    expect(spies.eal).not.toHaveBeenCalled();
  });

  it('et ugyldigt forlig blokerer KUN differencekravet', () => {
    // Uden gaten ville motoren regne videre med `forligFactor: null`, dvs. som om der slet ikke var et forlig
    // — et falsk 100 %-resultat bag en rød markering.
    const snapshot = compute(NO_FIELD_ERRORS, {
      forlig: {
        values: { forligAnsvarsgradProcent: 50, forligAnsvarsgradBroek: '1/2' },
        hasInvalidDraft: false,
        dato: undefined,
        datoErrorMessage: undefined,
      },
    });

    expect(spies.difference).not.toHaveBeenCalled();
    expect(spies.loebende).toHaveBeenCalledTimes(1);
    expect(spies.kapitalisering).toHaveBeenCalledTimes(1);
    expect(spies.eal).toHaveBeenCalledTimes(1);
    expect(snapshot.differencekrav.computation).toBeNull();
    expect(snapshot.differencekrav.hasBlockingErrors).toBe(true);
  });

  it('en stamdata-datoordensfejl blokerer alle fire paneler', () => {
    compute(NO_FIELD_ERRORS, {
      values: createValues({ skadelidteFodselsdato: toISODateString('2025-01-01') }),
      stamdata: {
        ...createStamdata(),
        skadelidteFodselsdato: toISODateString('2025-01-01'),
        skadedato: toISODateString('2024-07-01'),
      },
    });

    expect(spies.loebende).not.toHaveBeenCalled();
    expect(spies.kapitalisering).not.toHaveBeenCalled();
    expect(spies.eal).not.toHaveBeenCalled();
    expect(spies.difference).not.toHaveBeenCalled();
  });
});
