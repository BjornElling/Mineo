/**
 * Fase 7 acceptmatrix punkt 14, FORMAT-benet (WI-013).
 *
 * Punkt 14 kræver "hvert dokumentdomæne og begge outputformater". Domænesiden er dækket:
 * `documentCatalogCompleteness.test.ts` binder alle 21 outputs til én definition hver, og
 * parity-suiterne (`tableChannelParity.golden`, `eoSectionTableParity.golden`) asserterer hver fixture
 * for BÅDE PDF-presentation og Word-`document.xml`. Formatsiden havde derimod et hul, og det er
 * strukturelt frem for kosmetisk:
 *
 *   - `documentGateMatrix.test.ts` pinner `documentDownloadFormat: 'pdf'` for alle sine cases.
 *   - Ingen test svarede generisk på spørgsmålet "MÅ en gate afhænge af det valgte downloadformat?"
 *
 * At intet forhindrer det, er pointen: `DocumentSourceContext.settings` ER hele `SourceSettings`, og
 * `documentDownloadFormat` er et felt på den (`sourceSettings.ts:12`). Enhver definition KAN altså læse
 * formatet i sin `project`. Gjorde én det, ville et output kunne være `ready` som PDF og `blocked` som
 * Word (eller omvendt) — en usynlig, formatafhængig blokering, som §A2a's "samme definition til reaktiv
 * gate og click-preflight" ikke fanger, fordi begge kanaler ville se den samme skæve gate.
 *
 * Normen har ét svar for alle 18 hovedapp-outputs: **formatet vælger writer, ikke dækning.** Derfor
 * kan invarianten testes GENERISK over hele kataloget frem for som 18 kopier af fire cases — og derfor
 * udvides gate-matrixen med vilje IKKE til 21×4 (jf. dens egen note linje 3-19 om, at de fire
 * inputklasser er per-definition og ikke kan konstrueres generisk).
 *
 * Standalone MinProcesrente er uden for: dens definitioner har `TSettings = void` og kan strukturelt
 * ikke se et format.
 */
import {
  createEvaluationSourceToken,
  createInputEvaluation,
  createInputRevision,
  createSettingsRevision,
  reduceInputCommand,
  settleField,
  type SettledInput,
} from '../../inputCore';
import { getProductionInputCatalog } from '../../inputCore/catalog/productionCatalog';
import {
  stamdataSkadedatoField,
  stamdataSkadelidteFodselsdatoField,
} from '../../inputCore/catalog/stamdataDescriptors';
import { satserAargangField } from '../../inputCore/catalog/satserDescriptors';
import { varigeMenBeregningsdatoField, varigeMenMengradField } from '../../inputCore/catalog/varigeMenDescriptors';
import { createDocumentSourceContext } from '../../document/definition/documentSourceContext';
import type { DocumentDefinition } from '../../document/definition/documentDefinition';
import { __createTestSourceSettings, type SourceSettings } from '../../settings/sourceSettings';
import { satserDocumentDefinition } from '../../domain/satser/satserDocumentDefinition';
import { varigeMenDocumentDefinition } from '../../domain/varigemen/varigeMenDocumentDefinition';
import { forsoergertabDocumentDefinition } from '../../domain/forsoergertab/forsoergertabDocumentDefinition';
import {
  renteDocumentDefinition,
  renteOversigtDocumentDefinition,
} from '../../domain/renteberegning/renteberegningDocumentDefinitions';
import {
  reguleringDocumentDefinition,
  krlDocumentDefinition,
  klLoenaftalerDocumentDefinition,
} from '../../domain/erstatningsopgoerelse/reguleringDocumentDefinitions';
import {
  erstatningsopgoerelseDocumentDefinition,
  tafFordeltPaaAarDocumentDefinition,
  tafOpreguleretPaaAarDocumentDefinition,
  tafKravGrafDocumentDefinition,
} from '../../domain/erstatningsopgoerelse/eoDocumentDefinitions';
import {
  aarsloenDocumentDefinition,
  shDageDocumentDefinition,
} from '../../domain/aarsloen/aarsloenDocumentDefinitions';
import {
  kapitaliseringDocumentDefinition,
  efterEalDocumentDefinition,
  differencekravDocumentDefinition,
  loebendeYdelserDocumentDefinition,
} from '../../domain/erhvervsevnetab/eetDocumentDefinitions';
import { MINEO_DOCUMENT_OUTPUT_IDS } from '../../document/definition/documentOutputId';

