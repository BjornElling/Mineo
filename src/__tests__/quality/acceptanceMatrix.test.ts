/**
 * Fase 7's acceptmatrix — det maskinelt kontrollerede register (WI-013).
 *
 * **Hvorfor dette register findes, og hvorfor det ikke er en manuel afkrydsning.**
 *
 * Planens Fase 7 beskrev de 15 acceptpunkter som en "manuel browsermatrix". Det afsnit blev skrevet
 * FØR fase 1-5 blev bygget, hvor inputtilstanden endnu var mount-afhængig og punkterne derfor kun
 * KUNNE observeres i en browser. Designet afskaffede netop den egenskab: §10-kriterium 22 kræver, at
 * "issues, beregninger og gates ikke afhænger af component mount", og kriterium 7, at et lukket felt
 * ingen værdibærende lokal kopi har. En manuel matrix ville måle arkitekturen med det instrument,
 * arkitekturen blev bygget for at fjerne — og et engangs-"OK" fra en menneskelig gennemgang rådner ved
 * næste commit uden at kunne fejle i CI.
 *
 * **Registret skal selv kunne fejle.** Fase 6's dødt-værn-detektor viste, at et værn, hvis mål er
 * slettet, bliver grønt af tomhed. Et register, der kun kontrollerede at en FIL findes, har præcis den
 * svaghed: testfilen kan overleve, mens netop den `it(...)`, punktet hvilede på, er væk. Derfor
 * verificeres hvert punkt på TESTNAVN — den mindste enhed, der faktisk bærer adfærden — og hvert navn
 * skal findes i den angivne fil.
 *
 * Registret er et REGISTER, ikke en ny testkopi: det peger på de assertions, der allerede bor ved deres
 * egen grænse. At samle de 15 punkters adfærd her ville duplikere dækning frem for at ensarte
 * sporbarhed.
 */
import fs from 'node:fs';
import ts from 'typescript';
import path from 'node:path';

type CoverageSource = Readonly<{
  /** Repo-relativ testfil. */
  file: string;
  /**
   * Navne på AKTIVE `it(...)`/`describe(...)`-deklarationer i filen, som bærer punktet. Matches som
   * substring MOD DE PARSEDE deklarationsnavne (ikke mod filens råtekst), så en omformulering af halen
   * ikke er en falsk fejl — men en slettet ELLER skippet test er.
   */
  tests: readonly string[];
}>;

type AcceptancePoint = Readonly<{
  /** Punktnummer i planens Fase 7-matrix (1-15). */
  point: number;
  title: string;
  sources: readonly CoverageSource[];
  /**
   * En KENDT begrænsning i punktets dækning, med den WI der lukker den.
   *
   * Tilføjet efter re-review (WI-013 R8): et punkt må ikke fremstå fuldt dækket, når dets dækning
   * beviseligt har et hul. Alternativet — at lade punktet stå uden note — er netop den falske
   * fuldstændighed, hele registret er bygget for at udelukke. Feltet er derfor en del af registrets
   * kontrakt, ikke en kommentar: testen nedenfor kræver, at den nævnte WI-fil FINDES, så et hul ikke
   * kan dokumenteres væk med en henvisning til en opfølgning, ingen har oprettet.
   */
  knownLimitation?: Readonly<{ description: string; trackedIn: string }>;
}>;

