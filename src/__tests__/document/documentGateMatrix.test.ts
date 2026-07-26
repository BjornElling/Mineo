/**
 * Den udtømmende matrix, del 2: GATE-cases pr. output (Fase 5, pass 7).
 *
 * Planens fire input-klasser er per-definition og kan derfor ikke testes generisk:
 *
 *   - relevant ugyldigt FORMAT (`reason: 'invalid'`) — uparselig råtekst
 *   - relevant BOUNDS-/range-fejl — parselig værdi uden for descriptorens interval
 *   - relevant MISSING-fejl — outputtet har et required input, der ikke er udfyldt
 *   - relevant WARNING — må ALDRIG blokere
 *   - IKKE-relevant fejl — en fejl i en sektion, outputtet ikke afhænger af, må ALDRIG blokere
 *
 * **`invalid` og `bounds` holdes som SEPARATE klasser** (§A2a). De ligner hinanden i UI'et — begge
 * giver et rødt felt — men de opstår i hver sit lag: `invalid` er codec'ets afvisning af råteksten,
 * `bounds` er en descriptor-validator på en værdi, codec'et accepterede. En test, der kun dækkede
 * den ene, ville ikke opdage, hvis den anden holdt op med at blokere.
 *
 * De fem definitionsUAFHÆNGIGE cases (settle, revisionsskift, programmatisk aktivering, ingen
 * fil-I/O ved blokering) ligger i `documentLifecycleMatrix.test.ts` — se noten dér for hvorfor de
 * ikke gentages 21 gange.
 */
import {
  createEvaluationSourceToken,
  createInputEvaluation,
  createInputRevision,
  createSettingsRevision,
  reduceInputCommand,
  settleField,
  type FieldRef,
  type SettledInput,
} from '../../inputCore';
import { getProductionInputCatalog } from '../../inputCore/catalog/productionCatalog';
import { satserAargangField } from '../../inputCore/catalog/satserDescriptors';
import { forsoergertabTilkendtForPeriodeAarField } from '../../inputCore/catalog/forsoergertabDescriptors';
import {
  stamdataSkadedatoField,
  stamdataSkadelidteFodselsdatoField,
} from '../../inputCore/catalog/stamdataDescriptors';
import { varigeMenBeregningsdatoField, varigeMenMengradField } from '../../inputCore/catalog/varigeMenDescriptors';
import { renteberegningBeregningsdatoField } from '../../inputCore/catalog/renteberegningDescriptors';
import { createDocumentSourceContext } from '../../document/definition/documentSourceContext';
import type { DocumentDefinition } from '../../document/definition/documentDefinition';
import { __createTestSourceSettings, type SourceSettings } from '../../settings/sourceSettings';
import { satserDocumentDefinition } from '../../domain/satser/satserDocumentDefinition';
import { varigeMenDocumentDefinition } from '../../domain/varigemen/varigeMenDocumentDefinition';
import { forsoergertabDocumentDefinition } from '../../domain/forsoergertab/forsoergertabDocumentDefinition';
import { renteOversigtDocumentDefinition } from '../../domain/renteberegning/renteberegningDocumentDefinitions';

const catalog = getProductionInputCatalog();

// Bygges gennem projektoren, ikke som objektliteral: `SourceSettings` er nominel, så et snapshot
// kan ikke længere fremstilles uden om `projectSourceSettings` (WI-009). Nøglesættet kommer fortsat
// fra typen — override er `Partial<SourceSettingsPayload>` — så en ny brevhoved-flade fejler her
// frem for at blive skjult bag et `as`.
const SETTINGS: SourceSettings = __createTestSourceSettings({
  documentDownloadFormat: 'pdf',
  brevhovedIndstillinger: {
    satser: false, renteberegning: false, regulering: false, varigeMen: false,
    aarsloensberegning: false, shDage: false, forsoergertab: false,
    erstatningsopgoerelse: false, erhvervsevnetab: false,
  },
  allowReguleringMedOverenskomstDerIkkeDaekkerHelePerioden: false,
  allowReguleringMedUdloebMedMaaneder: 0,
});

const empty = (): SettledInput => catalog.validateSettledInput({
  sections: {
    stamdata: null, satser: null, aarsloen: null, faellesAarsloen: null, renteberegning: null,
    varigemen: null, forsoergertab: null, erstatningsopgoerelse: null, erhvervsevnetab: null,
  },
  rejectedInputs: {},
});

type AnyInputCommand = Parameters<typeof reduceInputCommand>[1];

const dispatch = (input: SettledInput, command: AnyInputCommand): SettledInput => {
  const result = reduceInputCommand(input, command, catalog);
  return result.changed ? result.input : input;
};

