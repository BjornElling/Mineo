/**
 * Form-, felt- og critical-action-grænser.
 *
 * Feltfladen og den kritiske handlingsbarriere: ingen lokal spejling af committed state, ingen
 * microtask-/frame-venten i commit-sensitiv kode, og restore-/destinationskravene til undo/redo.
 *
 * Del af det opdelte arkitekturmanifest (Fase 6, genåbnet): manifestet var 2.133 linjer og blandede
 * storage-, input-, domæne-, UI- og dokumentregler i én fil, hvor en regel og dens nabo intet havde
 * med hinanden at gøre. `architectureRules.ts` samler nu de fem koncern-moduler til ét registry.
 */
import ts from 'typescript';
import { collectCalls } from '../astQueries';
import { type SourceEntry } from '../sourceGraph';
import {
  defineRule,
  forbidCalls,
  forbidElementAccess,
  forbidImports,
  forbidMemberAccess,
  type Finding,
} from '../ruleKit';

// --- Ingen lokal React-state-spejling af committed persisterede sektioner ------

const isNamedCall = (node: ts.CallExpression, identifier: string): boolean => {
  const { expression } = node;
  return (
    (ts.isIdentifier(expression) && expression.text === identifier) ||
    (ts.isPropertyAccessExpression(expression) &&
      ts.isIdentifier(expression.expression) &&
      expression.expression.text === 'React' &&
      expression.name.text === identifier)
  );
};

const collectBindingIdentifiers = (name: ts.BindingName): string[] => {
  if (ts.isIdentifier(name)) return [name.text];
  const result: string[] = [];
  for (const element of name.elements) {
    if (ts.isOmittedExpression(element)) continue;
    if (element.dotDotDotToken) continue;
    result.push(...collectBindingIdentifiers(element.name));
  }
  return result;
};

const referencesTrackedCommittedSource = (
  node: ts.Node,
  trackedSectionVars: ReadonlySet<string>,
  trackedValuesVars: ReadonlySet<string>,
  trackedFormVars: ReadonlySet<string>
): boolean => {
  let found = false;
  const visit = (current: ts.Node): void => {
    if (found) return;
    if (
      ts.isIdentifier(current) &&
      (trackedSectionVars.has(current.text) || trackedValuesVars.has(current.text))
    ) {
      found = true;
      return;
    }
    if (
      ts.isPropertyAccessExpression(current) &&
      ts.isIdentifier(current.expression) &&
      trackedFormVars.has(current.expression.text) &&
      current.name.text === COMMITTED_MEMBER
    ) {
      found = true;
      return;
    }
    ts.forEachChild(current, visit);
  };
  visit(node);
  return found;
};

/**
 * Fase 6 retargetede denne regel til greenfields faktiske læse-grænse.
 *
 * Mekanikken — spor en variabel fra den committede kilde, og flag den, hvis den flyder ind i en
 * `useState`-initializer eller en setter i en `useEffect` — er uændret og fanger stadig præcis det,
 * den skal. Men KILDERNE var `usePersistedSectionSelector`/`getPersistedSectionSnapshot`/
 * `usePersistedForm`, som alle tre er afskaffet: dødt-værn-detektoren viste nul kald i grafen, så
 * reglen returnerede tomt på første linje for hver eneste fil.
 *
 * Greenfields ene læse-grænse er `useInputEvaluation()` (§3.4), hvis `reader` fodrer de rene
 * reader-projektioner. Spejles dét i lokal React-state, genopstår præcis den divergens mellem
 * committed sandhed og lokal kopi, reglen blev skrevet for at forhindre.
 */
const COMMITTED_MIRROR_MARKERS = ['useInputEvaluation'];
/** Evalueringens committede medlem: `const { reader } = useInputEvaluation()`. */
const COMMITTED_MEMBER = 'reader';
/** Projektions-byggere: `buildXReaderProjection(evaluation.reader)` er også en committed kilde. */
const READER_PROJECTION_BUILDER = /^build[A-Za-z]*(?:Reader)?Projection$/;

