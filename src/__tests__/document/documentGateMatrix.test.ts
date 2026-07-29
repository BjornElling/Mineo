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
  setImmediateField,
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
// Warning-benet (R8-F05): ÆGTE domæne-warnings + motor-spy. Se suitens egen note nederst.
import { mapReadyProjection, runProjection } from '../../inputCore/projection';
import { projectEoSave } from '../../persistence/eoSaveProjection';
import { buildErhvervsevnetabReaderProjection } from '../../domain/erhvervsevnetab/erhvervsevnetabReaderProjection';
import { evaluateEetFaneDownloadGate } from '../../domain/erhvervsevnetab/erhvervsevnetabDownloadGate';
import {
  erhvervsevnetabBeregningsdatoField,
  erhvervsevnetabKoenField,
  aslAfgoerelseAfgoerelsesDatoField,
  aslAfgoerelseAfgoerelseTypeField,
  aslAfgoerelseEetPctField,
  aslAfgoerelseVirkningsDatoField,
  erhvervsevnetabAslAfgoerelserCollectionRef,
} from '../../inputCore/catalog/erhvervsevnetabDescriptors';
import { faellesAarsloenAslAarsloenField } from '../../inputCore/catalog/faellesAarsloenDescriptors';
import { emptyAslAfgoerelseRowFields } from '../../domain/erhvervsevnetab/eetAslAfgoerelser';
import { insertRow } from '../../inputCore/inputReducer';

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

/** En reader over et afsluttet input; samme konstruktion som produktionens evaluering. */
const readerFor = (input: SettledInput) => createInputEvaluation({
  input,
  catalog,
  sourceToken: createEvaluationSourceToken(createInputRevision(1), createSettingsRevision(1)),
}).reader;

const ASL_ROW_ID = 'eet_asl_warning_row';

/**
 * En komplet, gyldig EET-sag hvis ENESTE afvigelse er en ægte advarsel: et erhvervsevnetab på 10 %
 * udløser `warn-asl-eet-under-15` i løbende-ydelser-beregningen. Ingen feltfejl, ingen manglende
 * required-felter — netop derfor kan testen skelne "warning blokerer ikke" fra "der var intet at
 * blokere på".
 */
const eetCaseWithUnderFifteenPercent = (): SettledInput => {
  let input = withStamdata(empty());
  input = dispatch(input, settle(faellesAarsloenAslAarsloenField.bind(), '480.000'));
  input = dispatch(input, settle(erhvervsevnetabBeregningsdatoField.bind(), '19-03-2026'));
  // Choice-felter committer immediate (§1.3); reduceren afviser `settleField` for dem.
  input = dispatch(input, setImmediateField(erhvervsevnetabKoenField.bind(), 'Kvinde') as AnyInputCommand);
  input = dispatch(input, insertRow(
    erhvervsevnetabAslAfgoerelserCollectionRef,
    { id: ASL_ROW_ID, ...emptyAslAfgoerelseRowFields }
  ) as AnyInputCommand);
  input = dispatch(input, settle(aslAfgoerelseAfgoerelsesDatoField.bind(ASL_ROW_ID), '01-02-2026'));
  input = dispatch(input, settle(aslAfgoerelseVirkningsDatoField.bind(ASL_ROW_ID), '01-02-2026'));
  input = dispatch(input, setImmediateField(
    aslAfgoerelseAfgoerelseTypeField.bind(ASL_ROW_ID), 'Midlertidig'
  ) as AnyInputCommand);
  // Under 15 % → den ægte advarsel. Værdien er canonical og gyldig; grænsen er en advarsel, ikke bounds.
  input = dispatch(input, settle(aslAfgoerelseEetPctField.bind(ASL_ROW_ID), '10'));
  return input;
};