const ACCEPTANCE_MATRIX: readonly AcceptancePoint[] = [
  {
    point: 1,
    title: 'Åben valid draft uden live hop',
    sources: [
      {
        file: 'src/__tests__/inputCore/editor/fieldEditor.test.ts',
        tests: ['åben draft ændrer intet afsluttet input eller revision'],
      },
      {
        file: 'src/__tests__/inputCore/react/useFieldEditor.test.tsx',
        tests: ['åben draft ændrer intet afsluttet'],
      },
      {
        file: 'src/__tests__/inputCore/react/useFormFieldSurface.test.tsx',
        tests: ['lukket felt er readOnly og viser canonical fra revisionen'],
      },
    ],
  },
  {
    point: 2,
    title: 'Åben allerede fejlende draft med uændret rød markering',
    sources: [
      {
        file: 'src/__tests__/inputCore/editor/fieldEditor.test.ts',
        tests: ['eksisterende rød fejl bliver stående uændret under redigering'],
      },
      {
        file: 'src/__tests__/inputCore/react/gridAdapter.test.tsx',
        tests: ['viser cellens røde issue fra revisionen uændret under redigering'],
      },
      {
        file: 'src/__tests__/inputCore/react/fieldShells.test.tsx',
        tests: ['bevarer den røde feltmarkering, mens grid-cellen er åben'],
      },
    ],
  },
  {
    point: 3,
    title: 'Blur, Enter, klik væk og side-/fanenavigation',
    sources: [
      {
        file: 'src/__tests__/inputCore/react/useFormFieldSurface.test.tsx',
        tests: ['Enter i åben editor settler præcis én gang', 'blur settler den åbne draft'],
      },
      {
        // KLIK VÆK — eget ben. To tidligere referencer her var forkerte og blev afvist af review:
        // `'KLIK'` matchede en describe om to-trins-ÅBNING (R1), og en Escape-test måler den MODSATTE
        // regel: at intet committes (R7). Punktet har nu sin egen test, der faktisk klikker uden for
        // feltet i den ægte side.
        file: 'src/__tests__/components/pages/VarigeMen.clickAwaySettle.test.tsx',
        tests: [
          'afslutter draften, når brugeren klikker på et element uden for feltet',
          'afslutter også en FEJLENDE draft ved klik væk og viser fejlen',
        ],
      },
      {
        // SIDE-navigation (fail-closed guard).
        file: 'src/__tests__/components/layout/MainLayout.navigationCommitGuard.test.tsx',
        tests: ['keeps navigation fail-closed when an editable field is still active'],
      },
      {
        // FANE-navigation — hullet WI-013 lukkede.
        file: 'src/__tests__/components/pages/VarigeMen.tabNavigationSettle.test.tsx',
        tests: [
          'afslutter en GYLDIG åben draft, når brugeren skifter fane',
          'fortsætter fane-skiftet ved et FEJLENDE settle og bevarer fejlen',
        ],
      },
    ],
  },
  {
    point: 4,
    title: 'Escape fra gyldigt, tomt og fejlende afsluttet udgangspunkt',
    sources: [
      {
        file: 'src/__tests__/inputCore/editor/fieldEditor.test.ts',
        tests: [
          // De tre udgangspunkter; de to sidste lukkede WI-013.
          'Escape lukker uden command, og et efterfølgende blur settler ikke',
          'Escape fra et TOMT udgangspunkt efterlader feltet tomt uden revision eller fejl',
          'Escape fra et FEJLENDE afsluttet udgangspunkt bevarer den afviste råtekst uændret',
        ],
      },
      {
        file: 'src/__tests__/components/inputs/transient/useTransientDraft.test.tsx',
        tests: ['Escape fortryder — og det EFTERFØLGENDE blur må ikke committe den forkastede draft'],
      },
    ],
  },
  {
    point: 5,
    title: 'Formatfejl og bounds-fejl med samme gates og forskellige beskeder',
    sources: [
      {
        file: 'src/__tests__/inputCore/inputCore.test.ts',
        tests: ['Ens rød konsekvens, men strukturel save-sondring for format og bounds'],
      },
      {
        file: 'src/__tests__/document/documentGateMatrix.test.ts',
        tests: ['klasse INVALID (format)', 'klasse BOUNDS'],
      },
    ],
  },
  {
    point: 6,
    title: 'Tomt required felt: ingen rød markering, contentbox-fejl og outputblokering',
    sources: [
      {
        file: 'src/__tests__/inputCore/inputCore.test.ts',
        tests: ['Tomhed og missing', 'et tomt felt giver ingen rød feltfejl og blokerer ikke .eo'],
      },
      {
        file: 'src/__tests__/document/documentGateMatrix.test.ts',
        tests: ['klasse MISSING'],
      },
    ],
  },
  {
    point: 7,
    title: 'Warning uden blokering',
    sources: [
      {
        file: 'src/__tests__/document/documentGateMatrix.test.ts',
        tests: ['warnings blokerer intet'],
      },
      {
        file: 'src/__tests__/domain/eoRowEvaluation/eoRowSeverity.test.ts',
        tests: ['returns max EO row status from integrity issues'],
      },
    ],
  },
  {
    point: 8,
    title: 'Skjul fejlende input; vis gyldigt input igen',
    sources: [
      {
        file: 'src/__tests__/inputCore/inputCore.test.ts',
        tests: ['Styrende valg rydder nu-irrelevante feltfejl, bevarer gyldigt'],
      },
      {
        file: 'src/__tests__/domain/erstatningsopgoerelse/eoHiddenFieldPersistence.test.ts',
        tests: ['bevarer ALLE skjulte felter gennem save→load-round-trip'],
      },
    ],
  },
  {
    point: 9,
    title: 'Undo/redo-kæderne i §7.2',
    sources: [
      {
        file: 'src/__tests__/inputCore/inputCore.test.ts',
        tests: ['Obligatorisk statekæde: gyldig A → ugyldig X → undo → redo'],
      },
      {
        file: 'src/__tests__/inputCore/runtime/dispatchInput.test.ts',
        tests: ['dispatchInput — undo/redo'],
      },
      {
        file: 'src/__tests__/components/layout/MainLayout.undoRedoEditorGuard.test.tsx',
        tests: ['ignores undo shortcuts silently while an editor is open', 'calls undo when no editor is active'],
      },
    ],
  },
  {
    point: 10,
    title: 'F5 med gyldigt og fejlende afsluttet input samt åben draft',
    sources: [
      {
        file: 'src/__tests__/inputCore/runtime/dispatchInput.test.ts',
        tests: [
          'genindlæser en gyldig gemt session',
          // De tre nedenfor lukkede WI-013: fejlende input og den ikke-persisterede draft.
          'genindlæser en session med REJECTED råtekst, så feltfejlen genopstår',
          'genindlæser en session med en canonical BOUNDS-fejl med værdien bevaret',
          'envelopen har kun de to afsluttede kanaler',
          'fail-closed ved korruption',
        ],
      },
      {
        // Draft-benets ADFÆRDSMÆSSIGE halvdel: en rigtig åben editor, der ikke genopstår efter
        // hydration. Tilføjet efter eksternt review (WI-013 R4), fordi runtime-testen ovenfor kun
        // beviser den STRUKTURELLE halvdel (envelopen har ingen draft-kanal).
        file: 'src/__tests__/inputCore/react/openDraftNotPersisted.test.tsx',
        tests: [
          'en ændret, IKKE-settlet draft findes ikke efter hydration',
          'en FEJLENDE, ikke-settlet draft persisteres heller ikke som rejected råtekst',
        ],
      },
    ],
  },
  {
    point: 11,
    title: 'Placeholder-række med første fejlende input',
    sources: [
      {
        file: 'src/__tests__/inputCore/react/gridAdapter.test.tsx',
        tests: ['første ugyldige settle promoverer rækken med rejected råtekst'],
      },
      {
        file: 'src/__tests__/inputCore/runtime/dispatchInput.test.ts',
        // F5-benet (§10-kriterium 18) lukkede WI-013.
        tests: ['en placeholder-promoveret række med fejlende felt overlever reload'],
      },
    ],
  },
  {
    point: 12,
    title: 'Række-delete og undo/redo',
    sources: [
      {
        file: 'src/__tests__/inputCore/inputCore.test.ts',
        tests: ['række-fejl → slet → undo → redo bevarer hele snapshotkæden'],
      },
      {
        file: 'src/__tests__/inputCore/react/gridAdapter.test.tsx',
        tests: ['row-delete fjerner rækkens rejected descendants atomisk'],
      },
    ],
  },
  {
    point: 13,
    title: '.eo-save/load og gammel tolerant .eo',
    sources: [
      {
        file: 'src/__tests__/utils/eoFileCodec.test.ts',
        tests: ['afkoder præcis det encode byggede', 'decodeEoFile — fejl-semantik'],
      },
      {
        file: 'src/__tests__/utils/fileLoad.normalLoad.test.ts',
        tests: ['forward-tolerance'],
      },
      {
        file: 'src/__tests__/utils/fileRoundTrip.fullState.test.ts',
        tests: ['alle sektioner overlever ægte kryptering→fil→load uden datatab'],
      },
    ],
  },
  {
    point: 14,
    title: 'Hvert dokumentdomæne og begge outputformater, hvor de findes',
    knownLimitation: {
      description:
        'Format-invariansen er målt for alle 18 hovedapp-outputs, men kun 2 af 18 projektioner nås i '
        + 'deres READY-gren; de øvrige 16 sammenlignes blocked-mod-blocked. En formatafhængighed i en '
        + 'ready-gren ville derfor ikke blive fanget. Rodårsagen er, at `documentDownloadFormat` '
        + 'overhovedet er synligt i projektionskonteksten — værnet ligger oven på en åben capability.',
      trackedIn: 'work-items/WI-014-dokumentformat-ud-af-projektionskonteksten.md',
    },
    sources: [
      {
        file: 'src/__tests__/document/documentCatalogCompleteness.test.ts',
        tests: ['ét id = ét output på tværs af begge apps', 'alle 21 statiske outputs kan kun aktiveres gennem en lukket DocumentAction'],
      },
      {
        // Format-invariansen over alle 18 hovedapp-outputs lukkede WI-013.
        file: 'src/__tests__/document/documentGateFormatInvariance.test.ts',
        tests: [
          'dækker alle 18 katalogiserede hovedapp-outputs',
          'samme projektion for pdf og word',
        ],
      },
      {
        file: 'src/__tests__/document/documentFileName.test.ts',
        tests: ['bruger PDF- og Word-endelser med samme journalnr- og udkast-regel'],
      },
      {
        // Begge rendererkanaler pr. fixture. NB — den tidligere reference her var `'pdf'`, som ville
        // matche et importnavn lige så villigt som en test. Rettet efter eksternt review (WI-013 R1).
        file: 'src/__tests__/document/tableChannelParity.golden.test.ts',
        tests: ['tabel-kanal-paritet: PDF resolved presentation', 'tabel-kanal-paritet: Word document.xml'],
      },
    ],
  },
  {
    point: 15,
    title: 'Revisionændring under async dokumentforberedelse',
    sources: [
      {
        file: 'src/__tests__/document/documentLifecycleMatrix.test.ts',
        tests: [
          'revisionen flytter MELLEM settle og kildeoptagelse',
          'revisionen flytter under LAZY-LOAD',
          'revisionen flytter under RENDERING',
        ],
      },
      {
        file: 'src/__tests__/inputCore/runtime/criticalActionCoordinator.test.ts',
        tests: ['klargør load uden at settle eller kassere draften', 'kasserer draften efter en vellykket replacement'],
      },
    ],
  },
];