/** Nævner filen overhovedet en committed kilde — evalueringen eller en reader-projektion? */
const mentionsCommittedSource = (text: string): boolean =>
  COMMITTED_MIRROR_MARKERS.some((marker) => text.includes(marker))
  || /\bbuild[A-Za-z]*(?:Reader)?Projection\s*\(/.test(text);

const findCommittedMirrorViolations = (entry: SourceEntry): Finding[] => {
  if (!entry.text.includes('useState')) return [];
  if (!mentionsCommittedSource(entry.text)) return [];

  const sourceFile = entry.ast;
  const trackedSectionVars = new Set<string>();
  const trackedValuesVars = new Set<string>();
  const trackedFormVars = new Set<string>();
  const localStateSetters = new Set<string>();

  const collect = (node: ts.Node): void => {
    if (ts.isVariableDeclaration(node) && node.initializer) {
      // `const p = buildXReaderProjection(reader)` — projektionen ER den committede afledning.
      if (
        ts.isCallExpression(node.initializer) &&
        ts.isIdentifier(node.initializer.expression) &&
        READER_PROJECTION_BUILDER.test(node.initializer.expression.text)
      ) {
        for (const identifier of collectBindingIdentifiers(node.name)) {
          trackedSectionVars.add(identifier);
        }
      }

      if (ts.isCallExpression(node.initializer) && isNamedCall(node.initializer, 'useInputEvaluation')) {
        if (ts.isIdentifier(node.name)) trackedFormVars.add(node.name.text);
        if (ts.isObjectBindingPattern(node.name)) {
          for (const element of node.name.elements) {
            if (element.dotDotDotToken) continue;
            const propertyName = element.propertyName ?? element.name;
            if (ts.isIdentifier(propertyName) && propertyName.text === COMMITTED_MEMBER) {
              trackedValuesVars.add(element.name.getText(sourceFile));
            }
          }
        }
      }

      if (
        ts.isObjectBindingPattern(node.name) &&
        ts.isIdentifier(node.initializer) &&
        trackedFormVars.has(node.initializer.text)
      ) {
        for (const element of node.name.elements) {
          if (element.dotDotDotToken) continue;
          const propertyName = element.propertyName ?? element.name;
          if (ts.isIdentifier(propertyName) && propertyName.text === COMMITTED_MEMBER) {
            trackedValuesVars.add(element.name.getText(sourceFile));
          }
        }
      }

      if (
        ts.isIdentifier(node.name) &&
        ts.isPropertyAccessExpression(node.initializer) &&
        ts.isIdentifier(node.initializer.expression) &&
        trackedFormVars.has(node.initializer.expression.text) &&
        node.initializer.name.text === COMMITTED_MEMBER
      ) {
        trackedValuesVars.add(node.name.text);
      }

      if (
        ts.isArrayBindingPattern(node.name) &&
        ts.isCallExpression(node.initializer) &&
        isNamedCall(node.initializer, 'useState')
      ) {
        const setter = node.name.elements[1];
        if (setter && ts.isBindingElement(setter) && ts.isIdentifier(setter.name)) {
          localStateSetters.add(setter.name.text);
        }
      }
    }
    ts.forEachChild(node, collect);
  };
  collect(sourceFile);

  const findings: Finding[] = [];
  const positionOf = (node: ts.Node): Finding['position'] => {
    const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
    return { line: line + 1, column: character + 1 };
  };

  const inspect = (node: ts.Node): void => {
    if (
      ts.isVariableDeclaration(node) &&
      node.initializer &&
      ts.isCallExpression(node.initializer) &&
      isNamedCall(node.initializer, 'useState')
    ) {
      const [firstArgument] = node.initializer.arguments;
      if (
        firstArgument &&
        referencesTrackedCommittedSource(firstArgument, trackedSectionVars, trackedValuesVars, trackedFormVars)
      ) {
        findings.push({ position: positionOf(node), message: 'useState-initializer spejler en committed persisteret sektion.' });
      }
    }

    if (ts.isCallExpression(node) && isNamedCall(node, 'useEffect')) {
      const [effectCallback] = node.arguments;
      if (effectCallback && (ts.isArrowFunction(effectCallback) || ts.isFunctionExpression(effectCallback))) {
        const visitEffect = (effectNode: ts.Node): void => {
          if (
            ts.isCallExpression(effectNode) &&
            ts.isIdentifier(effectNode.expression) &&
            localStateSetters.has(effectNode.expression.text) &&
            effectNode.arguments.some((arg) =>
              referencesTrackedCommittedSource(arg, trackedSectionVars, trackedValuesVars, trackedFormVars)
            )
          ) {
            findings.push({
              position: positionOf(effectNode),
              message: `useEffect spejler en committed persisteret sektion via ${effectNode.expression.text}(...).`,
            });
          }
          ts.forEachChild(effectNode, visitEffect);
        };
        visitEffect(effectCallback.body);
      }
    }
    ts.forEachChild(node, inspect);
  };
  inspect(sourceFile);

  return findings;
};

export const persistenceCommittedMirror = defineRule({
  id: 'persistence/committed-section-mirror',
  description:
    'Ingen lokal React-state (useState-initializer eller useEffect-setter) må spejle en committed persisteret sektion i pages/hooks — committed state er den ene kilde.',
  liveTarget: {
    kind: 'precondition',
    probe: (entry) =>
      (entry.relativePath.startsWith('src/components/pages/') || entry.relativePath.startsWith('src/hooks/'))
      && mentionsCommittedSource(entry.text),
    rationale:
      'mindst én page/hook læser committed state gennem greenfields læse-grænse — kilden, der kan '
      + 'spejles, findes altså stadig',
  },
  appliesTo: (relativePath) =>
    relativePath.startsWith('src/components/pages/') || relativePath.startsWith('src/hooks/'),
  find: findCommittedMirrorViolations,
  violatingFixtures: [
    {
      relativePath: 'src/hooks/useX.ts',
      code: 'const p = buildStamdataReaderProjection(r); const [local, setLocal] = useState(p);',
    },
    {
      relativePath: 'src/components/pages/X.tsx',
      code: 'const { reader } = useInputEvaluation(); const [l, setL] = useState(0); useEffect(() => { setL(reader); }, [reader]);',
    },
    {
      relativePath: 'src/components/pages/Y.tsx',
      code: 'const e = useInputEvaluation(); const [l, setL] = useState(e.reader);',
    },
  ],
  cleanFixtures: [
    // Afledning via useMemo er den ØNSKEDE form — ingen spejling.
    {
      relativePath: 'src/components/pages/X.tsx',
      code: 'const p = buildStamdataReaderProjection(r); const derived = useMemo(() => p.x, [p]);',
    },
    { relativePath: 'src/hooks/useX.ts', code: 'const [l, setL] = useState(0); useEffect(() => { setL(1); }, []);' },
    // Lokal UI-state, der ikke rører den committede kilde.
    {
      relativePath: 'src/components/pages/X.tsx',
      code: 'const e = useInputEvaluation(); const [open, setOpen] = useState(false);',
    },
  ],
});

// --- Form-kontrakt: ingen microtask-/Promise-tick i commit-sensitiv kode -------

// `src/rowDrafts/` og `src/criticalActions/` er FJERNET fra listen i Fase 6: begge mapper blev slettet
// i greenfield-cutoveren, så de var død konfiguration, der stille ville udvide grænsen igen, hvis en fil
// med samme sti nogensinde opstod. Greenfields egen barriere ligger i `src/inputCore/runtime/`, som er
// tilføjet i stedet — den er commit-sensitiv i præcis den forstand, reglen handler om.
const COMMIT_SENSITIVE_PREFIXES = [
  'src/components/',
  'src/hooks/',
  'src/utils/',
  'src/inputCore/',
];
const isCommitSensitive = (relativePath: string): boolean =>
  COMMIT_SENSITIVE_PREFIXES.some((prefix) => relativePath.startsWith(prefix));

export const queueMicrotaskBoundary = forbidCalls({
  id: 'form/no-queue-microtask-in-commit-sensitive',
  description:
    'queueMicrotask er forbudt i commit-sensitiv kode (kan splitte en atomisk commit over to microtasks); kun auditerede infrastruktur-undtagelser.',
  liveTarget: {
    kind: 'scoped',
    roots: COMMIT_SENSITIVE_PREFIXES,
    rationale: 'de commit-sensitive lag findes stadig og kan indføre en microtask-split',
  },
  appliesTo: isCommitSensitive,
  allow: ['src/components/tables/gridCore/tableKeyboardNavigation.ts'],
  forbidden: (ref) => ref.calleeName === 'queueMicrotask' && ref.calleeText === 'queueMicrotask',
  message: () => 'queueMicrotask i commit-sensitiv kode uden auditeret undtagelse.',
  violatingFixtures: [
    { relativePath: 'src/components/x.tsx', code: 'queueMicrotask(() => commit());' },
    { relativePath: 'src/hooks/x.ts', code: 'queueMicrotask(flush);' },
  ],
  cleanFixtures: [
    { relativePath: 'src/components/x.tsx', code: 'obj.queueMicrotask(fn);' },
    { relativePath: 'src/components/x.tsx', code: 'requestAnimationFrame(fn);' },
  ],
});

const isMicrotaskTick = (node: ts.CallExpression): boolean => {
  if (node.arguments.length !== 0) return false;
  const parent = node.parent;
  if (ts.isAwaitExpression(parent)) return true;
  // Promise.resolve().then(...) — resolve()'s parent er property-access `.then`.
  return ts.isPropertyAccessExpression(parent) && parent.name.text === 'then';
};

export const promiseTickBoundary = forbidCalls({
  id: 'form/no-promise-tick-in-commit-sensitive',
  description:
    'Promise-tick (await Promise.resolve() / Promise.resolve().then()) er forbudt i commit-sensitiv kode.',
  liveTarget: {
    kind: 'scoped',
    roots: COMMIT_SENSITIVE_PREFIXES,
    rationale: 'de commit-sensitive lag findes stadig og kan indføre en Promise-tick',
  },
  appliesTo: isCommitSensitive,
  allow: [],
  forbidden: (ref) => ref.calleeText === 'Promise.resolve' && isMicrotaskTick(ref.node),
  message: () => 'Promise-tick i commit-sensitiv kode.',
  violatingFixtures: [
    { relativePath: 'src/hooks/x.ts', code: 'async function f() { await Promise.resolve(); }' },
    { relativePath: 'src/components/x.tsx', code: 'Promise.resolve().then(() => commit());' },
  ],
  cleanFixtures: [
    // Promise.resolve med argument (ikke en tick) er tilladt.
    { relativePath: 'src/utils/x.ts', code: 'const p = Promise.resolve(value);' },
    // Zero-arg uden await/then (fx som initial-værdi) er ikke en tick.
    { relativePath: 'src/utils/x.ts', code: 'let queue = Promise.resolve();' },
  ],
});

// --- Critical-action-barriere: ingen DOM-scanning eller frame-/timeout-venten -----

/**
 * critical-action-contract.md §2 lover normativt, at deltagere ALDRIG opdages via DOM-scanning, og
 * at klargøring aldrig venter Promise-ticks, animation frames eller timeouts — barrieren afventer kun
 * deltagernes eksplicitte commit-/persistence-promises. Promise-tick + queueMicrotask er allerede
 * dækket af de commit-sensitive regler (nu inkl. `src/criticalActions/`); denne regel lukker
 * resten af §2's løfte, så en fremtidig regression ikke kan genindføre det gamle timing-baserede
 * mønster inde i selve barrieren. `document.activeElement` (fokus-mål-capture, ikke deltager-
 * opdagelse) er en property-access og rammes derfor ikke.
 */
// Fase 6: scopet var `src/criticalActions/` — en mappe, greenfield-cutoveren slettede. Dødt-værn-
// detektorens scan-rod-kontrol fangede det: reglen scannede en tom rod og var inert, selv om dens
// fixtures (som lå på syntetiske `src/criticalActions/`-stier) blev ved med at bestå. Barrieren bor nu
// i `criticalActionCoordinator.ts` under greenfield-runtimen, og kontrakt §2's løfte gælder den.
const CRITICAL_ACTION_MODULE = 'src/inputCore/runtime/criticalActionCoordinator.ts';

const isCriticalActionModule = (relativePath: string): boolean =>
  relativePath === CRITICAL_ACTION_MODULE;

export const criticalActionNoDomScanOrFrameWait = forbidCalls({
  id: 'criticalAction/no-dom-scan-or-frame-wait',
  description:
    'critical-action-barrieren må ikke DOM-scanne (querySelector*/getElementsBy*) eller vente på frames/timeouts (requestAnimationFrame/setTimeout/setInterval) — den afventer kun eksplicitte deltager-promises (kontrakt §2).',
  liveTarget: {
    kind: 'scoped',
    roots: [CRITICAL_ACTION_MODULE],
    rationale: 'critical-action-barrieren findes stadig som modul og kan regressere til timing-venten',
  },
  appliesTo: isCriticalActionModule,
  forbidden: (ref) =>
    ref.calleeName === 'requestAnimationFrame' ||
    ref.calleeName === 'setTimeout' ||
    ref.calleeName === 'setInterval' ||
    ref.calleeName === 'querySelector' ||
    ref.calleeName === 'querySelectorAll' ||
    ref.calleeName === 'getElementById' ||
    ref.calleeName === 'getElementsByClassName' ||
    ref.calleeName === 'getElementsByTagName',
  message: (ref) =>
    `${ref.calleeText} i critical-action-barrieren — DOM-scanning/frame-venten er forbudt (kontrakt §2); afvent eksplicitte deltager-promises.`,
  violatingFixtures: [
    { relativePath: CRITICAL_ACTION_MODULE, code: 'requestAnimationFrame(() => flush());' },
    { relativePath: CRITICAL_ACTION_MODULE, code: 'setTimeout(commit, 0);' },
    { relativePath: CRITICAL_ACTION_MODULE, code: 'const el = document.querySelector("[data-editor]");' },
  ],
  cleanFixtures: [
    { relativePath: CRITICAL_ACTION_MODULE, code: 'await participant.commit();' },
    { relativePath: CRITICAL_ACTION_MODULE, code: 'const el = document.activeElement;' },
    // Uden for barrieren er frame-planlægning fortsat tilladt (fx kosmetisk fokus).
    { relativePath: 'src/components/x.tsx', code: 'requestAnimationFrame(() => focus());' },
  ],
});

// --- EO felt-synlighed: governed felter må ikke bruges i inline render-gates -----

/**
 * Felter hvis synlighed OG beregnings-relevans ejes af et relevans-prædikat i
 * eoInputRelevance.ts (ét sandt sted). En inline render-gate på et sådant felt lader
 * "skjult i UI" og "ignoreret i beregning" divergere igen — derfor forbudt. Kontrol-
 * bindinger (`checked={getChecked(values.X)}` / `value={values.X}`) er tilladt, fordi
 * feltet dér ikke gater andet indhold.
 */
const GOVERNED_VISIBILITY_FIELDS: ReadonlyMap<string, string> = new Map([
  ['varigeMenAfgorelse', 'erVarigeMenAfgoerelseAktiv'],
  ['midlertidigtEETAfgorelse', 'erMidlertidigtEETAfgoerelseAktiv / erEETKlageRelevant'],
  ['endeligtEETAfgorelse', 'erEndeligtEETAfgoerelseAktiv / erEETKlageRelevant'],
  ['kravPaaSvieSmerteGodtgoerelse', 'erSvieSmerteSektionAktiv'],
  ['tidligereSsMax', 'erSvieSmertePeriodeInputRelevant'],
  ['kravPaaTabtArbejdsfortjeneste', 'erTabtArbejdsfortjenesteSektionAktiv'],
  ['kravPaaOevrigeErstatningskrav', 'erOevrigeKravSektionAktiv'],
  ['visBilagsnumre', 'erBilagsnumreRelevant'],
]);

const EO_OPLYSNINGER_SECTIONS_DIR = 'src/components/pages/erstatningsopgoerelse/eoOplysninger/sections';

/** `values.FIELD`-medlemsadgang på et governed felt → feltnavn, ellers null. */
const governedValuesFieldName = (node: ts.Node): string | null => {
  if (
    ts.isPropertyAccessExpression(node) &&
    ts.isIdentifier(node.expression) &&
    node.expression.text === 'values' &&
    GOVERNED_VISIBILITY_FIELDS.has(node.name.text)
  ) {
    return node.name.text;
  }
  return null;
};

/**
 * Klatrer op gennem parenteser og `!` for at se, om `node` (evt. negeret/parenteseret)
 * er en operand i en logisk (`&&`/`||` hvis `allowOr`, ellers kun `&&`) binær-udtryk —
 * dvs. fungerer som en render-gate. Stopper ved alt andet (JSX-attribut, tildeling …).
 */
const isLogicalGateOperand = (node: ts.Node, allowOr: boolean): boolean => {
  let current: ts.Node = node;
  while (current.parent) {
    const parent = current.parent;
    if (ts.isBinaryExpression(parent)) {
      const op = parent.operatorToken.kind;
      return op === ts.SyntaxKind.AmpersandAmpersandToken || (allowOr && op === ts.SyntaxKind.BarBarToken);
    }
    if (
      ts.isParenthesizedExpression(parent) ||
      (ts.isPrefixUnaryExpression(parent) && parent.operator === ts.SyntaxKind.ExclamationToken)
    ) {
      current = parent;
      continue;
    }
    return false;
  }
  return false;
};

const findEoFieldVisibilityGates = (entry: SourceEntry): Finding[] => {
  const findings: Finding[] = [];
  const positionOf = (node: ts.Node): Finding['position'] => {
    const { line, character } = entry.ast.getLineAndCharacterOfPosition(node.getStart(entry.ast));
    return { line: line + 1, column: character + 1 };
  };

  const walk = (node: ts.Node): void => {
    // Case A: getChecked(values.FIELD) brugt som (evt. negeret) operand i && / ||.
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'getChecked' &&
      node.arguments.length === 1
    ) {
      const field = governedValuesFieldName(node.arguments[0]);
      if (field !== null && isLogicalGateOperand(node, /* allowOr */ true)) {
        findings.push({
          position: positionOf(node),
          message: `Inline synligheds-gate på values.${field} — brug relevans-prædikatet ${GOVERNED_VISIBILITY_FIELDS.get(field)} fra eoInputRelevance.ts.`,
        });
      }
    }

    // Case B: values.FIELD === '...' / !== '...' brugt som operand i &&.
    if (ts.isBinaryExpression(node)) {
      const op = node.operatorToken.kind;
      if (op === ts.SyntaxKind.EqualsEqualsEqualsToken || op === ts.SyntaxKind.ExclamationEqualsEqualsToken) {
        const field = governedValuesFieldName(node.left) ?? governedValuesFieldName(node.right);
        const otherSide = governedValuesFieldName(node.left) !== null ? node.right : node.left;
        if (field !== null && ts.isStringLiteralLike(otherSide) && isLogicalGateOperand(node, /* allowOr */ false)) {
          findings.push({
            position: positionOf(node),
            message: `Inline synligheds-gate på values.${field} — brug relevans-prædikatet ${GOVERNED_VISIBILITY_FIELDS.get(field)} fra eoInputRelevance.ts.`,
          });
        }
      }
    }

    ts.forEachChild(node, walk);
  };
  walk(entry.ast);
  return findings;
};

