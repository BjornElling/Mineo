import { getProductionInputCatalog, productionInputFields } from '../../inputCore/catalog/productionCatalog';
import { reduceInputCommand, setImmediateField } from '../../inputCore/inputReducer';
import { createEmptySettledInput, type SettledInput } from '../../inputCore/settledInput';
import { createInputEvaluation } from '../../inputCore/inputReader';
import {
  createEvaluationSourceToken,
  createInputRevision,
  createSettingsRevision,
} from '../../inputCore/evaluationSource';
import type { FieldDescriptor } from '../../inputCore/fieldDescriptor';
import { seedSatserNewCase } from '../../domain/satser/satserNewCaseSeed';
import { buildAarsloenReaderProjection } from '../../domain/aarsloen/aarsloenProjection';
import { buildVarigeMenReaderProjection } from '../../domain/varigemen/varigeMenReaderProjection';
import { buildForsoergertabReaderProjection } from '../../domain/forsoergertab/forsoergertabReaderProjection';
import { buildErhvervsevnetabReaderProjection } from '../../domain/erhvervsevnetab/erhvervsevnetabReaderProjection';
import { buildErstatningsopgoerelseReaderProjection } from '../../domain/erstatningsopgoerelse/erstatningsopgoerelseReaderProjection';
import { buildRenteberegningReaderProjection } from '../../domain/renteberegning/renteberegningReaderProjection';
import { referenceRates, surchargeRates } from '../../data/interestRates';

/**
 * VÆRN (BF-025): på en HELT NY, tom sag må intet enkelt valg i en dropdown eller på en kontakt udløse en
 * systemfejl.
 *
 * BF-025 var netop den handling: åbn programmet, gå til EO-oplysninger, sæt "Beregnes ud fra" til
 * "Angivet månedsløn" — og mød `eo_snapshot:hidden_angivet_loen_state_invalid`. Årsagen var, at et skjult
 * felt manglede en default, men KLASSEN er større: en systemfejl er per definition en tilstand, koden
 * erklærer umulig, og et brugervalg på en tom sag må aldrig kunne nå den. En systemfejl er ikke en
 * feltfejl brugeren kan rette; den er en påstand om, at programmet er i stykker.
 *
 * Fejningen er BEVIDST udtømmende og katalogdrevet, ikke en liste af scenarier: den henter valgmængden fra
 * hvert felts eget codec (`FieldCodec.options`), så et nyt valgfelt eller en ny enum-værdi automatisk er
 * dækket, uden at nogen husker at tilføje en case. De tidligere værn på samme klasse
 * (`eoReguleringInvariantReachability`) byggede deres fixture med `createErstatningsopgoerelseInitialValues`
 * — en fabrik produktionen IKKE bruger, og som netop udfyldte det felt, der manglede. Den var derfor
 * strukturelt ude af stand til at se fejlen. Denne fejning starter fra præcis den tilstand
 * `initializeInputRuntime` giver en ny sag.
 *
 * Kun STATISKE felter (uden entity-led) fejes: rækkefelter kræver en indsat række og hører derfor ikke til
 * "en tom sag rørt én gang".
 */

const { reportSystemIssueMock } = vi.hoisted(() => ({ reportSystemIssueMock: vi.fn() }));

vi.mock('../../utils/systemIssueReporter', () => ({
  reportSystemIssue: reportSystemIssueMock,
  createSystemIssueEnvelope: (input: unknown) => input,
  isSystemIssueLogData: () => false,
}));

type AnyDescriptor = FieldDescriptor<unknown>;

const catalog = getProductionInputCatalog();

/** Den tomme sag, præcis som `initializeInputRuntime` bygger den ved førstegangs-load (§1.12). */
const createFreshCase = (): SettledInput => {
  const empty = createEmptySettledInput();
  const seeded = seedSatserNewCase() ?? {};
  return catalog.validateSettledInput({
    sections: { ...empty.sections, ...seeded },
    rejectedInputs: {},
  });
};

const isStatic = (descriptor: AnyDescriptor): boolean =>
  descriptor.template.path.every((segment) => segment.kind === 'property');

const staticChoiceFields = (productionInputFields as readonly AnyDescriptor[])
  .filter(isStatic)
  .filter((descriptor) => descriptor.controlKind !== 'text');

const hasEnumerableOptions = (descriptor: AnyDescriptor): boolean =>
  descriptor.codec.options !== undefined && descriptor.codec.options.length > 0;

/** Alle statiske felter med en OPREGNELIG valgmængde — det fejningen kan udtømme. */
const sweepableFields = staticChoiceFields
  .filter(hasEnumerableOptions)
  .flatMap((descriptor) => (descriptor.codec.options ?? []).map((value) => ({ descriptor, value })));

