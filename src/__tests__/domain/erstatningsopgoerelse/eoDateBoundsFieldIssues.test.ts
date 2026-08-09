// @vitest-environment jsdom
import { getProductionInputCatalog } from '../../../inputCore/catalog/productionCatalog';
import { createInputEvaluation } from '../../../inputCore/inputReader';
import {
  createEvaluationSourceToken,
  createInputRevision,
  createSettingsRevision,
} from '../../../inputCore/evaluationSource';
import { serializeFieldAddress } from '../../../inputCore/fieldAddress';
import { resolveFieldIssueTooltip } from '../../../inputCore/inputIssue';
import {
  eoDifferencekravDatoField,
  eoEndeligEETAfgoerelseDatoField,
  eoEndeligEETVirkningsdatoField,
  eoMenAfgoerelseDatoField,
  eoMidlertidigEETAfgoerelseDatoField,
  eoMidlertidigEETVirkningsdatoField,
  eoOpgørelseLavetDenField,
  eoSvieSmertePeriodeFraField,
  eoTafPeriodeFraField,
  eoVedroererPeriodeTilField,
} from '../../../inputCore/catalog/erstatningsopgoerelseDescriptors';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { toISODateString } from '../../../types/branded';
import type { ErstatningsopgoerelseValues, StamdataValues } from '../../../schemas/formSchemas';

// Runtime-auditens OBS-022–024: EO's DEKLAREREDE datogrænser blev ikke håndhævet.
//
// Fundene var, at datoer før skadedagen — og efter konfigurationens maksimum — kunne AFSLUTTES canonical
// med `aria-invalid=false`, uden feltfejl, uden tooltip og uden at blokere PDF-gaten. Årsagen var ikke
// lokal for de tre observerede felter: `dateRanges.ts` deklarerede grænserne, men intet bandt
// deklarationen til en validator, så 31 af 54 datofelter havde ingen grænser overhovedet.
//
// Testen måler den brugersynlige ende af rettelsen: at et afsluttet input uden for grænserne producerer
// et `bounds`-issue på FELTETS adresse (den, UI'et tegner den røde ring på) med den KONKRETE besked.
// `dateFieldsDeclareBounds.test.ts` dækker bredden — hvert eneste datofelt; denne fil dækker dybden for
// de scenarier, auditten faktisk observerede i browseren.

const catalog = getProductionInputCatalog();

const SKADEDATO = '2020-01-01';

const stamdata: StamdataValues = {
  journalnr: 'J-1',
  advokat: 'Advokat A',
  sagsbehandler: 'Sagsbehandler S',
  skadelidte: 'Test Testesen',
  skadestype: 'Arbejdsulykke',
  skadedato: toISODateString(SKADEDATO),
  skadelidteFodselsdato: toISODateString('1980-01-01'),
};

const buildReader = (eo: ErstatningsopgoerelseValues) => {
  const input = catalog.validateSettledInput({
    sections: {
      stamdata, satser: null, aarsloen: null, faellesAarsloen: null,
      renteberegning: null, varigemen: null, forsoergertab: null,
      erstatningsopgoerelse: eo, erhvervsevnetab: null,
    },
    rejectedInputs: {},
  });
  const sourceToken = createEvaluationSourceToken(createInputRevision(1), createSettingsRevision(1));
  return createInputEvaluation({ input, catalog, sourceToken });
};

const baseEo = (): ErstatningsopgoerelseValues => ({
  ...createErstatningsopgoerelseInitialValues(),
  eoNummer: 'EO-1',
  loenindkomstAnsaettelsesforhold: [],
});

const issueAt = (
  evaluation: ReturnType<typeof buildReader>,
  field: { address: Parameters<typeof serializeFieldAddress>[0] }
) => evaluation.issues.get(serializeFieldAddress(field.address));

/** Dagen før skadedagen — den værdi, OBS-023 observerede blev accepteret canonical. */
const DAGEN_FOER_SKADEN = toISODateString('2019-12-31');