const readFile = (relativePath: string): string =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');

describe('Fase 7 acceptmatrix (planens §Fase 7)', () => {
  it('dækker præcis punkt 1-15 uden huller eller dubletter', () => {
    expect(ACCEPTANCE_MATRIX.map((entry) => entry.point))
      .toEqual(Array.from({ length: 15 }, (_, index) => index + 1));
  });

  it('hvert punkt har mindst én dækningskilde', () => {
    for (const entry of ACCEPTANCE_MATRIX) {
      expect(entry.sources.length, `punkt ${entry.point} (${entry.title}) mangler kilde`).toBeGreaterThan(0);
      for (const source of entry.sources) {
        expect(source.tests.length, `punkt ${entry.point}: ${source.file} uden testnavne`).toBeGreaterThan(0);
      }
    }
  });

  /**
   * En kendt begrænsning skal spores i en WI, der FINDES. Ellers kunne et dækningshul erklæres
   * "håndteret" med en henvisning til en opfølgning, ingen har oprettet — en påstand uden dækning,
   * hvilket er samme fejlklasse som resten af registret værner mod.
   */
  it('hver kendt begrænsning peger på en WI-fil, der findes', () => {
    const withLimitation = ACCEPTANCE_MATRIX.filter((entry) => entry.knownLimitation !== undefined);
    for (const entry of withLimitation) {
      const limitation = entry.knownLimitation!;
      expect(limitation.description.trim(), `punkt ${entry.point}: tom begrænsningsbeskrivelse`).not.toBe('');
      expect(
        fs.existsSync(path.resolve(process.cwd(), limitation.trackedIn)),
        `punkt ${entry.point}: begrænsningen henviser til ${limitation.trackedIn}, som ikke findes`
      ).toBe(true);
    }
    // Punkt 14's begrænsning er den ENESTE kendte ved Fase 7's lukning. Lukkes den (WI-014), skal
    // noten fjernes; opstår en ny, skal den skrives ind. Gulvet gør begge synlige.
    expect(withLimitation.map((entry) => entry.point)).toEqual([14]);
  });
});

