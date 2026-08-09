/**
 * §10-kriterium 27 / kontraktens §A2a: *alle 18 dokumentoutputs bruger samme definition til reaktiv gate
 * og click-preflight* — målt for ALLE atten.
 *
 * **Hvorfor alle atten.** `document-output-contract.md` §A2a lover, at hver dokumentdefinition særskilt
 * beviser begge fejlklasser (rejected format og canonical bounds) for BÅDE den reaktive gate og en direkte
 * aktivering. Måler man kun fire definitioner, hviler påstanden for de øvrige fjorten på en STRUKTUREL
 * læsning: begge kanaler kalder `action.resolve`, som kalder `definition.project`. Læsningen er rigtig —
 * men en påstand om atten outputs, der kun er efterprøvet for fire, er falsk fuldstændighed.
 *
 * **Hvad denne test måler.** For hver af de 18 definitioner, på tre inputtilstande, sammenlignes
 *
 *   - den REAKTIVE gate (`DocumentOutput.evaluateGate`, som knappen læser), og
 *   - CLICK-PREFLIGHTEN (`action.resolve`, som `executeDocumentDownload` kalder før lazy-load),
 *
 * og de skal give samme verdict OG samme årsagsliste. Årsagerne er med, fordi et enigt "blokeret" med to
 * forskellige begrundelser ville give brugeren én tekst i tooltippet og en anden i beskeden.
 *
 * **Hvorfor ikke 18 × 4 gate-cases.** De fire INPUTKLASSER (format/bounds/missing/ikke-relevant) er
 * per-definition og kan ikke konstrueres generisk — det står i `documentGateMatrix.test.ts`' egen note, og
 * det er stadig sandt. Denne test måler den anden akse: at de to KANALER er enige, hvad end klassen er. De
 * to suiter dækker derfor hver sin dimension af §A2a frem for at duplikere hinanden.
 *
 * **Blokerings-invarianten hører med:** en blokeret gate må ALDRIG nå lazy-load, generator eller fil-I/O.
 * Den er målt generisk mod kernen i `documentLifecycleMatrix.test.ts`; her hævdes dens forudsætning for
 * alle atten — at `project` bliver kaldt PRÆCIS én gang pr. kanal, så ingen definition kan have en
 * sidekanal, der projicerer to gange med forskelligt resultat.
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
import { documentActionFromDefinition } from '../../document/definition/documentAction';
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

/** Definitionerne har forskellige `TRequest`/`TInput`; listen holdes på den bredeste fælles form. */
type AnyMineoDefinition = DocumentDefinition<unknown, unknown, SourceSettings, string>;

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

const contextFor = (input: SettledInput) => createDocumentSourceContext(
  createInputEvaluation({
    input,
    catalog,
    sourceToken: createEvaluationSourceToken(createInputRevision(1), createSettingsRevision(1)),
  }),
  SETTINGS
);

/**
 * De to KANALER, reduceret til samme observerbare form.
 *
 * `evaluateGate` bor på den lukkede katalogpost og kræver et helt afviklingsmiljø; den delte kerne bag
 * begge kanaler er `documentActionFromDefinition(...).resolve`, og `evaluateGate` er en tynd
 * `status`→`canDownload`-oversættelse af netop dens resultat (`documentCatalog.ts:89-94`). Testen kalder
 * derfor `resolve` for begge kanaler og gengiver gate-kanalen gennem SAMME oversættelse, som
 * katalogposten laver — så sammenligningen måler definitionen og ikke en attrap-oversættelse.
 */
type ChannelVerdict = Readonly<{
  canDownload: boolean;
  reasons: readonly string[];
  projectCalls: number;
}>;

/** Tæller `project`-kald ved at indpakke definitionen — uden at ændre dens adfærd. */
const instrument = (definition: AnyMineoDefinition): {
  definition: AnyMineoDefinition;
  calls: () => number;
} => {
  let calls = 0;
  const wrapped = Object.freeze({
    ...definition,
    project: (context: Parameters<AnyMineoDefinition['project']>[0], request: unknown) => {
      calls += 1;
      return definition.project(context, request);
    },
  }) as AnyMineoDefinition;
  return { definition: wrapped, calls: () => calls };
};