const catalog = getProductionInputCatalog();

type AnyInputCommand = Parameters<typeof reduceInputCommand>[1];

const dispatch = (input: SettledInput, command: AnyInputCommand): SettledInput => {
  const result = reduceInputCommand(input, command, catalog);
  return result.changed ? result.input : input;
};

const empty = (): SettledInput => catalog.validateSettledInput({
  sections: {
    stamdata: null, satser: null, aarsloen: null, faellesAarsloen: null, renteberegning: null,
    varigemen: null, forsoergertab: null, erstatningsopgoerelse: null, erhvervsevnetab: null,
  },
  rejectedInputs: {},
});

const settingsFor = (documentDownloadFormat: 'pdf' | 'word'): SourceSettings => __createTestSourceSettings({
  documentDownloadFormat,
  brevhovedIndstillinger: {
    satser: false, renteberegning: false, regulering: false, varigeMen: false,
    aarsloensberegning: false, shDage: false, forsoergertab: false,
    erstatningsopgoerelse: false, erhvervsevnetab: false,
  },
  allowReguleringMedOverenskomstDerIkkeDaekkerHelePerioden: false,
  allowReguleringMedUdloebMedMaaneder: 0,
});

/**
 * Definitionerne har forskellige `TRequest`/`TInput`; listen holdes derfor på den bredeste fælles
 * form. Testen kalder kun `project`, hvis kontrakt er ens for alle 18.
 */
type AnyMineoDefinition = DocumentDefinition<unknown, unknown, SourceSettings, string>;

/**
 * En aktiveringsidentitet pr. definition, der HAR en. `void`-outputs får `undefined`. En request, der
 * ikke kan slås op, fail-closer identisk i begge formatkørsler, så invarians-assertionen holder
 * uanset om requesten resolverer — testen måler forskellen mellem to kørsler, ikke gate-udfaldet.
 */
const DEFINITIONS: readonly (readonly [AnyMineoDefinition, unknown])[] = ([
  [satserDocumentDefinition, undefined],
  [varigeMenDocumentDefinition, undefined],
  [forsoergertabDocumentDefinition, undefined],
  [renteOversigtDocumentDefinition, undefined],
  [renteDocumentDefinition, { rowId: 'findes-ikke' }],
  [reguleringDocumentDefinition, { scope: 'case' }],
  [krlDocumentDefinition, { scope: 'case' }],
  [klLoenaftalerDocumentDefinition, { scope: 'case' }],
  [erstatningsopgoerelseDocumentDefinition, undefined],
  [tafFordeltPaaAarDocumentDefinition, undefined],
  [tafOpreguleretPaaAarDocumentDefinition, undefined],
  [tafKravGrafDocumentDefinition, undefined],
  [aarsloenDocumentDefinition, undefined],
  [shDageDocumentDefinition, undefined],
  [kapitaliseringDocumentDefinition, undefined],
  [efterEalDocumentDefinition, undefined],
  [differencekravDocumentDefinition, undefined],
  [loebendeYdelserDocumentDefinition, undefined],
] as readonly (readonly [unknown, unknown])[]) as readonly (readonly [AnyMineoDefinition, unknown])[];

/** Projicerer én definition mod ét format. */
const projectWith = (
  definition: AnyMineoDefinition,
  request: unknown,
  input: SettledInput,
  format: 'pdf' | 'word'
): unknown => {
  const evaluation = createInputEvaluation({
    input,
    catalog,
    sourceToken: createEvaluationSourceToken(createInputRevision(1), createSettingsRevision(1)),
  });
  return definition.project(createDocumentSourceContext(evaluation, settingsFor(format)), request);
};