describe('gate-matrix: warnings blokerer intet (§7.3, §10-kriterium 13)', () => {
  /**
   * **Denne suite er omskrevet i etape 10 (R8-F05).** Den tidligere test hed "en gyldig sag med
   * advarsler i en irrelevant sektion forbliver ready" og skabte INGEN warning: den committede en
   * bounds-fejl på `varigeMenMengrad` — altså §7.3's IKKE-RELEVANT-dimension, som allerede er dækket
   * af `klasse IKKE-RELEVANT`-benene ovenfor. Warning-benet var dermed falsk dækket: en regression,
   * hvor warnings begyndte at blokere, kunne bestå den deklarerede matrix.
   *
   * **Hvor warnings faktisk findes.** Kortlægningen viste, at `ProjectionCollector.warn` og
   * `InputIssue`s `Warning`-variant havde NUL producenter og NUL læsere i produktionen (INC-F17,
   * slettet). Warnings dannes i domænernes egne typer — `EetIssue.severity`, `EoRowStatus`,
   * `IntegrityIssue.severity` — og det er derfor DEM, invarianten skal måles på. En syntetisk
   * `collector.warn`-fixture ville have målt en kanal, ingen produktionskode bruger, og dermed været
   * en fjerde variant af R0-F02's fejlklasse.
   *
   * De to tests nedenfor dækker de tre konsekvenskanaler, en ægte warning kan nå: beregningen
   * (bliver den udført?), dokumentgaten (blokerer den?) og `.eo` (kan sagen gemmes?). Den fjerde —
   * UI'et — hører til feltets egen visning og ejes af feltkontrakten.
   */
  it('en ÆGTE domæne-warning blokerer hverken beregning, dokumentgate eller .eo', () => {
    // EET under 15 % udløser den ægte advarsel `warn-asl-eet-under-15` i eetLoebendeYdelser-
    // beregningen. Sagen er i øvrigt komplet og gyldig — advarslen er den ENESTE afvigelse.
    const input = eetCaseWithUnderFifteenPercent();
    const { snapshot } = buildErhvervsevnetabReaderProjection(readerFor(input));

    const fane = snapshot.loebendeYdelser;
    const warnings = fane.issues.filter((issue) => issue.severity === 'warning');
    // Fixturens forudsætning: der ER en warning, og der er INGEN fejl. Uden begge ben måler resten
    // af testen ingenting — præcis den tomhed, fundet påpegede.
    expect(warnings.map((issue) => issue.id)).toContain('warn-asl-eet-under-15');
    expect(fane.issues.filter((issue) => issue.severity === 'error')).toEqual([]);

    // (1) BEREGNINGEN blev udført på trods af advarslen.
    expect(fane.hasBlockingErrors).toBe(false);
    expect(fane.computation, 'en warning må ikke forhindre beregningen').not.toBeNull();

    // (2) DOKUMENTGATEN tillader download.
    expect(evaluateEetFaneDownloadGate('loebendeYdelser', fane).canDownload).toBe(true);

    // (3) `.eo`-SAVE er ikke blokeret: warnings er ikke rejected råtekst (§1.6).
    expect(projectEoSave(input, catalog).status).toBe('ready');
  });

  /**
   * §7.3's sidste punkt som sin egen assertion: *beregningsmotor kaldes aldrig fra en blocked
   * projektion.* Sweepet i R8-F05 fandt ingen eksplicit spy-assertion på netop den invariant —
   * kun tests, der målte at RESULTATET var fraværende. Forskellen er load-bearing: en motor, der
   * kaldes og hvis resultat kastes væk, ville bestå en resultat-assertion, men kunne kaste,
   * mutere eller regne på et maskeret input.
   */
  it('en blocked projektion kalder ALDRIG beregningsmotoren', () => {
    const engine = vi.fn((value: number) => value * 2);

    // Blokeret: `require` på et tomt felt giver en missing-consumerfejl.
    const blocked = mapReadyProjection(
      runProjection(readerFor(empty()), 'test-aggregate', (collector) => {
        const read = collector.require(satserAargangField.bind());
        return read.status === 'usable' ? read.value : undefined;
      }),
      engine
    );
    expect(blocked.status).toBe('blocked');
    expect(engine, 'motoren blev kaldt fra en blocked projektion').not.toHaveBeenCalled();

    // Kontrol i modsat retning: ved ready KALDES motoren — ellers målte assertionen ovenfor blot,
    // at helperen aldrig kalder noget.
    const ready = mapReadyProjection(
      runProjection(
        readerFor(dispatch(empty(), settle(satserAargangField.bind(), '2024'))),
        'test-aggregate',
        (collector) => {
          const read = collector.require(satserAargangField.bind());
          return read.status === 'usable' ? read.value : undefined;
        }
      ),
      engine
    );
    expect(ready.status).toBe('ready');
    expect(engine).toHaveBeenCalledTimes(1);
  });
});