export const eoFieldVisibilitySingleSource = defineRule({
  id: 'domain/eo-field-visibility-single-source',
  description:
    'Governed EO-input-felter (synlighed ejet af eoInputRelevance-prædikater) må ikke bruges i inline render-gates i eoOplysninger-sektionerne — ellers kan UI-synlighed og beregnings-neutralisering divergere.',
  liveTarget: {
    kind: 'scoped',
    roots: [EO_OPLYSNINGER_SECTIONS_DIR],
    rationale: 'EO-oplysningssektionerne findes stadig og kan indføre en inline synligheds-gate',
  },
  appliesTo: (relativePath) => relativePath.startsWith(`${EO_OPLYSNINGER_SECTIONS_DIR}/`),
  find: findEoFieldVisibilityGates,
  violatingFixtures: [
    { relativePath: `${EO_OPLYSNINGER_SECTIONS_DIR}/X.tsx`, code: 'const n = <>{getChecked(values.varigeMenAfgorelse) && <A />}</>;' },
    { relativePath: `${EO_OPLYSNINGER_SECTIONS_DIR}/X.tsx`, code: "const n = <>{values.kravPaaTabtArbejdsfortjeneste === 'Ja' && <A />}</>;" },
    { relativePath: `${EO_OPLYSNINGER_SECTIONS_DIR}/X.tsx`, code: 'const n = <>{!getChecked(values.tidligereSsMax) && <A />}</>;' },
    {
      relativePath: `${EO_OPLYSNINGER_SECTIONS_DIR}/X.tsx`,
      code: 'const n = <>{(getChecked(values.midlertidigtEETAfgorelse) || getChecked(values.endeligtEETAfgorelse)) && <A />}</>;',
    },
  ],
  cleanFixtures: [
    // Kontrol-bindinger (ingen efterfølgende boolsk gate).
    { relativePath: `${EO_OPLYSNINGER_SECTIONS_DIR}/X.tsx`, code: 'const n = <Toggle checked={getChecked(values.varigeMenAfgorelse)} />;' },
    { relativePath: `${EO_OPLYSNINGER_SECTIONS_DIR}/X.tsx`, code: 'const n = <Field value={values.kravPaaTabtArbejdsfortjeneste} />;' },
    // Ikke-governed felt i en gate er tilladt.
    { relativePath: `${EO_OPLYSNINGER_SECTIONS_DIR}/X.tsx`, code: 'const n = <>{getChecked(values.oevrigtFravaerUdenLoen) && <A />}</>;' },
    // Prædikat-baseret gate (den ønskede form).
    { relativePath: `${EO_OPLYSNINGER_SECTIONS_DIR}/X.tsx`, code: 'const n = <>{erSvieSmerteSektionAktiv(values) && <A />}</>;' },
  ],
});