/** Et TOMT input (alt blokeret) og et delvist udfyldt (nogle outputs ready) — begge skal være formatblinde. */
const INPUTS: readonly (readonly [string, () => SettledInput])[] = [
  ['tomt input (gates blokerer)', empty],
  [
    'delvist udfyldt input (nogle gates er ready)',
    () => {
      let input = dispatch(empty(), settleField(stamdataSkadelidteFodselsdatoField.bind(), '01-01-1980') as AnyInputCommand);
      input = dispatch(input, settleField(stamdataSkadedatoField.bind(), '01-01-2020') as AnyInputCommand);
      input = dispatch(input, settleField(satserAargangField.bind(), '2024') as AnyInputCommand);
      input = dispatch(input, settleField(varigeMenMengradField.bind(), '10') as AnyInputCommand);
      return dispatch(input, settleField(varigeMenBeregningsdatoField.bind(), '01-01-2020') as AnyInputCommand);
    },
  ],
];

describe('dokumentgates er formatblinde (acceptmatrix punkt 14)', () => {
  /**
   * **Hvor stærk er denne test, og hvor er den svag?** (Tilføjet efter eksternt review, WI-013 R3.)
   *
   * En invarians-sammenligning af to `blocked`-resultater er svagere end af to `ready`: en definition,
   * der læste formatet i sin READY-gren, ville ikke blive fanget, hvis gaten aldrig nåede dertil.
   * Måling af de to inputtilstande ovenfor: 34 af 36 projektioner er `blocked`, kun 2 er `ready`.
   *
   * Det er en reel, kendt begrænsning, og den skjules ikke: testen nedenfor MÅLER, hvor mange
   * definitioner der faktisk nåede `ready`, og fejler, hvis tallet falder. Uden den assertion kunne
   * fixturen stille rådne til 0 `ready`, mens suiten forblev grøn — netop den slags tomhed, som fase 6
   * fandt i de inerte værn.
   *
   * Den fulde lukning er ikke en større fixture, men at fjerne capabilityen: `documentDownloadFormat`
   * bør ikke være synligt i projektionskonteksten overhovedet (formatet vælger writer EFTER gaten).
   * Det er en produktionsændring uden for Fase 7's accept-scope og ligger i **WI-014**.
   */
  it('mindst to definitioner nås i READY-grenen, så invariansen ikke kun måles på blocked', () => {
    const readyCount = DEFINITIONS.filter(([definition, request]) => {
      const result = projectWith(definition, request, INPUTS[1][1](), 'pdf') as { status: string };
      return result.status === 'ready';
    }).length;
    // Gulvet er den målte tilstand, ikke et ønske. Stiger dækningen, hæv tallet; falder den, er
    // format-invariansen blevet svagere, og det skal ses.
    expect(readyCount, 'ready-dækning i format-invariansen er faldet').toBeGreaterThanOrEqual(2);
  });

  it('dækker alle 18 katalogiserede hovedapp-outputs — listen kan ikke blive ufuldstændig', () => {
    // Uden denne binding ville en ny definition kunne tilføjes til kataloget UDEN at blive
    // formatkontrolleret, og testen ville fortsat være grøn. Samme fejlklasse som Fase 6's
    // dødt-værn-detektor: dækning skal kunne FEJLE, når målet vokser.
    expect(DEFINITIONS.map(([definition]) => definition.id).sort())
      .toEqual([...MINEO_DOCUMENT_OUTPUT_IDS].sort());
  });

  for (const [inputLabel, buildInput] of INPUTS) {
    describe(inputLabel, () => {
      for (const [definition, request] of DEFINITIONS) {
        it(`${definition.id}: samme projektion for pdf og word`, () => {
          const input = buildInput();
          const asPdf = projectWith(definition, request, input, 'pdf');
          const asWord = projectWith(definition, request, input, 'word');

          // Hele projektionen sammenlignes — ikke kun `status`. Ville en definition vælge en anden
          // dependency, en anden årsagsliste eller et andet datasæt ud fra formatet, fanges det her.
          expect(asWord, `${definition.id} projicerer forskelligt for word og pdf`).toEqual(asPdf);
        });
      }
    });
  }
});