const settle = <T>(field: FieldRef<T>, raw: string): AnyInputCommand => settleField(field, raw) as AnyInputCommand;

/** Evaluerer en definitions gate mod et konkret afsluttet input. */
const gateOf = <TInput>(
  definition: DocumentDefinition<void, TInput, SourceSettings, string>,
  input: SettledInput
) => {
  const evaluation = createInputEvaluation({
    input,
    catalog,
    sourceToken: createEvaluationSourceToken(createInputRevision(1), createSettingsRevision(1)),
  });
  return definition.project(createDocumentSourceContext(evaluation, SETTINGS), undefined);
};

const expectBlocked = (
  result: ReturnType<typeof gateOf>,
  what: string
): void => {
  expect(result.status, what).toBe('blocked');
  if (result.status !== 'blocked') return;
  // "Ingen usynlig blokering": årsagslisten er non-empty og bærer en synlig tekst.
  expect(result.reasons.length, `${what}: tom årsagsliste`).toBeGreaterThan(0);
  expect(result.reasons[0].message.trim(), `${what}: tom besked`).not.toBe('');
};

/** Gyldig stamdata; bruges som "ikke-relevant sektion" i flere cases. */
const withStamdata = (input: SettledInput): SettledInput => {
  const next = dispatch(input, settle(stamdataSkadelidteFodselsdatoField.bind(), '01-01-1980'));
  return dispatch(next, settle(stamdataSkadedatoField.bind(), '01-01-2020'));
};

// ---------------------------------------------------------------------------------------------
// satser — årstal er et required, gate-bærende input
// ---------------------------------------------------------------------------------------------

describe('gate-matrix: satser', () => {
  const ready = () => dispatch(withStamdata(empty()), settle(satserAargangField.bind(), '2024'));

  it('baseline: et gyldigt årstal giver ready', () => {
    expect(gateOf(satserDocumentDefinition, ready()).status).toBe('ready');
  });

  it('klasse INVALID (format): uparselig råtekst i årstallet blokerer', () => {
    // Codec'et kan ikke omsætte 'abc' til et årstal → `reason: 'invalid'`.
    const input = dispatch(withStamdata(empty()), settle(satserAargangField.bind(), 'abc'));
    expectBlocked(gateOf(satserDocumentDefinition, input), 'satser/invalid');
  });

  it('klasse BOUNDS: et parseligt årstal uden for satshorisonten blokerer — en ANDEN klasse end invalid', () => {
    // '1800' er et gyldigt HELTAL (codec'et accepterer det); det er bounds-validatoren der afviser.
    const input = dispatch(withStamdata(empty()), settle(satserAargangField.bind(), '1800'));
    expectBlocked(gateOf(satserDocumentDefinition, input), 'satser/bounds');
  });

  it('klasse MISSING: intet årstal blokerer (outputtet har et required input)', () => {
    expectBlocked(gateOf(satserDocumentDefinition, withStamdata(empty())), 'satser/missing');
  });

  it('klasse IKKE-RELEVANT: en fejl i en fremmed sektion blokerer IKKE', () => {
    // Varige mén-sektionen er irrelevant for satser-dokumentet.
    const input = dispatch(ready(), settle(varigeMenMengradField.bind(), '999'));
    expect(gateOf(satserDocumentDefinition, input).status).toBe('ready');
  });
});

// ---------------------------------------------------------------------------------------------
// varige mén — méngrad + beregningsdato er required; stamdata-datoer er en relevant dependency
// ---------------------------------------------------------------------------------------------

describe('gate-matrix: varigemen', () => {
  const ready = () => {
    const next = dispatch(withStamdata(empty()), settle(varigeMenMengradField.bind(), '10'));
    return dispatch(next, settle(varigeMenBeregningsdatoField.bind(), '01-01-2021'));
  };

  it('baseline: et komplet input giver ready', () => {
    expect(gateOf(varigeMenDocumentDefinition, ready()).status).toBe('ready');
  });

  it('klasse INVALID (format): uparselig beregningsdato blokerer', () => {
    const input = dispatch(ready(), settle(varigeMenBeregningsdatoField.bind(), 'ikke-en-dato'));
    expectBlocked(gateOf(varigeMenDocumentDefinition, input), 'varigemen/invalid');
  });

  it('klasse BOUNDS: en méngrad uden for 1..120 blokerer', () => {
    const input = dispatch(ready(), settle(varigeMenMengradField.bind(), '121'));
    expectBlocked(gateOf(varigeMenDocumentDefinition, input), 'varigemen/bounds');
  });

  it('klasse MISSING: manglende beregningsdato blokerer', () => {
    const input = dispatch(withStamdata(empty()), settle(varigeMenMengradField.bind(), '10'));
    expectBlocked(gateOf(varigeMenDocumentDefinition, input), 'varigemen/missing');
  });

  it('klasse RELEVANT-KRYDSSEKTION: byttet datoorden i stamdata blokerer', () => {
    // Stamdata er en relevant dependency her — modsat satser-casen ovenfor.
    let input = dispatch(ready(), settle(stamdataSkadelidteFodselsdatoField.bind(), '02-01-2020'));
    input = dispatch(input, settle(stamdataSkadedatoField.bind(), '01-01-2020'));
    expectBlocked(gateOf(varigeMenDocumentDefinition, input), 'varigemen/krydssektion');
  });

  it('klasse IKKE-RELEVANT: en fejl i satser-sektionen blokerer IKKE', () => {
    const input = dispatch(ready(), settle(satserAargangField.bind(), 'abc'));
    expect(gateOf(varigeMenDocumentDefinition, input).status).toBe('ready');
  });
});

