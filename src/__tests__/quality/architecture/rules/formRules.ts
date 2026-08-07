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
import { collectCalls, collectIdentifiers, hasAnyIdentifier, hasIdentifier, hasImportFrom } from '../astQueries';
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

/**
 * Bruger filen overhovedet en committed kilde — evalueringen eller en reader-projektion?
 *
 * AST-baseret (R0-F02): den tidligere udgave søgte i filteksten, så en kommentar, der forklarede
 * committed-grænsen, kunne alene opfylde både `liveTarget` og denne forport til analysen.
 */
const usesCommittedSource = (entry: SourceEntry): boolean =>
  hasAnyIdentifier(entry, COMMITTED_MIRROR_MARKERS)
  || collectIdentifiers(entry).some((ref) => READER_PROJECTION_BUILDER.test(ref.text));

const findCommittedMirrorViolations = (entry: SourceEntry): Finding[] => {
  if (!hasIdentifier(entry, 'useState')) return [];
  if (!usesCommittedSource(entry)) return [];

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
      && usesCommittedSource(entry),
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
// R0-F02: navnene måles som IDENTIFIERS, ikke som tekst. Reglen var før et rent tekst-værn i BEGGE ender, så en
// kommentar kunne både gøre den levende og — værre — få en manglende gennemføring til at se opfyldt ud:
// forklarende prosa om `restoreTargetAttributes` var nok til at gøre en overtrædelse grøn.
const RESTORE_ATTR_NAMES = ['useRestoreTargetAttributes', 'restoreTargetAttributes'];
// De fokuserbare primitiver, en feltfamilie renderer direkte, når den ejer sit eget input-element.
const FOCUSABLE_SURFACE_NAMES = [
  'useFormFieldSurface',
  'useGridCellSurface',
  'StyledToggleSwitch',
  'StyledCheckbox',
  'StyledRadioButton',
  'StyledDropdown',
];

export const restoreTargetAttributesRule = defineRule({
  id: 'form/restore-target-attributes',
  description:
    'Feltfamilier, der ejer et fokuserbart element (surface-hook eller Styled*-kontrol), skal føre restore-target-attributterne igennem, så undo/redo kan re-fokusere den rette editorlokation (§3.7).',
  liveTarget: {
    kind: 'precondition',
    probe: (entry) =>
      entry.relativePath.startsWith(FIELDS_DIR + '/')
      && entry.relativePath.endsWith('.tsx')
      && hasAnyIdentifier(entry, FOCUSABLE_SURFACE_NAMES),
    rationale:
      'mindst én feltfamilie ejer stadig et fokuserbart element og skal derfor bære restore-target-attributterne',
  },
  appliesTo: (relativePath) =>
    relativePath.startsWith(`${FIELDS_DIR}/`) && relativePath.endsWith('.tsx'),
  find: (entry) => {
    // Selve tilstedeværelsen af attributterne ER kontrakten (jf. guard-selvtest-princippet), men den måles
    // som identifiers: en kommentar om `restoreTargetAttributes` må ikke kunne opfylde gennemføringen.
    if (!hasAnyIdentifier(entry, FOCUSABLE_SURFACE_NAMES)) return [];
    if (hasAnyIdentifier(entry, RESTORE_ATTR_NAMES)) return [];
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

// --- Popup-semantik klassificeres ét sted (UT-F02) ----------------------------

/**
 * Navigationsfladerne (`Container` og grid-navigationen) må IKKE hver især afgøre "er dette en popup-
 * kontrol, og er den åben?". De skal spørge `popupWidgetSemantics`.
 *
 * Baggrund: grid'et havde sin egen klassifikation, som genkendte celle-dropdowns på en PRIVAT
 * markør-attribut (`data-mineo-table-dropdown`) fra en slettet komponent. Ingen produktionskontrol satte
 * attributten, så alle fem celle-dropdowns fik Enter kapret af grid-navigationen frem for at åbne deres
 * menu. Samtidig fandtes ARIA-opslaget i to næsten identiske kopier.
 *
 * Reglen har to ben, fordi kun ét af dem alene kunne bæres:
 * 1. FRAVÆR: en privat popup-markør-attribut må ikke genindføres nogen steder i interaktionsfladerne.
 * 2. LOKAL KOPI: en navigationsflade må ikke selv slå ARIA-popup-semantikken op (`role="combobox"` /
 *    `aria-haspopup` i en selector). Den slags kopi var netop den drift, fundet beskrev — og den ville
 *    ikke blive fanget af ben 1, fordi den ikke bruger nogen markør.
 *
 * `liveTarget` er en precondition med `requiredPaths`: BEGGE konsumenter skal stadig importere modulet.
 * Slettes den ene, eller holder den op med at bruge den delte klassifikation, er reglen ikke længere et
 * værn om en levende grænse, og harnesset siger det.
 */
const POPUP_SEMANTICS_MODULE = 'src/components/inputs/popupWidgetSemantics.ts';
const POPUP_SEMANTICS_CONSUMERS = [
  // Sidens navigationsflade. Var `layout/Container.tsx` indtil greenfield #26 flyttede
  // tasteoversættelsen — og dermed popup-undtagelserne — ud i containerNavigation/.
  // Grænsen er den samme; kun filen der repræsenterer fladen er flyttet.
  'src/components/layout/containerNavigation/useContainerKeyboardNavigation.ts',
  'src/components/tables/gridCore/tableKeyboardNavigation.ts',
] as const;
const POPUP_SEMANTICS_IMPORT = /popupWidgetSemantics$/;
/** Privat markør-attribut som popup-KLASSIFIKATION — den fejlform, fundet handlede om. */
const PRIVATE_POPUP_MARKER = /data-mineo-[a-z-]*dropdown/;
/**
 * Rå ARIA-popup-opslag i en selector: en lokal kopi af den delte klassifikation.
 *
 * Mønstret måler attribut-selectoren SELV (`[role="combobox"` / `[aria-haspopup`) frem for at forsøge at
 * afgrænse den omgivende streng: en CSS-selector indeholder typisk dobbelt-anførselstegn inde i en
 * enkeltciteret streng, så en "ingen anførselstegn indeni"-afgrænsning ville netop misse den normale form.
 */
const LOCAL_ARIA_POPUP_LOOKUP = /\[\s*(?:role\s*=\s*\\?["']combobox|aria-haspopup)/;

export const popupSemanticsSingleSourceRule = defineRule({
  id: 'input/popup-semantics-single-source',
  description:
    'Navigationsflader skal klassificere popup-kontroller gennem popupWidgetSemantics — ikke med en privat '
    + 'markør-attribut eller en lokal kopi af ARIA-opslaget (UT-F02).',
  liveTarget: {
    kind: 'precondition',
    probe: (entry) =>
      POPUP_SEMANTICS_CONSUMERS.includes(entry.relativePath as (typeof POPUP_SEMANTICS_CONSUMERS)[number])
      // R0-F02: importen måles som en AST-node, ikke som tekst — en kommentar, der citerer importlinjen,
      // må ikke kunne holde grænsen levende.
      && hasImportFrom(entry, POPUP_SEMANTICS_IMPORT),
    rationale:
      'begge navigationsflader (Container + grid-navigationen) skal stadig aftage den delte popup-klassifikation; '
      + 'holder den ene op, er grænsen ikke længere levende',
    minimumMatches: POPUP_SEMANTICS_CONSUMERS.length,
    requiredPaths: POPUP_SEMANTICS_CONSUMERS,
  },
  // Interaktionsfladerne: tabellens gridCore, sidens Container og de fælles input-primitiver.
  appliesTo: (relativePath) =>
    (relativePath.startsWith('src/components/tables/')
      || relativePath.startsWith('src/components/layout/')
      || relativePath.startsWith('src/components/inputs/')
      || relativePath.startsWith('src/inputCore/react/'))
    // Modulet selv ER klassifikationen og skal naturligvis indeholde ARIA-opslaget.
    && relativePath !== POPUP_SEMANTICS_MODULE,
  find: (entry) => {
    const findings: Finding[] = [];
    const lines = entry.text.split('\n');
    lines.forEach((line, index) => {
      // Kommentarer er ikke kode (jf. INC-F03): en linje, der kun forklarer den gamle fejlform, er ikke
      // en overtrædelse. Vi måler derfor kun linjer med faktisk kode uden for en kommentar.
      const withoutComment = line.replace(/\/\/.*$/, '').replace(/^\s*\*.*$/, '');
      if (withoutComment.trim() === '') return;
      const position = { line: index + 1, column: 1 };
      if (PRIVATE_POPUP_MARKER.test(withoutComment)) {
        findings.push({
          position,
          message:
            'Popup-kontroller klassificeres med en privat markør-attribut. Det var netop den fejlform, der gjorde '
            + 'grid\'ets dropdown-fritagelse inert (UT-F02) — brug popupWidgetSemantics i stedet.',
        });
      }
      if (LOCAL_ARIA_POPUP_LOOKUP.test(withoutComment)) {
        findings.push({
          position,
          message:
            'Lokalt ARIA-popup-opslag (role="combobox"/aria-haspopup) i en selector. Klassifikationen ejes af '
            + 'popupWidgetSemantics — en kopi her kan drifte fra den anden flade uden en typefejl.',
        });
      }
    });
    return findings;
  },
  allow: [
    // Fokuserbarheds-selectorerne: de opregner ALLE fokuserbare elementarter (input/select/textarea/button/
    // combobox/haspopup) til Tab-traversering. Det er en anden concern end popup-KLASSIFIKATION — de svarer
    // "kan dette fokuseres?", ikke "er dette en popup, og er den åben?". Holdt bevidst ét sted her.
    'src/components/tables/gridCore/tableFocusHelpers.ts',
    // Bemærk: `StyledDropdown` behøver INGEN undtagelse. Den SÆTTER sin ARIA-semantik som JSX-props
    // (`'aria-haspopup': 'listbox'`), og reglen måler attribut-SELECTORER — altså opslag i fremmed DOM.
    // Producenten af semantikken og forbrugeren af klassifikationen er dermed strukturelt adskilt.
    // Cellens dropdown-handle henter sit eget input-element via `input[role="combobox"]` — et opslag i
    // KOMPONENTENS EGET subtree, ikke en klassifikation af en fremmed kontrol.
    'src/inputCore/react/fields/GridChoiceCell.tsx',
  ],
  violatingFixtures: [
    {
      relativePath: 'src/components/tables/gridCore/nyNav.ts',
      code: "const isDropdown = target.closest('[data-mineo-table-dropdown=\"true\"]') !== null;",
    },
    {
      relativePath: 'src/components/layout/NyContainer.tsx',
      code: 'const host = el.closest(\'[role="combobox"],[aria-haspopup]\');',
    },
  ],
  cleanFixtures: [
    {
      relativePath: 'src/components/tables/gridCore/nyNav.ts',
      code: "import { isInClosedPopupWidget } from '../../inputs/popupWidgetSemantics';\nconst isPopup = isInClosedPopupWidget(target);",
    },
    // En KOMMENTAR, der forklarer den gamle fejlform, må ikke gøre reglen rød (og må omvendt heller ikke
    // kunne bære den — derfor måles kun kode).
    {
      relativePath: 'src/components/tables/gridCore/nyNav2.ts',
      code: "// Tidligere klassificerede vi på data-mineo-table-dropdown; det er nu popupWidgetSemantics.\nconst x = 1;",
    },
    // Row-delete-markøren er ikke en popup-klassifikation.
    {
      relativePath: 'src/components/tables/gridCore/nyNav3.ts',
      code: "if (target.closest('[data-mineo-row-delete=\"true\"]')) return;",
    },
  ],
});

// --- Fokusmålets ejerskab: lokationen, ikke feltadressen (etape 7, andet pas) --

/**
 * Fokusnavigationens grænser, som R7-F02 og R7-F03 afdækkede. De tre regler nedenfor lukker hvert sit
 * hul i SAMME mekanisme — hvem der ejer et fokusmål — og de er skrevet, fordi ingen af hullerne kunne
 * fanges af en type:
 *
 * 1. `input/persisted-controls-use-field-family` — R7-F02's egentlige fund. Det EKSISTERENDE værn
 *    (`form/restore-target-attributes`) gælder kun `src/inputCore/react/fields/**` og var derfor grønt,
 *    mens to LEVENDE produktions-callsites omgik feltfamilien. Rapportens tilfældighedsfund krævede
 *    udtrykkeligt, at værnets troværdighed blev genåbnet her.
 * 2. `input/focus-destination-owned-by-location` — R7-F03's fund. Typen sikrer, at en lokation HAR en
 *    destination, men ikke at ingen UDLEDER en destination af dataadressen i stedet.
 * 3. `input/restore-attributes-carry-destination` — den nye DOM-kontrakt. En surface, der glemmer at
 *    sætte route/fane-attributterne, gør fokusnavigationen inert, uden at nogen type eller test fejler.
 */

/** De rå, fokuserbare input-primitiver. En persisteret control må aldrig binde en af dem selv. */
const RAW_INTERACTIVE_CONTROLS: readonly string[] = [
  'StyledToggleSwitch',
  'StyledCheckbox',
  'StyledRadioButton',
  'StyledDropdown',
];

/**
 * Feltfamiliens adaptere — ét pr. rå primitiv, plus de tre dropdown-varianter. Reglens live-target kræver dem
 * ALLE: forsvinder én, findes den grænse, reglen henviser callsites til, ikke længere for netop dens
 * control-art, og reglen skal skrives om frem for at stå grøn (jf. ruleKit's `requiredPaths`-begrundelse om det
 * SAMMENSATTE mål, der var opfyldt så snart ÉN fil matchede).
 */
const FIELD_FAMILY_ADAPTERS: readonly string[] = [
  'src/inputCore/react/fields/ToggleField.tsx',
  'src/inputCore/react/fields/MappedToggleField.tsx',
  'src/inputCore/react/fields/CheckboxField.tsx',
  'src/inputCore/react/fields/RadioField.tsx',
  'src/inputCore/react/fields/ChoiceField.tsx',
  'src/inputCore/react/fields/EntityChoiceField.tsx',
  'src/inputCore/react/fields/GridChoiceCell.tsx',
];

/**
 * De flader, der LOVLIGT renderer en rå control, fordi deres værdier ikke er sagsdata og derfor ikke har
 * en feltadresse at fokusere (§3.2). Listen er EKSPLICIT og kort med vilje: hver post er en flade uden
 * persisteret sagsinput, ikke en undtagelse for en control, der var svær at migrere.
 */
const NON_CASE_DATA_CONTROL_SURFACES: readonly string[] = [
  // App-indstillinger: bor i settings-storen, ikke i sagsenvelopen.
  'src/components/pages/Indstillinger.tsx',
  // Mineo-forsiden: en visningspræference uden sagsdata.
  'src/components/pages/Mineo.tsx',
  // Løntrin-finder-overlayet: transient søgeflade (dropdown UDEN name, jf. dens egen markør-kommentar).
  'src/components/pages/erstatningsopgoerelse/shared/LoentrinFinderOverlay.tsx',
];

/** Renderes et af de rå primitiver som et JSX-tag (altså i KODE, ikke i en kommentar)? */
const collectRawControlTags = (entry: SourceEntry): readonly Finding[] => {
  const findings: Finding[] = [];
  const visit = (node: ts.Node): void => {
    if ((ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node))
      && ts.isIdentifier(node.tagName)
      && RAW_INTERACTIVE_CONTROLS.includes(node.tagName.text)) {
      const { line, character } = entry.ast.getLineAndCharacterOfPosition(node.getStart(entry.ast));
      findings.push({
        position: { line: line + 1, column: character + 1 },
        message:
          `<${node.tagName.text}> renderes direkte uden for feltfamilien. En persisteret control skal gå `
          + 'gennem sin typede adapter (ToggleField/MappedToggleField/CheckboxField/RadioField/ChoiceField), '
          + 'som binder FieldRef, commitvej OG undo/redo-fokusmetadata sammen (R7-F02). Har fladen et '
          + 'særligt afslutningsbehov — en gate eller en atomisk flerfelts-transaktion — brug adapterens '
          + '`commit`-override (ToggleCommitDecision) frem for at forbinde editoren manuelt. Er værdien '
          + 'IKKE sagsdata, tilføj fladen til NON_CASE_DATA_CONTROL_SURFACES med en begrundelse.',
      });
    }
    ts.forEachChild(node, visit);
  };
  visit(entry.ast);
  return findings;
};

export const persistedControlsUseFieldFamilyRule = defineRule({
  id: 'input/persisted-controls-use-field-family',
  description:
    'Rå interaktive input-primitiver (StyledToggleSwitch/Checkbox/RadioButton/Dropdown) må kun renderes af '
    + 'feltfamilien selv eller af de eksplicit navngivne ikke-sagsdata-flader. Ellers falder FieldRef- og '
    + 'fokuskontrakten væk uden at nogen type fejler (R7-F02/GM-F03).',
  liveTarget: {
    kind: 'precondition',
    // Målet er feltfamiliens adaptere: findes de ikke længere, er der intet at henvise callsites til, og
    // reglen skal skrives om frem for at stå grøn. Vi kræver dem ALLE fem — et sammensat mål er ikke
    // opfyldt, fordi én overlevede (jf. ruleKit's `requiredPaths`-begrundelse).
    probe: (entry) => FIELD_FAMILY_ADAPTERS.includes(entry.relativePath as (typeof FIELD_FAMILY_ADAPTERS)[number])
      && collectRawControlTags(entry).length > 0,
    rationale:
      'feltfamiliens fem adaptere renderer stadig hver sit rå primitiv; forsvinder de, findes den grænse '
      + 'reglen henviser til ikke længere',
    minimumMatches: FIELD_FAMILY_ADAPTERS.length,
    requiredPaths: FIELD_FAMILY_ADAPTERS,
  },
  // HELE komponent-laget, ikke kun feltmappen. Det var netop det smalle scope, der gjorde det gamle værn
  // blindt over for to levende produktions-callsites.
  appliesTo: (relativePath) =>
    (relativePath.startsWith('src/components/') || relativePath.startsWith('src/inputCore/react/'))
    && relativePath.endsWith('.tsx')
    // Feltfamilien og primitiverne selv ER grænsen og skal naturligvis rendere dem.
    && !relativePath.startsWith('src/inputCore/react/fields/')
    && !relativePath.startsWith('src/components/inputs/'),
  find: (entry) => collectRawControlTags(entry),
  allow: NON_CASE_DATA_CONTROL_SURFACES,
  violatingFixtures: [
    // R7-F02's præcise fejlform: Årsløns gatede toggle.
    {
      relativePath: 'src/components/pages/Aarsloen.tsx',
      code: 'const C = () => <StyledToggleSwitch name="omregningTilFuldtAar" checked={c} onCommit={h} />;',
    },
    // EO's atomiske transaktions-toggle, den anden af de to.
    {
      relativePath: 'src/components/pages/erstatningsopgoerelse/OffentligeYdelserTab.tsx',
      code: 'const C = () => <StyledToggleSwitch name="midlertidigtEetFraEetSiden" onCommit={h} />;',
    },
    // Et rå dropdown i en tabel ville have samme virkning.
    {
      relativePath: 'src/components/tables/NyTabel.tsx',
      code: 'const C = () => <StyledDropdown name="enhed" value={v} onChange={h} />;',
    },
  ],
  cleanFixtures: [
    // Den typede adapter med gate-override — den godkendte løsning.
    {
      relativePath: 'src/components/pages/Aarsloen.tsx',
      code: 'const C = () => <ToggleField field={ref} location={loc} commit={decide} />;',
    },
    // MappedToggleField for et Ja/Nej-enumfelt.
    {
      relativePath: 'src/components/pages/erstatningsopgoerelse/OffentligeYdelserTab.tsx',
      code: 'const C = () => <MappedToggleField field={ref} location={loc} checkedValue="Ja" uncheckedValue="Nej" />;',
    },
    // En KOMMENTAR om den gamle fejlform må ikke bære reglen (INC-F03's lærepunkt).
    {
      relativePath: 'src/components/pages/NySide.tsx',
      code: '// Tidligere brugte vi StyledToggleSwitch direkte her; nu ToggleField.\nconst C = () => <ToggleField field={r} location={l} />;',
    },
    // En TYPE-import af handlen er ikke en rendering (Årsløn beholder netop den for sin shake-ref).
    {
      relativePath: 'src/components/pages/Aarsloen.tsx',
      code: "import type { StyledToggleSwitchHandle } from '../../types/handles';\nconst r = React.useRef<StyledToggleSwitchHandle | null>(null);",
    },
  ],
});

/** Modulet, der ejer fokusdestinationens opslag. Alle andre skal gå gennem det. */
const EDITOR_LOCATION_DESTINATION_MODULE = 'src/inputCore/react/editorLocationDestination.ts';

/**
 * Fokusnavigationens flader. Kun disse kan meningsfuldt udlede en destination, så det er her, en genindført
 * global afbildning ville dukke op.
 */
const FOCUS_NAVIGATION_SURFACES: readonly string[] = [
  'src/inputCore/react/saveBlockedFocus.ts',
  'src/inputCore/react/historyRestoreTarget.ts',
  'src/inputCore/react/historyTargetRestoreLoop.ts',
  EDITOR_LOCATION_DESTINATION_MODULE,
];

/**
 * De navne, en destinations-udledning fra DATAADRESSEN ville bruge. `PAGE_DEFAULT_TAB` og de to fane-nøglekort
 * er ikke forbudte i sig selv — de er legitime for en side, der viser sine egne faner — men i en FOKUS-flade er
 * de netop den globale afbildning, R7-F03 lukkede: fanen kan kun kendes af den editor, feltet redigeres i.
 */
const ADDRESS_DERIVED_DESTINATION_NAMES: readonly string[] = [
  'PAGE_DEFAULT_TAB',
  'EO_TAB_KEYS',
  'ERHVERVSEVNETAB_TAB_KEYS',
];

/** Bruges et af navnene som en rigtig AST-identifier (altså i kode, ikke i en kommentar)? */
const collectAddressDerivedDestinationUses = (entry: SourceEntry): readonly Finding[] => {
  const findings: Finding[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isIdentifier(node) && ADDRESS_DERIVED_DESTINATION_NAMES.includes(node.text)) {
      const { line, character } = entry.ast.getLineAndCharacterOfPosition(node.getStart(entry.ast));
      findings.push({
        position: { line: line + 1, column: character + 1 },
        message:
          `Fokus-fladen bruger ${node.text} til at udlede en destination af feltets dataadresse. Det var `
          + 'præcis den model, R7-F03 lukkede: dataidentiteten kan ikke afgøre, HVOR et felt redigeres — et '
          + 'felt kan have flere editorer (faellesAarsloen, forligsfelterne), og afbildningen måtte da '
          + 'kompensere med særregler for brugerens aktuelle route. Spørg i stedet den mountede editor via '
          + '`lookupEditorLocation`; destinationen står på lokationen (§3.2).',
      });
    }
    ts.forEachChild(node, visit);
  };
  visit(entry.ast);
  return findings;
};

export const focusDestinationOwnedByLocationRule = defineRule({
  id: 'input/focus-destination-owned-by-location',
  description:
    'En fokus-flade må ikke udlede route/fane af feltets dataadresse gennem et globalt fane-kort. '
    + 'Destinationen ejes af editorlokationen og læses gennem editorLocationDestination (R7-F03).',
  liveTarget: {
    kind: 'precondition',
    // Målet er de to fokus-flader, der faktisk NAVIGERER, plus det ejende modul. Holder save-fokus op med at
    // findes, er der ingen flade tilbage, hvor den forbudte udledning kunne opstå.
    probe: (entry) => entry.relativePath === EDITOR_LOCATION_DESTINATION_MODULE
      || entry.relativePath === 'src/inputCore/react/saveBlockedFocus.ts',
    rationale:
      'både det destinations-ejende modul og save-blokeringens fokus-flade findes stadig; forsvinder de, er '
      + 'mekanismen flyttet og reglen skal skrives om',
    minimumMatches: 2,
    requiredPaths: [EDITOR_LOCATION_DESTINATION_MODULE, 'src/inputCore/react/saveBlockedFocus.ts'],
  },
  appliesTo: (relativePath) =>
    FOCUS_NAVIGATION_SURFACES.includes(relativePath as (typeof FOCUS_NAVIGATION_SURFACES)[number]),
  find: (entry) => collectAddressDerivedDestinationUses(entry),
  allow: [],
  violatingFixtures: [
    // R7-F03's præcise fejlform: sektionens standardfane som fallback i fokus-fladen.
    {
      relativePath: 'src/inputCore/react/saveBlockedFocus.ts',
      code: 'const tab = PAGE_DEFAULT_TAB[address.section];',
    },
    // Et genindført EO-fanekort ville have samme virkning.
    {
      relativePath: 'src/inputCore/react/editorLocationDestination.ts',
      code: "const tab = address.path.length === 0 ? EO_TAB_KEYS.BEREGNING : EO_TAB_KEYS.LOENINDKOMST;",
    },
  ],
  cleanFixtures: [
    // Den godkendte model: spørg den mountede editor.
    {
      relativePath: 'src/inputCore/react/saveBlockedFocus.ts',
      code: "import { lookupEditorLocation } from './editorLocationDestination';\nconst lookup = lookupEditorLocation(serialized);",
    },
    // Sektionens ROUTE er et faktum (sektionen ejer en side) og er ikke en fane-udledning.
    {
      relativePath: 'src/inputCore/react/saveBlockedFocus.ts',
      code: "import { getRouteForPageKey } from '../../config/pageNavigation';\nconst route = getRouteForPageKey(address.section);",
    },
    // En kommentar, der forklarer den afløste model, må ikke bære reglen (INC-F03).
    {
      relativePath: 'src/inputCore/react/saveBlockedFocus.ts',
      code: '// Den afløste model slog fanen op i PAGE_DEFAULT_TAB og EO_TAB_KEYS; nu ejer lokationen den.\nconst x = 1;',
    },
    // Uden for fokus-fladerne er fane-kortene helt legitime.
    {
      relativePath: 'src/components/pages/Erstatningsopgoerelse.tsx',
      code: 'const initial = PAGE_DEFAULT_TAB.erstatningsopgoerelse;',
    },
  ],
});

/**
 * Modulet, der BYGGER restore-target-attributterne. Kun det måles: `useFormFieldSurface`/`useGridCellSurface`
 * kalder builderen og spreder dens færdige objekt, så de kan ikke tabe en enkelt attribut. Fuldstændigheden
 * ejes af producenten, og reglen peger derfor ét sted.
 */
const RESTORE_ATTRIBUTE_BUILDER_MODULE = 'src/inputCore/react/historyRestoreTarget.ts';

/** De fire attribut-konstanter, en fokuserbar greenfield-editor SKAL bære. */
const REQUIRED_RESTORE_ATTRS: readonly string[] = [
  'FIELD_ADDRESS_ATTR',
  'EDITOR_LOCATION_ATTR',
  'EDITOR_ROUTE_ATTR',
  'EDITOR_TAB_ATTR',
];

/**
 * Bygger `buildRestoreTargetAttributes` fortsat ALLE fire attributter?
 *
 * Kontrakten kan ikke bæres af typen: `RestoreTargetAttributes` er et objekt af strenge, så en udgave, der
 * droppede de to destinationsattributter fra det PRODUCEREDE objekt, ville typechecke lige så godt, mens
 * fokusnavigationen blev inert.
 *
 * ⚠️ Målingen sker udelukkende inde i BUILDERENS returnerede objekt-literal — ikke over hele filen. Den første
 * udgave af denne regel talte enhver computed property i filen, og `RestoreTargetAttributes`-TYPENS fire
 * computed keys opfyldte den derfor på egen hånd: en mutation, der fjernede
 * `[EDITOR_ROUTE_ATTR]`/`[EDITOR_TAB_ATTR]` fra builderens objekt, forblev GRØN. Netop den fejlform er
 * review-planens grundregel 5 og INC-F03 igen — et grønt værn er ikke evidens for noget, før mutationen er
 * prøvet mod den LEVENDE kilde og ikke kun mod fixtures.
 */
const RESTORE_ATTR_BUILDER = 'buildRestoreTargetAttributes';

const missingRestoreAttributes = (entry: SourceEntry): readonly string[] => {
  const used = new Set<string>();
  let builderFound = false;

  /** Opsaml computed keys i ét objekt-literal (inkl. et `Object.freeze({...})`-wrap). */
  const collectKeysIn = (node: ts.Node): void => {
    const visit = (current: ts.Node): void => {
      if (ts.isComputedPropertyName(current) && ts.isIdentifier(current.expression)) {
        used.add(current.expression.text);
      }
      ts.forEachChild(current, visit);
    };
    visit(node);
  };

  const visit = (node: ts.Node): void => {
    // `export const buildRestoreTargetAttributes = (...) => Object.freeze({ ... })`
    if (ts.isVariableDeclaration(node)
      && ts.isIdentifier(node.name)
      && node.name.text === RESTORE_ATTR_BUILDER
      && node.initializer !== undefined) {
      builderFound = true;
      collectKeysIn(node.initializer);
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(entry.ast);

  // Findes builderen ikke længere under sit navn, er mønsteret flyttet. Det er IKKE grønt: rapportér alle fire,
  // så reglen tvinges opdateret frem for at gå stille i opløsning.
  if (!builderFound) return REQUIRED_RESTORE_ATTRS;
  return REQUIRED_RESTORE_ATTRS.filter((attr) => !used.has(attr));
};

export const restoreAttributesCarryDestinationRule = defineRule({
  id: 'input/restore-attributes-carry-destination',
  description:
    'Restore-target-attributterne skal bære BÅDE identiteten (feltadresse + lokations-id) OG destinationen '
    + '(route + fane). Uden destinationen kan save-blokeringens fokus ikke finde feltets fane, og '
    + 'fokusnavigationen bliver inert uden at nogen type fejler (R7-F03).',
  liveTarget: {
    kind: 'precondition',
    probe: (entry) => entry.relativePath === RESTORE_ATTRIBUTE_BUILDER_MODULE
      && missingRestoreAttributes(entry).length === 0,
    rationale:
      'attribut-builderen findes stadig og sætter alle fire attributter; flyttes bygningen et andet sted hen, '
      + 'skal reglens mål følge med frem for at stå grøn',
  },
  // Kun BUILDEREN måles. Forbrugerne (feltfamilierne) spreder et færdigt objekt og kan ikke tabe en enkelt
  // attribut; det er producenten, der ejer fuldstændigheden.
  appliesTo: (relativePath) => relativePath === RESTORE_ATTRIBUTE_BUILDER_MODULE,
  find: (entry) => {
    const missing = missingRestoreAttributes(entry);
    if (missing.length === 0) return [];
    return [{
      position: { line: 1, column: 1 },
      message:
        `Restore-target-attributterne mangler ${missing.join(', ')}. Et fokuserbart felt skal bære sin `
        + 'editorlokations EGEN route og fane, så save-blokeringens fokus kan sende brugeren til den rigtige '
        + 'fane uden et globalt adresse→fane-kort (§3.2/R7-F03).',
    }];
  },
  violatingFixtures: [
    // Den præcise regression: de to nye destinationsattributter droppes, identiteten beholdes.
    {
      relativePath: 'src/inputCore/react/historyRestoreTarget.ts',
      code: 'export const buildRestoreTargetAttributes = (a: string, b: string) => Object.freeze({ [FIELD_ADDRESS_ATTR]: a, [EDITOR_LOCATION_ATTR]: b });',
    },
    // Kun fanen droppet — et felt på en ikke-standard fane bliver da uopnåeligt.
    {
      relativePath: 'src/inputCore/react/historyRestoreTarget.ts',
      code: 'export const buildRestoreTargetAttributes = (a: string, b: string, r: string) => Object.freeze({ [FIELD_ADDRESS_ATTR]: a, [EDITOR_LOCATION_ATTR]: b, [EDITOR_ROUTE_ATTR]: r });',
    },
    // Builderen omdøbt væk: mønsteret er flyttet, og reglen må ikke gå stille i opløsning. Rapporteres som
    // alle fire manglende, selv om attributterne findes andetsteds i filen.
    {
      relativePath: 'src/inputCore/react/historyRestoreTarget.ts',
      code: 'export const makeAttrs = (a: string) => Object.freeze({ [FIELD_ADDRESS_ATTR]: a, [EDITOR_LOCATION_ATTR]: a, [EDITOR_ROUTE_ATTR]: a, [EDITOR_TAB_ATTR]: a });',
    },
  ],
  cleanFixtures: [
    {
      relativePath: 'src/inputCore/react/historyRestoreTarget.ts',
      code: 'export const buildRestoreTargetAttributes = (a: string, b: string, r: string, t: string | null) => Object.freeze({ [FIELD_ADDRESS_ATTR]: a, [EDITOR_LOCATION_ATTR]: b, [EDITOR_ROUTE_ATTR]: r, [EDITOR_TAB_ATTR]: t ?? "" });',
    },
  ],
});

// --- Hver persisteret fagside har ét kanonisk viewmodel-indgangspunkt (R7-F01) ---

/**
 * `page-component-contract.md` §4.4: hver persisteret fagside (§2.1) skal have PRÆCIS ÉT kanonisk
 * viewmodel-indgangspunkt, `useXxxViewModel`, og page-komponenten skal være reduceret til sektions-komposition.
 *
 * Reglen er KATEGORISK, ikke størrelses-gated: der er ingen LOC-tærskel. Det er netop derfor værnet ikke måler
 * filstørrelse — en tærskel ville acceptere syv kontraktbrud, så længe filerne var små nok, og ville samtidig
 * presse mod en kunstig opsplitning, når en side voksede. Værnet måler i stedet EKSISTENSEN af VM-indgangen.
 *
 * **Sidelisten er DERIVERET, ikke erklæret.** Den udledes af `APP_PAGE_DEFINITIONS` i
 * `src/config/pageNavigation.ts`, hvor route og page-komponent står samlet. Værnet ejer derfor intet parallelt
 * route→fil-map.
 */
const PAGE_NAVIGATION_MODULE = 'src/config/pageNavigation.ts';

type PageDefinition = Readonly<{ routeKey: string; componentFile: string }>;

/** Læs page-definitionerne ud som AST — ikke som tekst. */
const collectAppPageDefinitions = (entry: SourceEntry): readonly PageDefinition[] => {
  const definitions: PageDefinition[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isVariableDeclaration(node)
      && ts.isIdentifier(node.name)
      && node.name.text === 'APP_PAGE_DEFINITIONS'
      && node.initializer !== undefined) {
      const literal = ts.isAsExpression(node.initializer) ? node.initializer.expression : node.initializer;
      if (ts.isObjectLiteralExpression(literal)) {
        for (const property of literal.properties) {
          if (!ts.isPropertyAssignment(property) || !ts.isIdentifier(property.name)) continue;
          if (!ts.isObjectLiteralExpression(property.initializer)) continue;
          const componentProperty = property.initializer.properties.find((candidate) =>
            ts.isPropertyAssignment(candidate)
            && ts.isIdentifier(candidate.name)
            && candidate.name.text === 'componentFile'
          );
          if (
            componentProperty !== undefined
            && ts.isPropertyAssignment(componentProperty)
            && ts.isStringLiteral(componentProperty.initializer)
          ) {
            definitions.push({
              routeKey: property.name.text,
              componentFile: componentProperty.initializer.text,
            });
          }
        }
      }
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(entry.ast);
  return definitions;
};

const PAGE_ORCHESTRATION_PORTS = new Set([
  'useInputEvaluation',
  'useInputEditPort',
  'useInputReadPort',
  'useDocumentInputAccess',
  'useMineoDocumentOutput',
  'useMineoDocumentOutputWithContext',
  'useMineoDocumentSourceContext',
  'useAppSettings',
  'useDocumentDownloadAction',
  'useDocumentGateState',
  'usePersistedActiveTab',
  'useFieldEditor',
  'useCollectionRows',
  'useCaseOperations',
  'useOmregningToggle',
  'useMidlertidigtEetInsertSource',
  'useScrollToSectionWithRetry',
  'useInputCommands',
  'dispatchInput',
]);

const importedLocalName = (
  entry: SourceEntry,
  moduleSpecifier: string,
  exportedName: string
): string | null => {
  for (const statement of entry.ast.statements) {
    if (!ts.isImportDeclaration(statement)
      || !ts.isStringLiteral(statement.moduleSpecifier)
      || statement.moduleSpecifier.text !== moduleSpecifier) continue;
    const bindings = statement.importClause?.namedBindings;
    if (bindings === undefined || !ts.isNamedImports(bindings)) continue;
    const binding = bindings.elements.find((element) =>
      (element.propertyName ?? element.name).text === exportedName
    );
    if (binding !== undefined) return binding.name.text;
  }
  return null;
};

export const persistedPageHasViewModelRule = defineRule({
  id: 'input/persisted-page-has-viewmodel',
  description:
    'Hver persisteret fagside (§2.1) skal have præcis ét kanonisk `useXxxViewModel`-indgangspunkt, som ejer '
    + 'sidens afledte state, handlers og gates (page-component-contract.md §4.4). Sidelisten udledes af '
    + 'APP_ROUTES, så en ny fagside gør reglen rød frem for at falde uden for den (R7-F01).',
  liveTarget: {
    kind: 'precondition',
    // Målet er den DERIVEREDE sidelistes kilde plus page-komponenterne selv. Findes `APP_ROUTES` ikke længere
    // med nøgler, kan reglen ikke udlede noget, og den skal skrives om frem for at stå grøn af tomhed.
    probe: (entry) =>
      entry.relativePath === PAGE_NAVIGATION_MODULE && collectAppPageDefinitions(entry).length > 0,
    rationale:
      'APP_ROUTES findes stadig og har nøgler at udlede §2.1-sidelisten af; forsvinder det, skal reglen følge '
      + 'den nye kanoniske kilde',
    requiredPaths: [PAGE_NAVIGATION_MODULE],
  },
  // Reglen evalueres ÉN gang, på navigation-modulet: den skal se HELE grafen for at kunne følge en side til sin
  // VM, og en per-fil-evaluering ville ikke kunne udtrykke "denne side mangler en VM et andet sted".
  appliesTo: (relativePath) => relativePath === PAGE_NAVIGATION_MODULE,
  find: (entry, graph) => {
    const pageDefinitions = collectAppPageDefinitions(entry);
    const byPath = new Map(graph.map((candidate) => [candidate.relativePath, candidate]));
    const findings: Finding[] = [];

    for (const definition of pageDefinitions) {
      const pagePath = `src/components/pages/${definition.componentFile}`;
      const page = byPath.get(pagePath);
      if (page === undefined) {
        findings.push({
          position: { line: 1, column: 1 },
          message: `Page-komponenten ${pagePath} findes ikke i kildegrafen; værnets sideliste er forældet.`,
        });
        continue;
      }

      const componentStem = definition.componentFile.replace(/\.tsx$/, '');
      const expectedViewModel = `use${componentStem}ViewModel`;
      const expectedModule = `./${definition.routeKey}/use${componentStem}ViewModel`;
      const localViewModelName = importedLocalName(page, expectedModule, expectedViewModel);
      const calls = collectCalls(page);
      const pageViewModelCalls = calls.filter((ref) => /^use[A-Z][A-Za-z]*ViewModel$/.test(ref.calleeName));
      const expectedCalls = localViewModelName === null
        ? []
        : calls.filter((ref) => ref.calleeName === localViewModelName);

      if (localViewModelName === null || expectedCalls.length !== 1 || pageViewModelCalls.length !== 1) {
        findings.push({
          position: { line: 1, column: 1 },
          message:
            `${pagePath} skal importere og kalde præcis én ${expectedViewModel} fra ${expectedModule}; `
            + `fandt ${pageViewModelCalls.length} page-viewmodel-kald. Konkurrerende eller tomme ekstra `
            + 'viewmodels er ikke et kanonisk indgangspunkt (page-component-contract.md §4.4).',
        });
      }

      for (const call of calls.filter((ref) => PAGE_ORCHESTRATION_PORTS.has(ref.calleeName))) {
        findings.push({
          position: call.position,
          message:
            `${pagePath} kalder orkestreringsporten ${call.calleeName} direkte. Reader-, dokument-, fane- og `
            + 'inputorkestrering ejes af sidens kanoniske viewmodel (page-component-contract.md §4.4).',
        });
      }
    }

    return findings;
  },
  allow: [],
  violatingFixtures: [
    // Kernen: en page-definition uden den erklærede komponent må ikke passere ubemærket.
    {
      relativePath: PAGE_NAVIGATION_MODULE,
      code:
        "export const APP_PAGE_DEFINITIONS = { nyfagside: { route: '/nyfagside', "
        + "componentFile: 'Nyfagside.tsx' } } as const;",
    },
  ],
  cleanFixtures: [
    // En tom/ændret APP_ROUTES uden nøgler har intet at udlede; liveness-kontrollen fanger den i stedet, så
    // `find` skal ikke også flage den (ellers ville reglen være rød to gange for samme årsag).
    {
      relativePath: PAGE_NAVIGATION_MODULE,
      code: 'export const APP_PAGE_DEFINITIONS = {} as const;',
    },
  ],
});

// --- Ét felt-identitetssystem i DOM (GM-F10/INC-F14) --------------------------

/**
 * Den KANONISKE feltidentitet i DOM er den serialiserede feltadresse (`data-mineo-field-address`) plus
 * editorlokations-id'et. Det er den identitet undo/redo (`findRestoreTarget`), save-blokeringens fokus og
 * EO's fejllinks (`scrollToEoRow`) alle slår op på.
 *
 * Før GM-F10 fandtes to PARALLELLE, streng-baserede identiteter ved siden af: `data-mineo-field-path` og
 * `data-mineo-undo-field-path`, hvis værdi var et bart feltNAVN — eller for EO's rækkemål en
 * `tableId:rowScope:rowId:colIndex`-konvention. Det var ikke blot en dublet, men en BRUDT dublet:
 * grid-cellerne satte slet ikke attributterne, så hvert celle-præcist EO-fejllink faldt lydløst tilbage til
 * rækkeankeret, og ingen test kunne se det (INC-F14). Ved omlægningen havde BEGGE attributter i øvrigt nul
 * læsere tilbage og kun producenter — den endelige evidens for at modellen var en rest.
 *
 * Reglen måler alle tre former, attributterne faktisk optrådte i: en JSX-attribut (`StyledTextAreaBase`), en
 * quoted property i et slotProps-objekt eller en proptype (de fire immediate-commit-widgets) og en
 * `[attr="…"]`-selector i opslaget (`scrollToEoRow`).
 */
const FORBIDDEN_FIELD_IDENTITY_ATTRS: readonly string[] = [
  'data-mineo-field-path',
  'data-mineo-undo-field-path',
];

/** Modulet der EJER den kanoniske identitet. Findes det ikke, er mekanismen flyttet og reglen forældet. */
const CANONICAL_FIELD_IDENTITY_MODULE = 'src/inputCore/react/historyRestoreTarget.ts';

/**
 * Fladerne, hvor en streng-identitet kunne genopstå: hele felt-/celle-komponentlaget (producenterne) plus
 * fokusnavigationens forbrugere. Bevidst IKKE hele `src/`: en absence-test eller et fund-dokument skal kunne
 * navngive den slettede attribut, og et forbud i hele træet ville presse mod en undtagelsesliste, der
 * udvander reglen.
 */
const FIELD_IDENTITY_SURFACES = (relativePath: string): boolean =>
  relativePath.startsWith('src/components/inputs/')
  || relativePath.startsWith('src/inputCore/react/')
  || relativePath === 'src/utils/scrollToEoRow.ts'
  || relativePath === 'src/domain/eoRowEvaluation/eoRowIssueCatalog.ts'
  || relativePath === 'src/domain/erhvervsevnetab/eetIssueNavigation.ts';

const propertyNameText = (name: ts.PropertyName): string | null => {
  if (ts.isStringLiteral(name) || ts.isNoSubstitutionTemplateLiteral(name)) return name.text;
  if (ts.isIdentifier(name)) return name.text;
  if (ts.isComputedPropertyName(name)) {
    const { expression } = name;
    if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) return expression.text;
  }
  return null;
};

const collectForbiddenFieldIdentityAttrs = (entry: SourceEntry): readonly Finding[] => {
  const findings: Finding[] = [];

  const report = (node: ts.Node, attr: string, form: string): void => {
    const { line, character } = entry.ast.getLineAndCharacterOfPosition(node.getStart(entry.ast));
    findings.push({
      position: { line: line + 1, column: character + 1 },
      message:
        `${form} bruger '${attr}' som feltidentitet i DOM. Feltidentiteten er den serialiserede feltadresse `
        + '(data-mineo-field-address) plus editorlokations-id — ÉT system, som undo/redo, save-fokus og '
        + 'EO-fejllinks deler (§3.2). En navne- eller kolonnestreng ved siden af er den parallelle model, '
        + 'GM-F10 lukkede, og den var bevisligt uopnåelig for grid-celler (INC-F14).',
    });
  };

  const visit = (node: ts.Node): void => {
    // 1) JSX-attribut: <input data-mineo-field-path={name} />
    if (ts.isJsxAttribute(node) && ts.isIdentifier(node.name)) {
      const name = node.name.text;
      if (FORBIDDEN_FIELD_IDENTITY_ATTRS.includes(name)) report(node, name, 'En JSX-attribut');
    }

    // 2) Objekt-property (slotProps/inputProps) og TYPE-medlem: 'data-mineo-undo-field-path': name
    if (ts.isPropertyAssignment(node) || ts.isPropertySignature(node)) {
      const text = propertyNameText(node.name);
      if (text !== null && FORBIDDEN_FIELD_IDENTITY_ATTRS.includes(text)) {
        report(node, text, ts.isPropertySignature(node) ? 'En type-erklæring' : 'En objekt-property');
      }
    }

    // 3) Streng-literal i selector-position: '[data-mineo-field-path="…"]', også som template-del.
    if (ts.isStringLiteral(node)
      || ts.isNoSubstitutionTemplateLiteral(node)
      || ts.isTemplateHead(node)
      || ts.isTemplateMiddle(node)
      || ts.isTemplateTail(node)) {
      // En property-NØGLE er allerede rapporteret i (2); rapportér den ikke igen som selector.
      const isPropertyKey = node.parent !== undefined
        && (ts.isPropertyAssignment(node.parent) || ts.isPropertySignature(node.parent))
        && node.parent.name === node;
      const attr = FORBIDDEN_FIELD_IDENTITY_ATTRS.find((candidate) => node.text.includes(candidate));
      if (attr !== undefined && !isPropertyKey) report(node, attr, 'En DOM-selector');
    }

    ts.forEachChild(node, visit);
  };
  visit(entry.ast);

  return findings;
};

export const singleFieldIdentityInDomRule = defineRule({
  id: 'input/single-field-identity-in-dom',
  description:
    'Der findes ÉN feltidentitet i DOM: den serialiserede feltadresse plus editorlokations-id. De afløste '
    + 'navnestreng-attributter (data-mineo-field-path, data-mineo-undo-field-path) må ikke genindføres — de '
    + 'var en parallel model, og for grid-celler var de bevisligt uopnåelige (GM-F10/INC-F14).',
  liveTarget: {
    kind: 'precondition',
    // Målet er modulet, der ejer den kanoniske identitet, PLUS at EO's fejllink-opslag stadig bruger den.
    // Holder én af dem op med at findes, er mekanismen flyttet, og reglen skal skrives om frem for at stå grøn.
    //
    // ⚠️ EO-halvdelen måler et faktisk KALD, ikke blot at navnet nævnes. En `hasIdentifier`-probe var for svag:
    // et alias-import (`lookupEditorLocation as lookupMoved`) efterlader navnet i import-clausen, så proben
    // forblev sand, selv om opslaget var flyttet. Mutationen mod den levende kilde afslørede det (INC-F20) —
    // samme fejlklasse som INC-F11, hvor typens computed keys opfyldte et attribut-værn på egen hånd.
    probe: (entry) => {
      if (entry.relativePath === CANONICAL_FIELD_IDENTITY_MODULE) {
        return hasIdentifier(entry, 'FIELD_ADDRESS_ATTR');
      }
      if (entry.relativePath === 'src/utils/scrollToEoRow.ts') {
        return collectCalls(entry).some((call) => call.calleeName === 'lookupEditorLocation');
      }
      return false;
    },
    rationale:
      'den kanoniske identitets-attribut findes stadig, og EO-fejllinket KALDER stadig lookupEditorLocation; '
      + 'forsvinder en af de to, skal reglen følge mekanismen frem for at stå grøn',
    minimumMatches: 2,
    requiredPaths: [CANONICAL_FIELD_IDENTITY_MODULE, 'src/utils/scrollToEoRow.ts'],
  },
  appliesTo: FIELD_IDENTITY_SURFACES,
  find: (entry) => collectForbiddenFieldIdentityAttrs(entry),
  allow: [],
  violatingFixtures: [
    // Den præcise producentform, `StyledTextAreaBase` havde.
    {
      relativePath: 'src/components/inputs/StyledTextAreaBase.tsx',
      code: 'const el = <input data-mineo-field-path={name} />;',
    },
    // De fire immediate-commit-widgets' form: en quoted property i slotProps.
    {
      relativePath: 'src/components/inputs/StyledToggleSwitch.tsx',
      code: "const slot = { 'data-mineo-undo-field-path': resolvedName };",
    },
    // Typen, der gjorde propen lovlig, er lige så meget en genindførelse som producenten.
    {
      relativePath: 'src/components/inputs/StyledTextFieldBase.tsx',
      code: "type Attrs = { 'data-mineo-field-path'?: string };",
    },
    // Forbrugersiden: et opslag på navnestrengen i EO-fejllinket.
    {
      relativePath: 'src/utils/scrollToEoRow.ts',
      code: 'const el = document.querySelector("[data-mineo-undo-field-path=" + path + "]");',
    },
  ],
  cleanFixtures: [
    // Den godkendte model: spred de færdige restore-attributter.
    {
      relativePath: 'src/components/inputs/StyledToggleSwitch.tsx',
      code: 'const slot = { ...(restoreTargetAttributes ?? {}) };',
    },
    // Den kanoniske attribut selv må naturligvis nævnes og bruges.
    {
      relativePath: 'src/inputCore/react/historyRestoreTarget.ts',
      code: "export const FIELD_ADDRESS_ATTR = 'data-mineo-field-address';",
    },
    // EO-fejllinket slår op gennem editorlokationen på den kanoniske adresse.
    {
      relativePath: 'src/utils/scrollToEoRow.ts',
      code: 'const lookup = lookupEditorLocation(serializeFieldAddress(target.address));',
    },
    // En KOMMENTAR, der forklarer den afløste model, må ikke bære reglen (INC-F03's lærepunkt).
    {
      relativePath: 'src/utils/scrollToEoRow.ts',
      code: '// Den afløste model slog op via data-mineo-field-path og data-mineo-undo-field-path.\nconst x = 1;',
    },
    // Rækkeankeret er det GROVERE mål, ikke en parallel feltidentitet, og forbliver lovligt.
    {
      relativePath: 'src/utils/scrollToEoRow.ts',
      code: 'const el = document.querySelector("[data-mineo-row-id=" + rowId + "]");',
    },
  ],
});

// --- Fejlbokse må ikke kunne vises uden indhold -------------------------------

/**
 * Modulet der ejer de kanoniske besked-bokse, og de to komponenter det udstiller.
 */
const PAGE_MESSAGE_VIEW_OWNER = 'src/components/layout/PageMessageBox.tsx';
const PAGE_MESSAGE_COMPONENTS: readonly string[] = ['PageMessageBox', 'PageMessageRow'];

/**
 * Klasserne der KENDETEGNER en besked-/fejllinje i en ContentBox. Kombinationen er signaturen: en
 * `row--text`-Typography, hvis farve er `error.main`, ER en fejllinje — uanset hvad variablen bagved hedder.
 */
const MESSAGE_ROW_CLASS = 'row--text';
const ERROR_COLOR_TOKEN = 'error.main';

/**
 * Er noden en JSX-struktur, der tegner en RØD besked-linje?
 *
 * Måles på AST'et: en JSX-attribut `className="row--text"` i samme element-undertræ som strengen `error.main`.
 * En kommentar, der blot nævner klasserne, kan derfor ikke bære — eller udløse — reglen.
 */
const containsRedMessageRow = (node: ts.Node): boolean => {
  let hasMessageClass = false;
  let hasErrorColor = false;

  const visit = (current: ts.Node): void => {
    if (ts.isStringLiteral(current) || ts.isNoSubstitutionTemplateLiteral(current)) {
      if (current.text === MESSAGE_ROW_CLASS) hasMessageClass = true;
    }
    // `error.main` optræder som strengliteral i `sx={{ color: 'error.main' }}`.
    if (ts.isStringLiteral(current) && current.text === ERROR_COLOR_TOKEN) hasErrorColor = true;
    ts.forEachChild(current, visit);
  };
  visit(node);

  return hasMessageClass && hasErrorColor;
};

/** Bruger filen en af de kanoniske besked-komponenter som RIGTIGT JSX-tag? */
const usesPageMessageComponent = (entry: SourceEntry): boolean => {
  let found = false;
  const visit = (node: ts.Node): void => {
    if (found) return;
    if ((ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node))
      && ts.isIdentifier(node.tagName)
      && PAGE_MESSAGE_COMPONENTS.includes(node.tagName.text)) {
      found = true;
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(entry.ast);
  return found;
};

export const messageBoxGuardedByPageMessageRule = defineRule({
  id: 'ui/message-box-guarded-by-page-message',
  description:
    'En rød fejl-/beskedlinje på en fagside skal tegnes af `PageMessageBox`/`PageMessageRow` og dermed guardes '
    + 'af `hasPageMessage`, ikke af en håndrullet truthiness-vurdering (`{x && …}` / `if (!x) return null`). '
    + 'Årsløns "Kritisk Fejl"-boks stod permanent og TOM øverst på siden, fordi viewmodellen skrev `?? []` på '
    + 'et `string | null`-felt: et tomt array er truthy, så det håndrullede værn slap igennem, og `{[]}` '
    + 'renderede lovligt til ingenting. En boks med overskrift og intet indhold påstår en fejl, den ikke kan '
    + 'navngive. `PageMessage` gør fraværet til en EKSPLICIT variant, så forvekslingen ikke kan gentages.',
  liveTarget: {
    kind: 'precondition',
    // Målet er de kanoniske komponenters ejer PLUS mindst én side, der faktisk bruger dem. Forsvinder ejeren,
    // er mønsteret flyttet, og reglen skal skrives om frem for at stå grøn af tomhed.
    probe: (entry) => entry.relativePath === PAGE_MESSAGE_VIEW_OWNER || usesPageMessageComponent(entry),
    rationale:
      'de kanoniske besked-komponenter findes stadig OG bruges af mindst én fagside; forsvinder ejeren, '
      + 'er den ene render-vej for fejlbokse holdt op med at eksistere',
    requiredPaths: [
      PAGE_MESSAGE_VIEW_OWNER,
      'src/components/pages/aarsloen/AarsloenMeddelelserSections.tsx',
    ],
  },
  appliesTo: (relativePath) => relativePath.startsWith('src/components/pages/'),
  // Ingen undtagelser. EO's "Fejl og advarsler"-boks tegner sin download-fejllinje med en ikon-celle frem for
  // `error.main` og falder derfor uden for reglens signatur — den skal IKKE stå her som allowlist-post, for
  // anti-rot-kontrollen kræver at hver post faktisk stadig udløser reglen. Det var netop den kontrol, der
  // afviste en først-antaget undtagelse her.
  allow: [],
  find: (entry) => {
    const findings: Finding[] = [];
    const positionOf = (node: ts.Node): Finding['position'] => {
      const { line, character } = entry.ast.getLineAndCharacterOfPosition(node.getStart(entry.ast));
      return { line: line + 1, column: character + 1 };
    };

    const visit = (node: ts.Node): void => {
      // Mønsteret: `{cond && <JSX …>}` hvor JSX'en tegner en rød besked-linje.
      if (ts.isJsxExpression(node) && node.expression !== undefined
        && ts.isBinaryExpression(node.expression)
        && node.expression.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken
        && containsRedMessageRow(node.expression.right)) {
        findings.push({
          position: positionOf(node),
          message:
            'En rød besked-linje tegnes bag en håndrullet `{… && …}`-vurdering. Brug '
            + '`<PageMessageRow message={pageMessage(…)} />` (eller `PageMessageBox` for en boks med '
            + 'overskrift), så tilstedeværelsen afgøres af `hasPageMessage` og ikke af truthiness. En '
            + 'truthy-men-tom værdi (fx `[]` fra en forkert typet fallback) gav ellers en tom fejlboks.',
        });
      }
      ts.forEachChild(node, visit);
    };
    visit(entry.ast);

    return findings;
  },
  violatingFixtures: [
    // Den konkrete fejl: en håndrullet betinget rød besked-linje.
    {
      relativePath: 'src/components/pages/x/XTab.tsx',
      code: 'const C = () => <>{err && (<Box className="row--label-right-hover">'
        + '<Typography className="row--text" sx={{ color: "error.main" }}>{err}</Typography></Box>)}</>;',
    },
    // Samme fejl uden den ydre Box — klassen + farven ER signaturen.
    {
      relativePath: 'src/components/pages/y/YTab.tsx',
      code: 'const C = () => <>{msg && <Typography className="row--text" sx={{ color: "error.main" }}>{msg}</Typography>}</>;',
    },
  ],
  cleanFixtures: [
    // Den ønskede vej.
    {
      relativePath: 'src/components/pages/x/XTab.tsx',
      code: 'const C = () => <PageMessageRow message={pageMessage(err)} />;',
    },
    // En betinget NEUTRAL række (ingen error.main) er ikke en fejlboks og rammes ikke.
    {
      relativePath: 'src/components/pages/x/XTab.tsx',
      code: 'const C = () => <>{show && <Typography className="row--text">Download samlet oversigt</Typography>}</>;',
    },
    // En KOMMENTAR, der nævner mønsteret, må ikke udløse reglen.
    {
      relativePath: 'src/components/pages/x/XTab.tsx',
      code: '// Tidligere: {err && <Typography className="row--text" sx={{ color: "error.main" }}>…</Typography>}\n'
        + 'const C = () => <PageMessageRow message={pageMessage(err)} />;',
    },
  ],
});

// --- Collectiontabellernes række- og placeholder-ejerskab -------------------

const TABLE_SCOPE = 'src/components/tables/';

const jsxTagPositions = (entry: SourceEntry, tagName: string): readonly Finding[] => {
  const findings: Finding[] = [];
  const visit = (node: ts.Node): void => {
    if (
      (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node))
      && ts.isIdentifier(node.tagName)
      && node.tagName.text === tagName
    ) {
      const { line, character } = entry.ast.getLineAndCharacterOfPosition(node.tagName.getStart(entry.ast));
      findings.push({ position: { line: line + 1, column: character + 1 }, message: '' });
    }
    ts.forEachChild(node, visit);
  };
  visit(entry.ast);
  return findings;
};

const isTopLevelTable = (relativePath: string): boolean =>
  relativePath.startsWith(TABLE_SCOPE)
  && !relativePath.slice(TABLE_SCOPE.length).includes('/')
  && relativePath.endsWith('Table.tsx');

const DELETABLE_COLLECTION_TABLES = [
  'BeregnetRenteTable.tsx',
  'EetAslAfgoerelserTable.tsx',
  'FerieperiodeTable.tsx',
  'LoenudviklingManuelProcentsatsTable.tsx',
  'LoenudviklingManuelTable.tsx',
  'OevrigeKravTable.tsx',
  'OffentligeYdelserTable.tsx',
  'StandardLoenTable.tsx',
  'SvieSmerteTable.tsx',
  'TafPeriodeTable.tsx',
].map((name) => `${TABLE_SCOPE}${name}`);

export const deletableCollectionTableOwnershipRule = defineRule({
  id: 'form/deletable-collection-table-ownership',
  description:
    'En tabel med RowDeleteButton skal eje rækkernes identitet og kommandoer gennem inputCore-adapteren.',
  liveTarget: {
    kind: 'precondition',
    probe: (entry) => jsxTagPositions(entry, 'RowDeleteButton').length > 0,
    rationale: 'alle ti sletbare collectiontabeller findes og renderer fortsat RowDeleteButton',
    minimumMatches: DELETABLE_COLLECTION_TABLES.length,
    requiredPaths: DELETABLE_COLLECTION_TABLES,
  },
  appliesTo: isTopLevelTable,
  find: (entry) => {
    const deleteButtons = jsxTagPositions(entry, 'RowDeleteButton');
    if (deleteButtons.length === 0) return [];
    const calls = new Set(collectCalls(entry).map((call) => call.calleeName));
    if (calls.has('useCollectionTable') || calls.has('useCollectionRows')) return [];
    return deleteButtons.map(({ position }) => ({
      position,
      message: 'Sletbar collectiontabel uden useCollectionTable/useCollectionRows — rækkeidentitet og undo/redo mangler én autoritativ ejer.',
    }));
  },
  violatingFixtures: [{
    relativePath: `${TABLE_SCOPE}XTable.tsx`,
    code: 'const X = () => <RowDeleteButton onDelete={() => remove(localRow.id)} />;',
  }],
  cleanFixtures: [{
    relativePath: `${TABLE_SCOPE}XTable.tsx`,
    code: 'const rows = useCollectionRows(ref); const X = () => <RowDeleteButton onDelete={() => rows.remove(id)} />;',
  }],
});

/**
 * Cellen omkring `RowDeleteButton` er en KONTRAKT, ikke en stilart: knappen er `position: absolute`,
 * så mangler cellen `position: relative`, finder den nærmeste positionerede forfader — tabellens
 * container — og ikonet lander i tabellens hjørne i stedet for i rækken. Uden `paddingRight` ligger
 * det oven på celleindholdet.
 *
 * Kontrakten var hardkodet på hvert af de ti kaldsteder i fire stavemåder og var derfor lige så let
 * at glemme halvdelen af som at skrive rigtigt. Den bor nu i `RowDeleteLaneCell`/`rowDeleteLaneStyle`,
 * og denne regel lukker vejen tilbage: en celle må ikke selv stave kontrakten.
 */
const LANE_CELL_TAGS = new Set(['RowDeleteLaneCell']);
const LANE_STYLE_HELPER = 'rowDeleteLaneStyle';

/** Nærmeste omsluttende JSX-element (åbnings-tag-navn) for en node. */
const enclosingJsxTagName = (node: ts.Node): string | undefined => {
  for (let current = node.parent; current !== undefined; current = current.parent) {
    if (ts.isJsxElement(current)) {
      const { tagName } = current.openingElement;
      return ts.isIdentifier(tagName) ? tagName.text : undefined;
    }
  }
  return undefined;
};

/** Nærmeste omsluttende JSX-element hvis `style`/`sx` går gennem lane-helperen. */
const enclosingCellUsesLaneHelper = (node: ts.Node): boolean => {
  for (let current = node.parent; current !== undefined; current = current.parent) {
    if (!ts.isJsxElement(current)) continue;
    return current.openingElement.attributes.properties.some((prop) => (
      ts.isJsxAttribute(prop)
      && ts.isIdentifier(prop.name)
      && (prop.name.text === 'style' || prop.name.text === 'sx')
      && prop.initializer !== undefined
      && ts.isJsxExpression(prop.initializer)
      && prop.initializer.expression !== undefined
      && ts.isCallExpression(prop.initializer.expression)
      && ts.isIdentifier(prop.initializer.expression.expression)
      && prop.initializer.expression.expression.text === LANE_STYLE_HELPER
    ));
  }
  return false;
};

export const rowDeleteLaneCellRule = defineRule({
  id: 'form/row-delete-lane-cell-single-source',
  description:
    'RowDeleteButton skal stå i en lane-celle (RowDeleteLaneCell/rowDeleteLaneStyle) — cellekontrakten må ikke håndrulles.',
  liveTarget: {
    kind: 'precondition',
    probe: (entry) => jsxTagPositions(entry, 'RowDeleteButton').length > 0,
    rationale: 'alle ti sletbare collectiontabeller renderer fortsat RowDeleteButton i en celle',
    minimumMatches: DELETABLE_COLLECTION_TABLES.length,
    requiredPaths: DELETABLE_COLLECTION_TABLES,
  },
  find: (entry) => {
    const findings: Finding[] = [];
    const visit = (node: ts.Node): void => {
      if (
        (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node))
        && ts.isIdentifier(node.tagName)
        && node.tagName.text === 'RowDeleteButton'
      ) {
        const enclosingTag = enclosingJsxTagName(node);
        const inLaneCell = enclosingTag !== undefined && LANE_CELL_TAGS.has(enclosingTag);
        if (!inLaneCell && !enclosingCellUsesLaneHelper(node)) {
          const { line, character } = entry.ast.getLineAndCharacterOfPosition(node.tagName.getStart(entry.ast));
          findings.push({
            position: { line: line + 1, column: character + 1 },
            message:
              'RowDeleteButton uden lane-celle — brug <RowDeleteLaneCell> (løs tabel) eller rowDeleteLaneStyle(...) (<td>), '
              + 'så position: relative og den reserverede bane ikke kan glemmes halvt.',
          });
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(entry.ast);
    return findings;
  },
  violatingFixtures: [
    // Håndrullet kontrakt: præcis den form der var kopieret ti steder.
    {
      relativePath: `${TABLE_SCOPE}XTable.tsx`,
      code: 'const X = () => <TableCell sx={{ position: "relative", paddingRight: "28px" }}><RowDeleteButton onDelete={d} /></TableCell>;',
    },
    // Halvt glemt kontrakt (ingen position) — ikonet ville lande i tabellens hjørne.
    {
      relativePath: `${TABLE_SCOPE}XTable.tsx`,
      code: 'const X = () => <td style={{ paddingRight: 28 }}><RowDeleteButton onDelete={d} /></td>;',
    },
  ],
  cleanFixtures: [
    {
      relativePath: `${TABLE_SCOPE}XTable.tsx`,
      code: 'const X = () => <RowDeleteLaneCell><RowDeleteButton onDelete={d} /></RowDeleteLaneCell>;',
    },
    {
      relativePath: `${TABLE_SCOPE}XTable.tsx`,
      code: 'const X = () => <td style={rowDeleteLaneStyle(base)}><RowDeleteButton onDelete={d} /></td>;',
    },
    // En celle UDEN slet-knap er ikke reglens ærinde, selv om den ligner.
    {
      relativePath: `${TABLE_SCOPE}XTable.tsx`,
      code: 'const X = () => <td style={{ position: "relative" }}>{value}</td>;',
    },
  ],
});

const PLACEHOLDER_TABLES = [
  'BeregnetRenteTable.tsx',
  'EetAslAfgoerelserTable.tsx',
  'OevrigeKravTable.tsx',
  'StandardLoenTable.tsx',
].map((name) => `${TABLE_SCOPE}${name}`);
const LOCAL_PLACEHOLDER_POOL_NAMES = new Set(['placeholderIdsRef', 'placeholderIdRef']);

export const placeholderIdentityOwnershipRule = defineRule({
  id: 'form/placeholder-identity-single-owner',
  description:
    'Placeholder-identitet ejes af usePlaceholderSlotIds; tabeller må ikke genindføre en lokal id-pulje.',
  liveTarget: {
    kind: 'precondition',
    probe: (entry) => collectCalls(entry).some((call) => call.calleeName === 'usePlaceholderSlotIds'),
    rationale: 'de fire placeholder-tabeller bruger fortsat den delte identitetslivscyklus',
    minimumMatches: PLACEHOLDER_TABLES.length,
    requiredPaths: PLACEHOLDER_TABLES,
  },
  appliesTo: isTopLevelTable,
  find: (entry) => collectIdentifiers(entry)
    .filter((identifier) => LOCAL_PLACEHOLDER_POOL_NAMES.has(identifier.text))
    .map((identifier) => ({
      position: identifier.position,
      message: `Lokal placeholder-pulje (${identifier.text}) — brug usePlaceholderSlotIds som eneste ejer.`,
    })),
  violatingFixtures: [{
    relativePath: `${TABLE_SCOPE}XTable.tsx`,
    code: 'const placeholderIdsRef = React.useRef<string[]>([]);',
  }],
  cleanFixtures: [{
    relativePath: `${TABLE_SCOPE}XTable.tsx`,
    code: 'const placeholderIds = usePlaceholderSlotIds(committedIds, 1, createId);',
  }],
});
