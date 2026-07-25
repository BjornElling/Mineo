import { computeForsoergertabSnapshot } from '../../../domain/forsoergertab/forsoergertabSnapshot';
import * as ealKrav from '../../../domain/forsoergertab/forsoergertabEalKrav';
import * as aslYdelser from '../../../domain/forsoergertab/forsoergertabAslYdelser';
import { toISODateString } from '../../../types/branded';
import type {
  FaellesAarsloenValues,
  ForsoergertabValues,
  StamdataValues,
} from '../../../schemas/formSchemas';

// INVARIANT (`form-contract.md` §2.3, `error-contract.md` §5, design §1.10/§3.9): en beregningsmotor må
// ALDRIG kaldes, når en af DENS EGNE afhængigheder har en rød feltfejl. Readeren maskerer en rød værdi til
// `undefined`, så et motorkald ville regne på et FALSK input — fx kan en rød EAL-årsløn ellers falde tilbage
// til ASL-årslønnen (`eetEalCalculation.ts:184-193`) og rapportere `source: 'asl'`, som om feltet var tomt.
//
// Testene spionerer på de FAKTISKE motorer i stedet for kun at tjekke outputtet. Et `computation: null` kan
// nemlig også opstå, fordi motoren kørte og selv gav op — det ville ikke bevise gaten. `not.toHaveBeenCalled()`
// beviser den strukturelt.
//
// Lige så vigtigt: gaten må ikke OVERBLOKERE. Hver test parres derfor med, at den UAFHÆNGIGE gruppes motor
// stadig kaldes præcis én gang (§1.10 — uafhængige consumers fortsætter).

const asAmount = (value: number) => ({ kind: 'number' as const, value });

const createValues = (overrides: Partial<ForsoergertabValues> = {}): ForsoergertabValues => ({
  beregningsdato: toISODateString('2026-03-19'),
  efterladteFodselsdato: toISODateString('1973-01-01'),
  virkningsdato: toISODateString('2025-01-01'),
  koen: 'Kvinde',
  tilkendtForPeriodeAar: 10,
  ...overrides,
});

const createFaellesAarsloen = (overrides: Partial<FaellesAarsloenValues> = {}): FaellesAarsloenValues => ({
  aslAarsloen: asAmount(450000),
  ealAarsloen: asAmount(450000),
  ...overrides,
});

const createStamdata = (overrides: Partial<StamdataValues> = {}): StamdataValues => ({
  journalnr: '',
  advokat: '',
  sagsbehandler: '',
  skadelidte: 'Test',
  skadestype: 'Arbejdsulykke',
  skadedato: toISODateString('2020-05-01'),
  skadelidteFodselsdato: toISODateString('1980-01-01'),
  ...overrides,
});

const NO_FIELD_ERRORS = {
  forsoergertab: {},
  faellesAarsloen: {},
  stamdata: {},
} as const;

const FIELD_ERROR = { message: 'Ugyldig værdi' } as const;

type SnapshotArgs = Parameters<typeof computeForsoergertabSnapshot>[0];