/**
 * Udtrækker navnene på AKTIVE `it`/`test`/`describe`-deklarationer i en testfil — via TypeScripts AST.
 *
 * **Hvorfor ikke `content.includes(navn)`** (rettet efter eksternt review, WI-013 R1): en substring-
 * søgning beviser kun, at teksten forekommer et vilkårligt sted i filen — den kunne matche et
 * importnavn eller en kommentar. Registret ville da erklære et punkt dækket af en test, der ikke
 * findes.
 *
 * **Hvorfor ikke en regex over råteksten** (rettet efter re-review, WI-013 R6): den første rettelse
 * brugte en regex med et linje-lokalt skip-filter. Den var stadig falsk-grøn på to måder, verificeret
 * ved probe:
 *
 *   - `describe.skip('suite', () => { it('navn', …) })` — den INDLEJREDE `it` består sit eget
 *     linje-filter, selv om hele suiten er skippet. Skip arves ned gennem hierarkiet; et linjefilter
 *     kan per konstruktion ikke se det.
 *   - `// it('navn', …)` i en kommentar blev medtaget som en levende deklaration.
 *
 * Begge kræver, at man kender STRUKTUREN, ikke bare teksten. Derfor walkes AST'et nu: kommentarer og
 * strengliteraler er ikke kald, og skip-tilstanden nedarves eksplicit gennem callback-kroppen.
 *
 * `.skip`/`.todo`/`.failing`/`.skipIf` udelukkes (inkl. arvet fra en ancestor); `.each`/`.only`/
 * `.concurrent`/`.runIf` medtages, da de kører.
 */