const RAW_REGULERING_SERIES_BINDINGS = new Set([
  'statistiskLoenudvikling',
  'getStatistiskLoenudvikling',
  'klLoenaftalerRaekker',
]);

export const reguleringCanonicalForloebBoundary = forbidImports({
  id: 'domain/regulering-canonical-forloeb-boundary',
  description:
    'Reguleringspræsentation og -kontrol må ikke genindlæse statistik-, KRL-, KL- eller manuel-procentsatsserier; de skal læse motorens kanoniske forløb.',
  liveTarget: {
    kind: 'precondition',
    probe: (entry) =>
      entry.relativePath === 'src/domain/erstatningsopgoerelse/engines/reguleringsPresentation.ts'
      || entry.relativePath === 'src/domain/eoInspektion/eoInspektionRegulationCore.ts',
    rationale: 'begge de regulerede præsentations-/kontrolmoduler findes stadig',
  },
  appliesTo: (relativePath) =>
    relativePath === 'src/domain/erstatningsopgoerelse/engines/reguleringsPresentation.ts'
    || relativePath === 'src/domain/eoInspektion/eoInspektionRegulationCore.ts',
  forbidden: (ref) => {
    if (/\/(?:statistik|krl|klLoenaftaler|manuelProcentsats)Regulering$/.test(ref.moduleSpecifier)) {
      return true;
    }
    if (!/\/data\/(?:statistiskeRates|klLoenaftaler)$/.test(ref.moduleSpecifier)) {
      return false;
    }
    // Namespace/default/dynamic/require kan omgå en named-binding-liste og forbydes derfor helt.
    return (!ref.typeOnly && ref.namedBindings.length === 0)
      || ref.namedBindings.some((binding) => RAW_REGULERING_SERIES_BINDINGS.has(binding));
  },
  message: (ref) => `Direkte import af reguleringsserie (${ref.moduleSpecifier}) — brug ReguleringForloeb fra motor-modellen.`,
  violatingFixtures: [
    {
      relativePath: 'src/domain/eoInspektion/eoInspektionRegulationCore.ts',
      code: "import { buildKrlIndexEntries } from '../erstatningsopgoerelse/engines/krlRegulering';",
    },
    {
      relativePath: 'src/domain/erstatningsopgoerelse/engines/reguleringsPresentation.ts',
      code: "import { statistiskLoenudvikling } from '../../../data/statistiskeRates';",
    },
    {
      relativePath: 'src/domain/eoInspektion/eoInspektionRegulationCore.ts',
      code: "import { klLoenaftalerRaekker } from '../../data/klLoenaftaler';",
    },
    {
      relativePath: 'src/domain/eoInspektion/eoInspektionRegulationCore.ts',
      code: "const rawRates = await import('../../data/statistiskeRates');",
    },
  ],
  cleanFixtures: [
    {
      relativePath: 'src/domain/eoInspektion/eoInspektionRegulationCore.ts',
      code: "import type { ReguleringForloeb } from '../erstatningsopgoerelse/engines/reguleringForloeb';",
    },
    {
      relativePath: 'src/domain/eoInspektion/eoInspektionRegulationCore.ts',
      code: "import { getReguleringsDatoIntervalForStatistikModel } from '../../data/statistiskeRates';",
    },
    {
      relativePath: 'src/domain/eoInspektion/eoInspektionRegulationCore.ts',
      code: "import { getReguleringsDatoIntervalForKlLoenaftaler } from '../../data/klLoenaftaler';",
    },
  ],
});