// ---------------------------------------------------------------------------------------------
// forsørgertab — tilkendt periode har både format- og bounds-grænse
// ---------------------------------------------------------------------------------------------

describe('gate-matrix: forsoergertab', () => {
  it('klasse BOUNDS: en tilkendt periode uden for 1..10 blokerer', () => {
    const input = dispatch(withStamdata(empty()), settle(forsoergertabTilkendtForPeriodeAarField.bind(), '11'));
    expectBlocked(gateOf(forsoergertabDocumentDefinition, input), 'forsoergertab/bounds');
  });

  it('klasse INVALID (format): uparselig tilkendt periode blokerer', () => {
    const input = dispatch(withStamdata(empty()), settle(forsoergertabTilkendtForPeriodeAarField.bind(), 'x'));
    expectBlocked(gateOf(forsoergertabDocumentDefinition, input), 'forsoergertab/invalid');
  });

  it('klasse MISSING: et tomt forsørgertab blokerer', () => {
    expectBlocked(gateOf(forsoergertabDocumentDefinition, withStamdata(empty())), 'forsoergertab/missing');
  });
});

// ---------------------------------------------------------------------------------------------
// rente-oversigt — beregningsdato + mindst én gyldig række
// ---------------------------------------------------------------------------------------------

describe('gate-matrix: rente-oversigt', () => {
  it('klasse MISSING: ingen rentekrav-rækker blokerer', () => {
    const input = dispatch(withStamdata(empty()), settle(renteberegningBeregningsdatoField.bind(), '31-12-2024'));
    expectBlocked(gateOf(renteOversigtDocumentDefinition, input), 'rente-oversigt/missing-rows');
  });

  it('klasse INVALID (format): uparselig beregningsdato blokerer', () => {
    const input = dispatch(withStamdata(empty()), settle(renteberegningBeregningsdatoField.bind(), '99-99-9999'));
    expectBlocked(gateOf(renteOversigtDocumentDefinition, input), 'rente-oversigt/invalid');
  });

  it('klasse MISSING: manglende beregningsdato blokerer', () => {
    expectBlocked(gateOf(renteOversigtDocumentDefinition, withStamdata(empty())), 'rente-oversigt/missing-dato');
  });
});

// ---------------------------------------------------------------------------------------------
// Warnings blokerer aldrig — på tværs af outputs
// ---------------------------------------------------------------------------------------------

describe('gate-matrix: warnings blokerer intet', () => {
  /**
   * Warning-klassen kan ikke fremprovokeres med et enkelt feltcommit på de simple outputs — den
   * opstår i domænernes egne advarsler (fx TAF-dækning, reguleringsdækning). Invarianten
   * håndhæves derfor dér, hvor advarslerne dannes, og verificeres her på det strukturelle niveau:
   * gaten læser KUN `blocked`-tilstanden fra sin projektion, aldrig en advarselsliste.
   *
   * Konkret: en ready-projektion med advarsler giver `ready`. Hvis en definition begyndte at
   * blokere på warnings, ville dens `project` skulle læse en advarselskilde — og det gør ingen af
   * dem. Det er verificeret ved læsning og fastholdt af de per-domæne-gates' egne tests
   * (fx `erstatningsopgoerelseDownloadGate`-suiten), som dækker advarsler direkte.
   */
  it('en gyldig sag med advarsler i en irrelevant sektion forbliver ready', () => {
    // Satser-dokumentet med et gyldigt år; varige mén-sektionen bærer en fejl (og dermed også de
    // advarsler, dens projektion måtte danne). Ingen af delene må røre satser-gaten.
    let input = dispatch(withStamdata(empty()), settle(satserAargangField.bind(), '2024'));
    input = dispatch(input, settle(varigeMenMengradField.bind(), '121'));
    expect(gateOf(satserDocumentDefinition, input).status).toBe('ready');
  });
});