const SUITE_FNS = new Set(['it', 'test', 'describe', 'suite']);
const SKIPPING_MODIFIERS = new Set(['skip', 'todo', 'failing', 'skipIf']);

/** Bunden af en kaldekæde: `it.each(x)('n')` → `it`, plus de modifikatorer der blev brugt. */
const unwrapCallee = (expression: ts.Expression): { root: string; modifiers: string[] } | null => {
  const modifiers: string[] = [];
  let current: ts.Expression = expression;
  for (;;) {
    if (ts.isIdentifier(current)) {
      return SUITE_FNS.has(current.text) ? { root: current.text, modifiers } : null;
    }
    if (ts.isPropertyAccessExpression(current)) {
      modifiers.push(current.name.text);
      current = current.expression;
      continue;
    }
    // `it.each([...])(...)` / `it.skipIf(cond)(...)`: tag-kaldet er selv et CallExpression.
    if (ts.isCallExpression(current)) {
      current = current.expression;
      continue;
    }
    return null;
  }
};

const activeTestNames = (content: string, fileName = 'test.tsx'): readonly string[] => {
  const source = ts.createSourceFile(
    fileName, content, ts.ScriptTarget.Latest, /* setParentNodes */ true,
    fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );
  const names: string[] = [];

  const visit = (node: ts.Node, insideSkipped: boolean): void => {
    if (!ts.isCallExpression(node)) {
      node.forEachChild((child) => visit(child, insideSkipped));
      return;
    }
    const callee = unwrapCallee(node.expression);
    if (callee === null) {
      node.forEachChild((child) => visit(child, insideSkipped));
      return;
    }

    const skipped = insideSkipped || callee.modifiers.some((m) => SKIPPING_MODIFIERS.has(m));
    const [first] = node.arguments;
    if (!skipped && first !== undefined) {
      if (ts.isStringLiteralLike(first)) {
        names.push(first.text);
      } else if (ts.isTemplateExpression(first)) {
        // Et dynamisk navn (`${definition.id}: samme projektion …`) er stadig en aktiv deklaration.
        // De STATISKE dele er det, registret kan citere; interpolationerne er per-case-værdier, som
        // ingen registerpost kan kende på forhånd.
        names.push(first.head.text, ...first.templateSpans.map((span) => span.literal.text));
      }
    }
    // Kroppen walkes med den ARVEDE skip-tilstand: en `it` inde i en `describe.skip` er ikke aktiv.
    node.forEachChild((child) => visit(child, skipped));
  };

  visit(source, false);
  return names;
};