export const eetDifferencekravCompositionBoundary = forbidImports({
  id: 'domain/eet-differencekrav-composition-boundary',
  description:
    'Differencekrav-aggregatoren må ikke starte EET-søsterberegninger; den eksplicitte beregningsgraf ejer kompositionen.',
  liveTarget: {
    kind: 'precondition',
    probe: (entry) => entry.relativePath === 'src/domain/erhvervsevnetab/eetDifferencekravCalculation.ts',
    rationale: 'differencekrav-aggregatoren findes stadig som selvstændigt modul',
  },
  appliesTo: (relativePath) =>
    relativePath === 'src/domain/erhvervsevnetab/eetDifferencekravCalculation.ts',
  forbidden: (ref) => ref.namedBindings.some((binding) =>
    binding === 'computeEetLoebendeYdelser'
    || binding === 'computeEetKapitaliseringCalculation'
    || binding === 'computeEetEalCalculation'
  ),
  message: (ref) =>
    `Skjult EET-søsterberegning (${ref.namedBindings.join(', ')}) — komponér i eetCalculationGraph.`,
  violatingFixtures: [{
    relativePath: 'src/domain/erhvervsevnetab/eetDifferencekravCalculation.ts',
    code: "import { computeEetEalCalculation as runEal } from './eetEalCalculation';",
  }],
  cleanFixtures: [{
    relativePath: 'src/domain/erhvervsevnetab/eetDifferencekravCalculation.ts',
    code: "import { resolveKapitaliseringAarsydelseBreakdown } from './eetKapitaliseringCalculation';",
  }],
});

export const sfggEngineImportBoundary = forbidImports({
  id: 'domain/sfgg-engine-import-boundary',
  description:
    'Den samlede SFGG-engine må kun kaldes af TAF-netto-orkestreringen; øvrige lag bruger smalle SFGG-moduler eller resultattypen.',
  liveTarget: {
    kind: 'precondition',
    probe: (entry) => entry.relativePath.endsWith('/sfggEngine.ts'),
    rationale: 'den samlede SFGG-engine findes stadig som modul, der kan importeres uden om grænsen',
  },
  allow: ['src/domain/erstatningsopgoerelse/engines/tafNettoBeregning.ts'],
  forbidden: (ref) => ref.moduleSpecifier.endsWith('/sfggEngine') || ref.moduleSpecifier === './sfggEngine',
  message: (ref) => `Bred SFGG-engine-import (${ref.moduleSpecifier}) uden for TAF-netto-orkestreringen.`,
  violatingFixtures: [{
    relativePath: 'src/validators/x.ts',
    code: "import { computeSygeferiegodtgoerelse } from '../domain/erstatningsopgoerelse/engines/sfggEngine';",
  }],
  cleanFixtures: [{
    relativePath: 'src/validators/x.ts',
    code: "import { resolveSfggReferenceperiodeDayCount } from '../domain/erstatningsopgoerelse/engines/sfggReferencesats';",
  }],
});

export const sfggAnsaettelsesforholdImportBoundary = forbidImports({
  id: 'domain/sfgg-ansaettelsesforhold-import-boundary',
  description: 'Pr.-ansættelsesforhold-beregningen er intern for den tynde SFGG-engine.',
  liveTarget: {
    kind: 'precondition',
    probe: (entry) => entry.relativePath.endsWith('/sfggAnsaettelsesforhold.ts'),
    rationale: 'pr.-ansættelsesforhold-beregningen findes stadig som modul, der kan importeres uden om grænsen',
  },
  allow: ['src/domain/erstatningsopgoerelse/engines/sfggEngine.ts'],
  forbidden: (ref) =>
    ref.moduleSpecifier.endsWith('/sfggAnsaettelsesforhold')
    || ref.moduleSpecifier === './sfggAnsaettelsesforhold',
  message: (ref) => `Direkte import af intern SFGG-ansættelsesberegning (${ref.moduleSpecifier}).`,
  violatingFixtures: [{
    relativePath: 'src/domain/x.ts',
    code: "import { computeSfggForAnsaettelsesforhold } from './erstatningsopgoerelse/engines/sfggAnsaettelsesforhold';",
  }],
  cleanFixtures: [{
    relativePath: 'src/domain/x.ts',
    code: "import type { SygeferiegodtgoerelseResult } from './erstatningsopgoerelse/engines/sfggResult';",
  }],
});

export const sfggSegmenteringImportBoundary = forbidImports({
  id: 'domain/sfgg-segmentering-import-boundary',
  description: 'SFGG-segmentmatematik må kun bruges af engine-lagets to orkestratorer.',
  liveTarget: {
    kind: 'precondition',
    probe: (entry) => entry.relativePath.endsWith('/sfggSegmentering.ts'),
    rationale: 'SFGG-segmentmatematikken findes stadig som modul, der kan importeres uden om grænsen',
  },
  allow: [
    'src/domain/erstatningsopgoerelse/engines/sfggAnsaettelsesforhold.ts',
    'src/domain/erstatningsopgoerelse/engines/sfggEngine.ts',
  ],
  forbidden: (ref) =>
    ref.moduleSpecifier.endsWith('/sfggSegmentering') || ref.moduleSpecifier === './sfggSegmentering',
  message: (ref) => `Direkte import af intern SFGG-segmentmatematik (${ref.moduleSpecifier}).`,
  violatingFixtures: [{
    relativePath: 'src/domain/x.ts',
    code: "import { buildSfggGrossOre } from './erstatningsopgoerelse/engines/sfggSegmentering';",
  }],
  cleanFixtures: [{
    relativePath: 'src/domain/x.ts',
    code: "import { buildSfggPeriode } from './erstatningsopgoerelse/engines/sfggPeriodisering';",
  }],
});