describe('Forsørgertab: motoren kaldes kun for en ready dependency-gruppe', () => {
  let ealSpy: ReturnType<typeof vi.spyOn>;
  let aslSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    ealSpy = vi.spyOn(ealKrav, 'computeForsoergertabEalKrav');
    aslSpy = vi.spyOn(aslYdelser, 'computeForsoergertabAslYdelser');
  });

  afterEach(() => {
    ealSpy.mockRestore();
    aslSpy.mockRestore();
  });

  const compute = (fieldErrors: SnapshotArgs['fieldErrors'], overrides: Partial<SnapshotArgs> = {}) =>
    computeForsoergertabSnapshot({
      values: createValues(),
      faellesAarsloen: createFaellesAarsloen(),
      stamdata: createStamdata(),
      fieldErrors,
      ...overrides,
    });

  it('kalder begge motorer præcis én gang, når intet felt er rødt', () => {
    const snapshot = compute(NO_FIELD_ERRORS);

    expect(ealSpy).toHaveBeenCalledTimes(1);
    expect(aslSpy).toHaveBeenCalledTimes(1);
    expect(snapshot.calculation.ealComputation).not.toBeNull();
    expect(snapshot.calculation.aslComputation).not.toBeNull();
  });

  it('rød virkningsdato blokerer ASL-motoren og BEVARER EAL-motoren', () => {
    // Virkningsdato er kun en ASL-afhængighed. EAL-delen skal fortsætte uændret.
    const snapshot = compute({
      ...NO_FIELD_ERRORS,
      forsoergertab: { virkningsdato: FIELD_ERROR },
    });

    expect(aslSpy).not.toHaveBeenCalled();
    expect(ealSpy).toHaveBeenCalledTimes(1);
    expect(snapshot.calculation.aslComputation).toBeNull();
    expect(snapshot.calculation.ealComputation).not.toBeNull();
    // Totalen kræver begge delberegninger.
    expect(snapshot.calculation.result).toBeNull();
  });

  it('rød EAL-årsløn blokerer EAL-motoren, så der ikke kan opstå en falsk ASL-fallback', () => {
    // Dette er kernen i det oprindelige brud: uden gaten ville readerens maskering af EAL-årslønnen få
    // motoren til at bruge ASL-årslønnen og rapportere source 'asl', som om brugeren ikke havde udfyldt EAL.
    const snapshot = compute({
      ...NO_FIELD_ERRORS,
      faellesAarsloen: { ealAarsloen: FIELD_ERROR },
    });

    expect(ealSpy).not.toHaveBeenCalled();
    expect(aslSpy).toHaveBeenCalledTimes(1);
    expect(snapshot.calculation.ealComputation).toBeNull();
    expect(snapshot.calculation.aslComputation).not.toBeNull();
  });

  it('rød ASL-årsløn med en gyldig EAL-årsløn blokerer KUN ASL-motoren', () => {
    // Fallback-invarianten: EAL bruger kun ASL-årslønnen, når EAL-årslønnen er tom. Er den udfyldt, er en rød
    // ASL-årsløn slet ikke en EAL-afhængighed, og EAL-delen må ikke overblokeres.
    const snapshot = compute(
      { ...NO_FIELD_ERRORS, faellesAarsloen: { aslAarsloen: FIELD_ERROR } },
      { faellesAarsloen: createFaellesAarsloen({ ealAarsloen: asAmount(450000) }) }
    );

    expect(aslSpy).not.toHaveBeenCalled();
    expect(ealSpy).toHaveBeenCalledTimes(1);
    expect(snapshot.canShowEal).toBe(true);
    expect(snapshot.canShowAsl).toBe(false);
  });

  it('rød ASL-årsløn med TOM EAL-årsløn blokerer BEGGE motorer', () => {
    // Her nås fallbacken faktisk, så ASL-årslønnen ER en EAL-afhængighed. En rød primærværdi må ikke
    // omfortolkes til tomhed og fodre EAL-beregningen.
    compute(
      { ...NO_FIELD_ERRORS, faellesAarsloen: { aslAarsloen: FIELD_ERROR } },
      { faellesAarsloen: createFaellesAarsloen({ ealAarsloen: undefined }) }
    );

    expect(aslSpy).not.toHaveBeenCalled();
    expect(ealSpy).not.toHaveBeenCalled();
  });

  it('rød beregningsdato er en FÆLLES afhængighed og blokerer begge motorer', () => {
    const snapshot = compute({
      ...NO_FIELD_ERRORS,
      forsoergertab: { beregningsdato: FIELD_ERROR },
    });

    expect(ealSpy).not.toHaveBeenCalled();
    expect(aslSpy).not.toHaveBeenCalled();
    expect(snapshot.calculation.result).toBeNull();
    expect(snapshot.pdfGate.canDownload).toBe(false);
  });

  it('en stamdata-datoordensfejl blokerer begge motorer, selv uden feltfejl fra readeren', () => {
    // Datoordensfejlen udledes i snapshottet selv (skadedato før fødselsdato), ikke af readeren. Den er
    // stadig en reel afhængighedsfejl og skal gate motorerne på samme måde.
    compute(NO_FIELD_ERRORS, {
      stamdata: createStamdata({
        skadelidteFodselsdato: toISODateString('2021-01-01'),
        skadedato: toISODateString('2020-05-01'),
      }),
    });

    expect(ealSpy).not.toHaveBeenCalled();
    expect(aslSpy).not.toHaveBeenCalled();
  });
});