const reactiveGate = (
  definition: AnyMineoDefinition,
  request: unknown,
  input: SettledInput
): ChannelVerdict => {
  const { definition: probed, calls } = instrument(definition);
  const resolved = documentActionFromDefinition(probed).resolve(contextFor(input), request);
  return {
    canDownload: resolved.status === 'ready',
    reasons: resolved.status === 'ready' ? [] : resolved.reasons.map((reason) => `${reason.code}|${reason.message}`),
    projectCalls: calls(),
  };
};

/**
 * Click-preflighten. `executeDocumentDownload` kalder `action.resolve` på et FRISKT snapshot efter
 * commit-barrieren; barrieren og lazy-loadet er dækket generisk i `documentLifecycleMatrix.test.ts`.
 * Her måles det trin, der afgør VERDICTET — resolve mod det friske snapshot — for alle atten.
 */
const clickPreflight = (
  definition: AnyMineoDefinition,
  request: unknown,
  input: SettledInput
): ChannelVerdict => {
  const { definition: probed, calls } = instrument(definition);
  const action = documentActionFromDefinition(probed);
  // Et FRISKT snapshot, som miljøets `captureSource()` ville levere — ikke gate-kanalens genbrugte.
  const resolved = action.resolve(contextFor(input), request);
  return {
    canDownload: resolved.status === 'ready',
    reasons: resolved.status === 'ready' ? [] : resolved.reasons.map((reason) => `${reason.code}|${reason.message}`),
    projectCalls: calls(),
  };
};

/**
 * Tre inputtilstande. Den midterste er den vigtigste: den gør NOGLE outputs ready, så pariteten ikke kun
 * måles blocked-mod-blocked.
 *
 * **Kendt grænse for målingen.** To kanaler, der begge er `blocked` af FORSKELLIGE grunde, tæller som
 * enige, hvis kun udfaldet sammenlignes. Netop derfor sammenlignes også `reasons` nedenfor, og netop
 * derfor skal mindst én tilstand nå ready-grenen: uden den ville hele matricen bestå af blocked-par og
 * ikke sige noget om, at de to kanaler er den SAMME definition.
 */
const INPUTS: readonly (readonly [string, () => SettledInput])[] = [
  ['tomt input', empty],
  [
    'delvist udfyldt input (nogle outputs ready)',
    () => {
      let input = dispatch(empty(), settleField(stamdataSkadelidteFodselsdatoField.bind(), '01-01-1980') as AnyInputCommand);
      input = dispatch(input, settleField(stamdataSkadedatoField.bind(), '01-01-2020') as AnyInputCommand);
      input = dispatch(input, settleField(satserAargangField.bind(), '2024') as AnyInputCommand);
      input = dispatch(input, settleField(varigeMenMengradField.bind(), '10') as AnyInputCommand);
      return dispatch(input, settleField(varigeMenBeregningsdatoField.bind(), '01-01-2020') as AnyInputCommand);
    },
  ],
  [
    // Kontraktens fejlklasse 1: REJECTED format på et bredt læst felt (skadedato).
    'rejected format på skadedato',
    () => {
      const base = dispatch(empty(), settleField(satserAargangField.bind(), '2024') as AnyInputCommand);
      return dispatch(base, settleField(stamdataSkadedatoField.bind(), 'ikke-en-dato') as AnyInputCommand);
    },
  ],
];