export const sfggWarningsImportBoundary = forbidImports({
  id: 'domain/sfgg-warnings-import-boundary',
  description: 'SFGG-seksmånedersadvarslen forbruges kun af snapshot og den fælles row-builder.',
  liveTarget: {
    kind: 'precondition',
    probe: (entry) => entry.relativePath.endsWith('/sfggWarnings.ts'),
    rationale: 'SFGG-seksmånedersadvarslen findes stadig som modul, der kan importeres uden om grænsen',
  },
  allow: [
    'src/domain/eoRowEvaluation/eoRowSygeferiegodtgoerelseRows.ts',
    'src/domain/erstatningsopgoerelse/snapshot/eoSnapshot.ts',
  ],
  forbidden: (ref) => ref.moduleSpecifier.endsWith('/sfggWarnings') || ref.moduleSpecifier === './sfggWarnings',
  message: (ref) => `SFGG-warning-import (${ref.moduleSpecifier}) uden for de autoritative forbrugere.`,
  violatingFixtures: [{
    relativePath: 'src/components/x.ts',
    code: "import { findSfggSixMonthWarningEmploymentIds } from '../domain/erstatningsopgoerelse/engines/sfggWarnings';",
  }],
  cleanFixtures: [{
    relativePath: 'src/components/x.ts',
    code: "import type { SygeferiegodtgoerelseResult } from '../domain/erstatningsopgoerelse/engines/sfggResult';",
  }],
});

/**
 * Fase 5's strukturelle håndhævelse: dokument-livscyklussen er den ENE vej til et dokument.
 *
 * Før Fase 5 lå livscyklussen spredt over tre lag pr. output, og hvert af de 18 outputs havde sin
 * egen kopi af spredningen — hvorfor fem af dem manglede mindst ét trin (commit-barriere, frisk
 * kildeoptagelse, token-lighed, friskheds-recheck). Nu ejer definitionen rækkefølgen, men det
 * holder kun, hvis ingen kan gå udenom. Derfor:
 *
 *   - En UI-fil må ikke importere en dokumentgenerator direkte. Generatoren nås kun gennem
 *     definitionens `loadRenderer`, som kernen først kalder EFTER gaten har sagt ready. Importerede
 *     en side generatoren selv, ville den kunne danne et dokument uden gate.
 *   - En UI-fil må ikke importere `triggerDocumentDownload`. Det er livscyklussens IRREVERSIBLE
 *     handling, og den skal ske efter det sidste friskheds-recheck — ikke fra en callsite.
 *   - En UI-fil må ikke importere kernens interne livscyklus-modul. `executeDocumentDownload` er
 *     ganske vist det eneste eksporterede navn dér, men en direkte import ville omgå katalogets
 *     binding af definition til miljø.
 *
 * **Reglen er AUTORITETSbaseret, ikke sti-baseret.** Første udgave gjaldt kun `src/components/` og
 * kunne derfor omgås ved at lægge callsite-logik et andet sted — fx i `domain/**\/react/`, hvor
 * `useReguleringDocumentAction` bor. Nu gælder forbuddet HELE repoet, og i stedet erklæres de få
 * moduler, der HAR autoriteten, eksplicit i `allow`. Det gør listen til en beslutning man kan læse,
 * frem for en konsekvens af hvor filerne tilfældigvis ligger.
 *
 */
const DOCUMENT_GENERATOR_AUTHORITIES: readonly string[] = [
  // Definitionerne lazy-loader deres egen generator i `loadRenderer`.
  'src/domain/satser/satserDocumentDefinition.ts',
  'src/domain/renteberegning/renteberegningDocumentDefinitions.ts',
  'src/domain/erstatningsopgoerelse/eoDocumentDefinitions.ts',
  'src/domain/erstatningsopgoerelse/reguleringDocumentDefinitions.ts',
  'src/domain/erhvervsevnetab/eetDocumentDefinitions.ts',
  'src/domain/forsoergertab/forsoergertabDocumentDefinition.ts',
  'src/domain/varigemen/varigeMenDocumentDefinition.ts',
  'src/domain/aarsloen/aarsloenDocumentDefinitions.ts',
  'src/apps/minprocesrente/document/standaloneRenteDocumentDefinitions.ts',
];

const DOCUMENT_LIFECYCLE_AUTHORITIES: readonly string[] = [
  // Livscyklussen er den ENESTE der må starte fil-I/O.
  'src/document/definition/documentLifecycle.ts',
  // Katalogfabrikken binder den lukkede action til miljøet og kalder livscyklussen.
  'src/document/definition/documentCatalog.ts',
];

export const documentLifecycleBypass = forbidImports({
  id: 'document/lifecycle-single-entrypoint',
  description:
    'Kun kataloget må importere kernens livscyklus, og kun livscyklussen må importere fil-I/O.',
  liveTarget: {
    kind: 'precondition',
    probe: (entry) => DOCUMENT_LIFECYCLE_AUTHORITIES.includes(entry.relativePath),
    rationale: 'livscyklus-kernen og kataloget findes stadig som de moduler, alle downloads skal igennem',
  },
  allow: DOCUMENT_LIFECYCLE_AUTHORITIES,
  forbidden: (ref) => {
    const moduleSpecifier = ref.moduleSpecifier.replaceAll('\\', '/');
    // Matcher også en SØSKENDE-import (`./documentLifecycle`). Første udgave
    // krævede mappenavnet i specifieren og lod derfor et modul i samme mappe importere kernen frit.
    const importsLifecycle = /(?:^|\/)documentLifecycle$/.test(moduleSpecifier);
    const importsFileIo =
      ref.namedBindings.includes('triggerDocumentDownload')
      || (/(?:^|\/)document\/downloadArtifact$/.test(moduleSpecifier) && !ref.typeOnly && ref.namedBindings.length === 0);
    return importsLifecycle || importsFileIo;
  },
  message: (ref) =>
    `Uautoriseret omgåelse af dokument-livscyklussen (${ref.moduleSpecifier}) — aktivér outputtet gennem kataloget.`,
  violatingFixtures: [
    { relativePath: 'src/components/pages/X.tsx', code: "import { triggerDocumentDownload } from '../../document/downloadArtifact';" },
    { relativePath: 'src/components/pages/X.tsx', code: "import { executeDocumentDownload } from '../../document/definition/documentLifecycle';" },
    // Uden for components-laget gælder forbuddet nu OGSÅ — det var hullet i første udgave.
    { relativePath: 'src/domain/x/react/useXAction.ts', code: "import { executeDocumentDownload } from '../../../document/definition/documentLifecycle';" },
  ],
  cleanFixtures: [
    { relativePath: 'src/components/pages/X.tsx', code: "import { satserDocumentDefinition } from '../../domain/satser/satserDocumentDefinition';" },
    { relativePath: 'src/components/pages/X.tsx', code: "import { useMineoDocumentOutput } from '../../document/runtime/react/useMineoDocumentOutput';" },
  ],
});

/** Generatorer er kun tilgængelige gennem en definitions lazy `loadRenderer`. */
export const documentGeneratorImportBoundary = forbidImports({
  id: 'document/generator-import-boundary',
  description: 'Kun dokumentdefinitioner må importere dokumentgeneratorer.',
  liveTarget: {
    kind: 'scoped',
    roots: ['src/document/generators'],
    rationale: 'der findes stadig dokumentgeneratorer, som kan importeres uden om en definition',
  },
  allow: DOCUMENT_GENERATOR_AUTHORITIES,
  forbidden: (ref) => !ref.typeOnly && ref.moduleSpecifier.replaceAll('\\', '/').includes('document/generators/'),
  message: (ref) => `Uautoriseret generatorimport (${ref.moduleSpecifier}) — generatoren skal ligge bag definitionens loadRenderer.`,
  violatingFixtures: [
    { relativePath: 'src/components/pages/X.tsx', code: "import { generateRenteDocument } from '../../document/generators/renteberegning/renteDocument';" },
    { relativePath: 'src/document/definition/x.ts', code: "const g = await import('../../document/generators/satser/satserDocument');" },
  ],
  cleanFixtures: [
    { relativePath: 'src/components/pages/X.tsx', code: "import type { RenteOversigtRow } from '../../document/generators/renteberegning/renteOversigtDocument';" },
    { relativePath: 'src/domain/satser/satserDocumentDefinition.ts', code: "const g = await import('../../document/generators/satser/satserDocument');" },
  ],
});