describe('Fase 7 acceptmatrix (planens §Fase 7) — kilde-verifikation', () => {
  /**
   * Kernekontrollen. En ren fil-eksistens-check ville bestå, selv om netop den test, punktet hviler
   * på, var slettet — filen kan sagtens overleve sin relevante `it(...)`. Derfor kontrolleres, at
   * navnet hører til en AKTIV testdeklaration.
   */
  it('hver angivet test findes som en aktiv deklaration (registret kan ikke blive grønt af tomhed)', () => {
    for (const entry of ACCEPTANCE_MATRIX) {
      for (const source of entry.sources) {
        const absolute = path.resolve(process.cwd(), source.file);
        expect(fs.existsSync(absolute), `punkt ${entry.point}: mangler fil ${source.file}`).toBe(true);
        const declared = activeTestNames(readFile(source.file), source.file);
        expect(
          declared.length,
          `punkt ${entry.point}: ${source.file} har ingen aktive testdeklarationer`
        ).toBeGreaterThan(0);
        for (const testName of source.tests) {
          expect(
            declared.some((name) => name.includes(testName)),
            `punkt ${entry.point} (${entry.title}): ingen AKTIV test i ${source.file} hedder noget, der `
            + `indeholder "${testName}". Er testen omdøbt, opdatér registret; er den slettet eller `
            + 'skippet, er punktet UDÆKKET.'
          ).toBe(true);
        }
      }
    }
  });

  /**
   * Modsat retning: kontrollen skal kunne FEJLE. Et prædikat, der ikke kan afvise et navn, som
   * beviseligt IKKE er deklareret, ville bestå alt (jf. Fase 6's `verifyAbsent`-lære).
   */
  it('kontrollen afviser et navn, der ikke er en aktiv deklaration — prædikatet er ikke vakuøst', () => {
    const declared = activeTestNames(
      readFile('src/__tests__/inputCore/editor/fieldEditor.test.ts'),
      'src/__tests__/inputCore/editor/fieldEditor.test.ts'
    );
    // Et navn, der IKKE findes, afvises.
    expect(declared.some((name) => name.includes('dette testnavn findes bevisligt ikke'))).toBe(false);
    // Et navn, der findes, genkendes — ellers var prædikatet blot altid falsk.
    expect(declared.some((name) => name.includes('Escape lukker uden command'))).toBe(true);
  });

  it('parseren medtager ikke skippede tests, arvet skip eller kommentarer', () => {
    // Syntetisk kilde, så parseren prøves i BEGGE retninger uden at afhænge af, at produktionen
    // tilfældigvis indeholder de svære former. De to sidste NOT-cases er præcis dem, den tidligere
    // regex-baserede version FALDT på (WI-013 R6, verificeret ved probe før rettelsen).
    const synthetic = [
      "it('aktiv test', () => {});",
      "it.skip('skippet test', () => {});",
      "describe.todo('todo-suite');",
      "it.each([1])('parametriseret test', () => {});",
      "it.only('only-test', () => {});",
      "it.skipIf(true)('skipIf-test', () => {});",
      "it.runIf(true)('runIf-test', () => {});",
      // ARVET skip: den indlejrede `it` består sit eget linjefilter, men suiten er skippet.
      "describe.skip('skippet suite', () => {",
      "  it('indlejret i skippet suite', () => {});",
      '});',
      // En aktiv suite skal derimod IKKE smitte sine børn med skip.
      "describe('aktiv suite', () => {",
      "  it('indlejret i aktiv suite', () => {});",
      '});',
      // Kommentar og strengliteral er ikke deklarationer.
      "// it('navn i linjekommentar', () => {});",
      "const s = \"it('navn i strengliteral', () => {})\";",
      // Dynamisk navn: de statiske dele er evidens, interpolationen kan ingen registerpost kende.
      'it(`${x}: dynamisk navn med statisk hale`, () => {});',
      'it.skip(`${x}: skippet dynamisk navn`, () => {});',
    ].join('\n');

    const declared = activeTestNames(synthetic, 'synthetic.ts');

    expect(declared).toContain('aktiv test');
    expect(declared).toContain('parametriseret test');
    expect(declared).toContain('only-test');
    expect(declared).toContain('runIf-test');
    expect(declared).toContain('aktiv suite');
    expect(declared).toContain('indlejret i aktiv suite');

    expect(declared).not.toContain('skippet test');
    expect(declared).not.toContain('todo-suite');
    expect(declared).not.toContain('skipIf-test');
    expect(declared).not.toContain('skippet suite');
    expect(declared).not.toContain('indlejret i skippet suite');
    expect(declared).not.toContain('navn i linjekommentar');
    expect(declared).not.toContain('navn i strengliteral');

    // Dynamiske navne: statisk hale medtages, men ikke hvis deklarationen er skippet.
    expect(declared.some((name) => name.includes('dynamisk navn med statisk hale'))).toBe(true);
    expect(declared.some((name) => name.includes('skippet dynamisk navn'))).toBe(false);
  });
});