/**
 * ÅBNE valgfelter: kontroltypen er en dropdown, men mængden kommer fra et datakatalog (overenskomster,
 * lønmodtager-/arbejdsgiverfiltre) og ikke fra feltets codec. De kan ikke udtømmes her.
 *
 * Listen er EKSPLICIT frem for stiltiende, så et nyt valgfelt uden opregnelig mængde bliver et bevidst valg
 * i stedet for et hul, fejningen tier om. Et felt hører kun hjemme her, hvis dets valgmængde beviseligt er
 * datadrevet — ikke fordi det er besværligt at opregne.
 */
const OPEN_ENDED_CHOICE_FIELD_IDS: readonly string[] = [
  'eo.eoAngivetLoenLoenudvikling.overenskomstId',
  'eo.eoAngivetLoenLoenudvikling.overenskomstFilter.loenmodtager',
  'eo.eoAngivetLoenLoenudvikling.overenskomstFilter.arbejdsgiver',
];

/** De rapporterede systemfejl som læsbare linjer, uafhængigt af mockens løse argumenttyper. */
const reportedSystemIssues = (): readonly string[] =>
  reportSystemIssueMock.mock.calls.map((call: readonly unknown[]) => {
    const payload = call[0] as Readonly<{ code?: string; userMessage?: string }> | undefined;
    return `${payload?.code ?? '?'}: ${payload?.userMessage ?? '?'}`;
  });

/** Kører HELE domænets læsesti, som siderne gør det — enhver uventet exception ender som en systemfejl. */
const runAllDomainProjections = (input: SettledInput): void => {
  const evaluation = createInputEvaluation({
    input,
    catalog,
    sourceToken: createEvaluationSourceToken(createInputRevision(1), createSettingsRevision(1)),
  });
  const reader = evaluation.reader;

  buildAarsloenReaderProjection(reader);
  buildVarigeMenReaderProjection(reader);
  buildForsoergertabReaderProjection(reader);
  buildErhvervsevnetabReaderProjection(reader);
  buildErstatningsopgoerelseReaderProjection(reader);
  buildRenteberegningReaderProjection({ reader, referenceRates, surchargeRates });
};

describe('tom sag: ét brugervalg må aldrig udløse en systemfejl', () => {
  beforeEach(() => {
    reportSystemIssueMock.mockReset();
  });

  it('den urørte, nyoprettede sag er i sig selv fri for systemfejl', () => {
    expect(() => runAllDomainProjections(createFreshCase())).not.toThrow();
    expect(reportSystemIssueMock.mock.calls).toEqual([]);
  });

  it.each(sweepableFields.map(({ descriptor, value }) => [`${descriptor.id} = ${String(value)}`, descriptor, value] as const))(
    '%s',
    (_navn, descriptor, value) => {
      const reduced = reduceInputCommand(createFreshCase(), setImmediateField(descriptor.bind(), value), catalog);

      expect(() => runAllDomainProjections(reduced.input)).not.toThrow();

      expect(reportedSystemIssues()).toEqual([]);
    }
  );

  it('intet valgfelt slipper udenom fejningen uden at være erklæret åbent', () => {
    const uopregnelige = staticChoiceFields
      .filter((descriptor) => !hasEnumerableOptions(descriptor))
      .map((descriptor) => descriptor.id);

    expect(
      [...uopregnelige].sort(),
      'Valgfelter uden opregnelig mængde. Tilføj `options` til codecet, eller erklær feltet i '
      + 'OPEN_ENDED_CHOICE_FIELD_IDS med en begrundelse.'
    ).toEqual([...OPEN_ENDED_CHOICE_FIELD_IDS].sort());
  });

  it('fejningen dækker faktisk noget (ikke grøn af tomhed)', () => {
    const felter = new Set(sweepableFields.map(({ descriptor }) => descriptor.id));
    expect(felter.size).toBeGreaterThan(20);
    expect(sweepableFields.length).toBeGreaterThan(50);
    // Feltet fra BF-025's reproduktion skal være med — ellers måler fejningen ikke den handling, den findes for.
    expect(felter).toContain('eo.beregnesUdFra');
  });

  it('en systemfejl fra et domænekald FANGES af fejningen (mutationstest)', () => {
    // Mutationen rammer detektionen, ikke testdataene: rapporteres en systemfejl under et fejet valg,
    // SKAL assertionen ovenfor blive rød. Uden denne kontrol kunne mocken stille være afkoblet.
    reportSystemIssueMock({ code: 'test:injiceret', userMessage: 'injiceret' });
    expect(reportedSystemIssues()).toEqual(['test:injiceret: injiceret']);
  });
});