export const documentGeneratorWriterImport = forbidImports({
  id: 'document/generator-writer-import-boundary',
  description: 'Dokumentgeneratorer må kun bygge DocumentModel og må ikke importere writer-targets, kanaler eller den imperative modelrenderer.',
  liveTarget: {
    kind: 'scoped',
    roots: ['src/document/generators'],
    rationale: 'generatorlaget findes stadig og kan gribe ned i writer/kanal/renderer',
  },
  appliesTo: (relativePath) => relativePath.startsWith('src/document/generators/'),
  forbidden: (ref) => {
    const moduleSpecifier = ref.moduleSpecifier.replaceAll('\\', '/');
    const importsWriter = /(?:^|\/)writer(?:\/(?:documentWriter|index))?$/.test(moduleSpecifier);
    const importsChannel = /(?:^|\/)(?:pdf|docx)(?:\/|$)/.test(moduleSpecifier);
    const importsModelNamespace =
      /(?:^|\/)model\/documentModel$/.test(moduleSpecifier)
      && !ref.typeOnly
      && ref.namedBindings.length === 0;
    const importsImperativeRenderer =
      ref.namedBindings.includes('renderDocumentModel') || importsModelNamespace;
    const createsOwnSession =
      ref.namedBindings.includes('createDocumentGenerationSession')
      || (
        /(?:^|\/)documentGenerationSession$/.test(moduleSpecifier)
        && !ref.typeOnly
        && ref.namedBindings.length === 0
      );
    return importsWriter || importsChannel || importsImperativeRenderer || createsOwnSession;
  },
  message: (ref) => `Import af intern dokumentrendering (${ref.moduleSpecifier}) — byg kun via DocumentComposer og den modtagne session.`,
  violatingFixtures: [
    { relativePath: 'src/document/generators/x/xDocument.ts', code: "import type { DocumentWriter } from '../../writer/index';" },
    { relativePath: 'src/document/generators/x/xDocument.ts', code: "import { createPdfChannelWriter } from '../../../pdf/infrastructure/pdfWriter';" },
    { relativePath: 'src/document/generators/x/xDocument.ts', code: "import { renderDocumentModel } from '../../model/documentModel';" },
    { relativePath: 'src/document/generators/x/xDocument.ts', code: "const model = await import('../../model/documentModel');" },
    { relativePath: 'src/document/generators/x/xDocument.ts', code: "import { createDocumentGenerationSession } from '../../documentGenerationSession';" },
  ],
  cleanFixtures: [
    { relativePath: 'src/document/generators/x/xDocument.ts', code: "import type { DocumentComposer } from '../../model/documentModel';" },
    { relativePath: 'src/document/generators/x/xDocument.ts', code: "import type { DocumentGenerationSession } from '../../documentGenerationSession';" },
  ],
});

const DOCUMENT_GENERATOR_CURSOR_MEMBERS = new Set(['getDoc', 'getY', 'setY', 'advanceY', 'ensureSpace', 'getTextWidth', 'getPageWidth', 'getContentWidthMm', 'addImageDataUrl']);

export const documentGeneratorCursorAccess = forbidMemberAccess({
  id: 'document/generator-cursor-access-boundary',
  description: 'Dokumentgeneratorer må ikke observere kanal, cursor eller dokumentmål.',
  liveTarget: {
    kind: 'scoped',
    roots: ['src/document/generators'],
    rationale: 'generatorlaget findes stadig og kan tilgå cursoren imperativt',
  },
  appliesTo: (relativePath) => relativePath.startsWith('src/document/generators/'),
  forbidden: (ref) => DOCUMENT_GENERATOR_CURSOR_MEMBERS.has(ref.chainText.split('.').at(-1) ?? ''),
  message: (ref) => `Imperativ dokumentadgang (${ref.chainText}) — brug en deklarativ DocumentBlock.`,
  violatingFixtures: [{ relativePath: 'src/document/generators/x/xDocument.ts', code: 'const y = writer.getY();' }],
  cleanFixtures: [{ relativePath: 'src/document/generators/x/xDocument.ts', code: 'document.addTable(spec);' }],
});

export const documentGeneratorCursorElementAccess = forbidElementAccess({
  id: 'document/generator-cursor-element-access-boundary',
  description: 'Bracket-notation må ikke omgå dokumentgeneratorernes cursorgrænse.',
  liveTarget: {
    kind: 'scoped',
    roots: ['src/document/generators'],
    rationale: 'generatorlaget findes stadig og kan omgå cursorgrænsen med bracket-notation',
  },
  appliesTo: (relativePath) => relativePath.startsWith('src/document/generators/'),
  forbidden: (ref) => Array.from(DOCUMENT_GENERATOR_CURSOR_MEMBERS).some((member) => ref.chainText.endsWith(`["${member}"]`) || ref.chainText.endsWith(`['${member}']`)),
  message: (ref) => `Imperativ dokumentadgang (${ref.chainText}) — brug en deklarativ DocumentBlock.`,
  violatingFixtures: [{ relativePath: 'src/document/generators/x/xDocument.ts', code: 'writer["getDoc"]();' }],
  cleanFixtures: [{ relativePath: 'src/document/generators/x/xDocument.ts', code: 'const value = data["value"];' }],
});

// --- WI-003: kommitterende felt-familier skal bære undo/redo-restore-target-attributterne ----------
//
// En feltfamilie, der renderer sit EGET fokuserbare element — enten via en surface-hook
// (`useFormFieldSurface`/`useGridCellSurface`) eller ved at rendere en fokuserbar `Styled*`-kontrol
// (toggle/checkbox/radio/dropdown) — SKAL føre restore-target-attributterne igennem, så undo/redo kan re-fokusere
// PRÆCIS den editorlokation, ændringen kom fra (§3.7). De tynde preset-skaller (Integer/Percent/Amount/…), der blot
// videresender `field`/`location` til en anden feltkomponent, har intet eget fokuserbart element og er
// derfor rene UDEN attributterne — reglen flager dem ikke, fordi de hverken bruger en surface-hook eller en Styled*-kontrol.
//
// Scopet er HELE feltmappen (ikke et navnepræfiks): et nyt felt i mappen er dækket automatisk, og reglen kan
// ikke stille blive inert af en omdøbning.
const FIELDS_DIR = 'src/inputCore/react/fields';
const RESTORE_ATTR_TOKEN = /\b(?:useRestoreTargetAttributes|restoreTargetAttributes)\b/;
// De fokuserbare primitiver, en feltfamilie renderer direkte, når den ejer sit eget input-element.
const FOCUSABLE_SURFACE_SIGNAL = /\b(?:useFormFieldSurface|useGridCellSurface|StyledToggleSwitch|StyledCheckbox|StyledRadioButton|StyledDropdown)\b/;