describe('OBS-023: EO’s AES-datofelter afviser datoer før skadedagen', () => {
  // Auditten afsluttede alle fem som canonical med `aria-invalid=false`, mens Forligsdato — det ENE
  // felt med en håndskrevet validator — afviste samme værdi. Kontrasten var beviset for, at manglen
  // lå i bindingen og ikke i reglen.
  const aesFelter = [
    ['Mén-afgørelsesdato', eoMenAfgoerelseDatoField, { menAfgoerelseDato: DAGEN_FOER_SKADEN }],
    ['Midlertidigt EET-afgørelsesdato', eoMidlertidigEETAfgoerelseDatoField, { midlertidigEETAfgoerelseDato: DAGEN_FOER_SKADEN }],
    ['Midlertidigt EET-virkningsdato', eoMidlertidigEETVirkningsdatoField, { midlertidigEETVirkningsdato: DAGEN_FOER_SKADEN }],
    ['Endeligt EET-afgørelsesdato', eoEndeligEETAfgoerelseDatoField, { endeligEETAfgoerelseDato: DAGEN_FOER_SKADEN }],
    ['Endeligt EET-virkningsdato', eoEndeligEETVirkningsdatoField, { endeligEETVirkningsdato: DAGEN_FOER_SKADEN }],
  ] as const;

  it.each(aesFelter)('%s markeres rødt med skadedagen nævnt', (_label, field, patch) => {
    const issue = issueAt(buildReader({ ...baseEo(), ...patch }), field.bind());

    expect(issue?.reason).toBe('bounds');
    // Den konkrete besked — ikke en generisk «Fejl i indtastning». Den nævner datoen, brugeren skal
    // rette imod, hvilket er hele forskellen på en handlingsanvisende og en gådefuld fejl.
    expect(issue?.message).toBe('Datoen kan ikke være før skadesdagen (01-01-2020)');
    // §4: `bounds` vises ORDRET i tooltippet. Blev den forkortet, ville skadedagen forsvinde.
    expect(resolveFieldIssueTooltip(issue!)).toBe(issue!.message);
  });

  it('en dato PÅ skadedagen er lovlig (grænsen er inklusiv)', () => {
    const evaluation = buildReader({ ...baseEo(), menAfgoerelseDato: toISODateString(SKADEDATO) });
    expect(issueAt(evaluation, eoMenAfgoerelseDatoField.bind())).toBeUndefined();
  });
});

describe('OBS-022: EO’s topfelter håndhæver deres deklarerede grænser', () => {
  it('«Opgørelse lavet den» før skadedagen markeres rødt', () => {
    const issue = issueAt(
      buildReader({ ...baseEo(), opgørelseLavetDen: DAGEN_FOER_SKADEN }),
      eoOpgørelseLavetDenField.bind(),
    );
    expect(issue?.reason).toBe('bounds');
    expect(issue?.message).toBe('Datoen kan ikke være før skadesdagen (01-01-2020)');
  });

  it('«Differencekravsdato» før skadedagen markeres rødt', () => {
    const issue = issueAt(
      buildReader({ ...baseEo(), differencekravDato: DAGEN_FOER_SKADEN }),
      eoDifferencekravDatoField.bind(),
    );
    expect(issue?.reason).toBe('bounds');
    expect(issue?.message).toBe('Datoen kan ikke være før skadesdagen (01-01-2020)');
  });

  it('«Vedrører periode til» efter konfigurationens maksimum markeres rødt', () => {
    // Auditten satte til-datoen ét år+ ud i fremtiden og så den blive canonical. Grænsen er
    // «31-12 året efter indeværende», så en dato langt derude skal give et bounds-issue.
    const langtUdeIFremtiden = toISODateString('2099-12-31');
    const issue = issueAt(
      buildReader({
        ...baseEo(),
        vedroererPeriodeFra: toISODateString('2020-01-01'),
        vedroererPeriodeTil: langtUdeIFremtiden,
      }),
      eoVedroererPeriodeTilField.bind(),
    );
    expect(issue?.reason).toBe('bounds');
  });
});

describe('OBS-024: EO-tabellernes datoceller håndhæver deres deklarerede grænser', () => {
  // Grænsen fandtes i rækkeevaluerings-motoren, men kun som et kolonne-hint (`{ message, field }`).
  // Et hint er ikke en feltadresse, så cellen kunne aldrig blive rød. Nu er reglen på descriptoren.
  it('svie/smerte-rækkens fra-dato før skadedagen markeres rødt på CELLENS adresse', () => {
    const eo = baseEo();
    const row = eo.svieSmertePerioder[0];
    expect(row, 'testen forudsætter en initial svie/smerte-række').toBeDefined();

    const evaluation = buildReader({
      ...eo,
      svieSmertePerioder: [{ ...row!, fra: DAGEN_FOER_SKADEN }],
    });
    const issue = issueAt(evaluation, eoSvieSmertePeriodeFraField.bind(row!.id));

    expect(issue?.reason).toBe('bounds');
    expect(issue?.message).toBe('Datoen kan ikke være før skadesdagen (01-01-2020)');
  });

  it('TAF-rækkens fra-dato før skadedagen markeres rødt på CELLENS adresse', () => {
    const eo = baseEo();
    const row = eo.tafPerioder[0];
    expect(row, 'testen forudsætter en initial TAF-række').toBeDefined();

    const evaluation = buildReader({
      ...eo,
      tafPerioder: [{ ...row!, fra: DAGEN_FOER_SKADEN }],
    });
    const issue = issueAt(evaluation, eoTafPeriodeFraField.bind(row!.id));

    expect(issue?.reason).toBe('bounds');
    expect(issue?.message).toBe('Datoen kan ikke være før skadesdagen (01-01-2020)');
  });
});