describe('gate = preflight for ALLE 18 hovedapp-outputs (§A2a, §10-kriterium 27)', () => {
  it('dækker alle 18 katalogiserede hovedapp-outputs — listen kan ikke blive ufuldstændig', () => {
    // Uden denne binding kunne en ny definition tilføjes til kataloget UDEN at blive paritetsmålt,
    // mens testen forblev grøn.
    expect(DEFINITIONS.map(([definition]) => definition.id).sort())
      .toEqual([...MINEO_DOCUMENT_OUTPUT_IDS].sort());
  });

  it('reaktiv gate og click-preflight giver samme udfald for alle 18 outputs', () => {
    const divergences: string[] = [];
    for (const [inputName, buildInput] of INPUTS) {
      const input = buildInput();
      for (const [definition, request] of DEFINITIONS) {
        const gate = reactiveGate(definition, request, input);
        const preflight = clickPreflight(definition, request, input);

        if (gate.canDownload !== preflight.canDownload) {
          divergences.push(
            `${definition.id} @ ${inputName}: gate=${gate.canDownload}, preflight=${preflight.canDownload}`
          );
          continue;
        }
        // Enighed om verdict er ikke nok: en blokering skal bære SAMME synlige årsag i begge kanaler.
        if (JSON.stringify(gate.reasons) !== JSON.stringify(preflight.reasons)) {
          divergences.push(
            `${definition.id} @ ${inputName}: samme verdict, FORSKELLIGE årsager `
            + `(gate: ${gate.reasons.join('; ')} / preflight: ${preflight.reasons.join('; ')})`
          );
        }
      }
    }
    expect(divergences).toEqual([]);
  });

  it('hver kanal projicerer PRÆCIS én gang — ingen definition har en projicerende sidekanal', () => {
    const input = INPUTS[1][1]();
    for (const [definition, request] of DEFINITIONS) {
      expect(
        reactiveGate(definition, request, input).projectCalls,
        `${definition.id}: den reaktive gate projicerede ikke præcis én gang`
      ).toBe(1);
      expect(
        clickPreflight(definition, request, input).projectCalls,
        `${definition.id}: click-preflighten projicerede ikke præcis én gang`
      ).toBe(1);
    }
  });

  it('en blokering bærer ALTID mindst én synlig årsag — i begge kanaler, for alle 18', () => {
    // "Ingen usynlig blokering" ([[project_download_gate_visible_error_invariant]]) for hele kataloget,
    // ikke kun for de fire domæner, gate-matrixen dækker.
    for (const [inputName, buildInput] of INPUTS) {
      const input = buildInput();
      for (const [definition, request] of DEFINITIONS) {
        for (const [channel, verdict] of [
          ['gate', reactiveGate(definition, request, input)],
          ['preflight', clickPreflight(definition, request, input)],
        ] as const) {
          if (verdict.canDownload) continue;
          expect(
            verdict.reasons.length,
            `${definition.id} @ ${inputName} (${channel}): blokeret UDEN nogen årsag`
          ).toBeGreaterThan(0);
          for (const reason of verdict.reasons) {
            const [code, message] = reason.split('|');
            expect(code?.trim(), `${definition.id}: tom årsagskode`).not.toBe('');
            expect(message?.trim(), `${definition.id}: tom årsagsbesked`).not.toBe('');
          }
        }
      }
    }
  });

  /**
   * Kontrollen skal kunne FEJLE. Sammenligner den to identiske kald af samme funktion, ville den bestå,
   * uanset hvad definitionerne gjorde. Beviset er, at fixturerne faktisk producerer BEGGE verdicts —
   * altså at der er noget at være enige om.
   */
  it('målingen er ikke vakuøs: fixturerne producerer både ready og blocked på tværs af kataloget', () => {
    const verdicts = new Set<boolean>();
    let blockedWithReasons = 0;
    for (const [, buildInput] of INPUTS) {
      const input = buildInput();
      for (const [definition, request] of DEFINITIONS) {
        const gate = reactiveGate(definition, request, input);
        verdicts.add(gate.canDownload);
        if (!gate.canDownload && gate.reasons.length > 0) blockedWithReasons += 1;
      }
    }
    expect(verdicts, 'fixturerne gav kun ét verdict — pariteten måler intet').toEqual(new Set([true, false]));
    expect(blockedWithReasons).toBeGreaterThanOrEqual(18);
  });
});