export const restoreTargetAttributesRule = defineRule({
  id: 'form/restore-target-attributes',
  description:
    'Feltfamilier, der ejer et fokuserbart element (surface-hook eller Styled*-kontrol), skal føre restore-target-attributterne igennem, så undo/redo kan re-fokusere den rette editorlokation (§3.7).',
  liveTarget: {
    kind: 'precondition',
    probe: (entry) =>
      entry.relativePath.startsWith(FIELDS_DIR + '/')
      && entry.relativePath.endsWith('.tsx')
      && FOCUSABLE_SURFACE_SIGNAL.test(entry.text),
    rationale:
      'mindst én feltfamilie ejer stadig et fokuserbart element og skal derfor bære restore-target-attributterne',
  },
  appliesTo: (relativePath) =>
    relativePath.startsWith(`${FIELDS_DIR}/`) && relativePath.endsWith('.tsx'),
  find: (entry) => {
    // Rent tekst-værn: selve tilstedeværelsen af attributterne er kontrakten (jf. guard-selvtest-princippet).
    if (!FOCUSABLE_SURFACE_SIGNAL.test(entry.text)) return [];
    if (RESTORE_ATTR_TOKEN.test(entry.text)) return [];
    return [{
      position: { line: 1, column: 1 },
      message:
        'Feltfamilien renderer et fokuserbart element, men fører ikke restore-target-attributterne igennem '
        + '(useRestoreTargetAttributes/restoreTargetAttributes) — undo/redo kan da ikke re-fokusere feltet (§3.7).',
    }];
  },
  violatingFixtures: [
    {
      relativePath: `${FIELDS_DIR}/XField.tsx`,
      code: 'const C = () => { const s = useFormFieldSurface(field, location); return <input {...s.htmlInputAttributes} />; };',
    },
    {
      relativePath: `${FIELDS_DIR}/YField.tsx`,
      code: 'const C = () => <StyledToggleSwitch checked={false} onCommit={c} />;',
    },
  ],
  cleanFixtures: [
    // Ejer et fokuserbart element OG fører attributterne igennem.
    {
      relativePath: `${FIELDS_DIR}/XField.tsx`,
      code: 'const C = () => { const rta = useRestoreTargetAttributes(field.address, location); return <StyledCheckbox restoreTargetAttributes={rta} />; };',
    },
    // Tynd preset-skal: videresender kun til en anden Greenfield-komponent → intet eget fokuserbart element.
    {
      relativePath: `${FIELDS_DIR}/ZField.tsx`,
      code: 'const C = () => <NumericTextField field={field} location={location} />;',
    },
  ],
});

// --- Rækkehandlinger skal bære en navigerbar destination (§3.7) ---------------

const ROW_COMMAND_HOOKS = new Set(['useCollectionRows', 'useCollectionRowCommands']);

/**
 * En rækkehandling (insert/delete/reorder) skal kunne navigeres tilbage til efter undo/redo.
 *
 * PRIMÆRT VÆRN er typen: `CollectionRowOrigin.route`/`tabKey` er PÅKRÆVEDE, så compileren afviser et origin
 * uden destination — også når det videreføres som en variabel. Denne AST-regel er et SEKUNDÆRT værn, der
 * fanger den ene ting typen ikke udtrykker: et literal-origin, hvor `route` er udeladt helt, giver en
 * type-fejl, men reglen giver en præcis, domænesproget besked ved det rette callsite i stedet for en generisk
 * "property missing". Den læser bevidst kun literal-argumenter; variable origins er typedækkede.
 */
export const rowCommandDestinationRule = defineRule({
  id: 'input/row-command-destination',
  description:
    'useCollectionRows/useCollectionRowCommands skal kaldes med et origin, der bærer en route, så undo/redo af '
    + 'en rækkehandling kan navigere til den tabel, ændringen kom fra (§3.7).',
  liveTarget: {
    kind: 'precondition',
    probe: (entry) =>
      collectCalls(entry).some((ref) => ROW_COMMAND_HOOKS.has(ref.calleeName))
      && !entry.relativePath.endsWith('useCollectionRows.ts'),
    rationale: 'mindst ét rækkehandlings-callsite findes uden for hookens egen definition',
  },
  appliesTo: (relativePath) =>
    relativePath.startsWith('src/components/') || relativePath.startsWith('src/inputCore/react/'),
  find: (entry) => {
    const findings: Finding[] = [];
    for (const call of collectCalls(entry)) {
      if (!ROW_COMMAND_HOOKS.has(call.calleeName)) continue;
      // Hookens egen definition/re-eksport er ikke et callsite.
      if (entry.relativePath.endsWith('useCollectionRows.ts')) continue;

      const originArgument = call.node.arguments[1];
      if (originArgument === undefined) {
        findings.push({
          position: call.position,
          message: `${call.calleeName} kaldt uden origin — rækkehandlingen får ingen destination (§3.7).`,
        });
        continue;
      }
      if (!ts.isObjectLiteralExpression(originArgument)) {
        // Et videreført origin-objekt (variabel) kan ikke inspiceres her; typen dækker tilstedeværelsen.
        continue;
      }
      const carriesRoute = originArgument.properties.some((property) => {
        if (ts.isShorthandPropertyAssignment(property)) return property.name.text === 'route';
        if (ts.isSpreadAssignment(property)) return /\broute\b/.test(property.getText());
        if (!ts.isPropertyAssignment(property)) return false;
        return ts.isIdentifier(property.name) && property.name.text === 'route';
      });
      if (carriesRoute) continue;
      findings.push({
        position: call.position,
        message:
          `${call.calleeName} kaldt med et origin uden 'route' — undo/redo af insert/delete/reorder ville `
          + 'gendanne data, men efterlade brugeren på en vilkårlig side (§3.7).',
      });
    }
    return findings;
  },
  violatingFixtures: [
    {
      relativePath: 'src/components/tables/NyTabel.tsx',
      code: "const rows = useCollectionRows(collectionRef, { locationId: 'x.rows' });",
    },
    {
      relativePath: 'src/components/tables/NyTabel2.tsx',
      code: "const rows = useCollectionRowCommands(collectionRef, { locationId: 'x.rows', tabKey: null });",
    },
  ],
  cleanFixtures: [
    {
      relativePath: 'src/components/tables/NyTabel.tsx',
      code: "const rows = useCollectionRows(collectionRef, { locationId: 'x.rows', route: APP_ROUTES.satser, tabKey: null });",
    },
    // Videreført kalder-navigation: route kommer fra en spread/variabel.
    {
      relativePath: 'src/components/tables/NyTabel2.tsx',
      code: "const rows = useCollectionRowCommands(collection, { locationId: p, route: locationNav.route, tabKey: locationNav.tabKey });",
    },
    // Videreført origin som variabel: typen (`CollectionRowOrigin` med påkrævet route/tabKey) er værnet her,
    // så AST-reglen springer den bevidst over frem for at gætte på variablens indhold.
    {
      relativePath: 'src/components/tables/NyTabel3.tsx',
      code: 'const rows = useCollectionRows(collection, rowOrigin);',
    },
  ],
});
