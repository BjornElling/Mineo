import fs from 'node:fs';
import path from 'node:path';

import ts from 'typescript';

/**
 * Værn mod de måleartefakter, der har kostet E2E-suiten mest tid.
 *
 * Fælles for dem alle: testen måler noget ANDET end det, den påstår at måle. Den er derfor grøn på en
 * hurtig maskine og rød på en langsom – uden at produktet har ændret sig. Det er netop den slags fund,
 * der bruger et fuldt timeout-loft og ligner en produktfejl uden at være det.
 *
 *  1. **Kapløb mod en transient klasse.** Blinkmarkeringen står i 1,5 s og fjernes så af
 *     `fieldAttentionBlink.ts`. En `expect(locator).toHaveClass(/mineo-field-attention-blink/)` spørger
 *     den LEVENDE DOM og vinder kun, hvis testprocessen når frem inden timeren. Gør den ikke det, bruges
 *     hele timeout-loftet på en tilstand, der aldrig kommer igen. Den korrekte form er at skrive
 *     observationen ned, mens klassen står der, og hævde på den bagefter.
 *
 *  2. **`dblclick()` → `fill()` uden bekræftelse.** Dobbeltklikket åbner feltets redigeringstilstand,
 *     men kun hvis feltet er interaktivt, OG hvis browserens to klik falder inden for dens
 *     dobbeltklik-interval. Glipper det, skriver `fill()` i et felt, der ikke redigerer. Den delte
 *     `setFieldValue`/`setFieldValueAndSettle` venter på interaktivitet og bekræfter, at værdien landede.
 *
 *  3. **Sidemenu-navigation uden ventepunkt.** Et klik på en menuknap skifter kun URL'en; siderne er
 *     lazy chunks, så den FORRIGE side bliver stående, indtil chunken er hentet og monteret. Måler den
 *     næste påstand på noget generisk – en `.content-box`, en knap, en dialog – er den forrige side som
 *     regel et gyldigt svar, og testen bliver grøn på det forkerte grundlag. Det er ikke teoretisk:
 *     `content-scale.spec.ts` › «skærmprint …» åbnede rapportdialogen på den stadig viste
 *     Indstillinger-side og brugte derefter 90 s på at vente på en knap i en dialog, som forsvandt igen,
 *     da destinationen monterede. `openPage` fra `e2e/support/mineoTest.ts` venter på sidens egen titel.
 *
 *  4. **Egen kopi af login/testpassword.** Kopien er ikke i sig selv en fejl, men den er mekanismen
 *     bag drift: den delte `login` har ét ventepunkt for app-shellen, og en kopi uden det starter sin
 *     første handling mod en tom side.
 *
 *  5. **Motorafhængig forgrening uden browserbane.** En test, der springer sig selv over i alt andet
 *     end Firefox eller WebKit, kører KUN et sted, hvis dens `describe` bærer `@browsere` – ellers
 *     ligger den i basisbanen (Chrome) og springer sig selv over hver eneste gang. Den ser grøn ud i
 *     optællingen og hævder intet.
 *
 * Værnet er en AST-kontrol, ikke en regex: det skal kunne skelne kode fra kommentar (alle mønstrene
 * OMTALES netop i kommentarerne ovenfor og i specs' egne forklaringer), hvilket en tekstsøgning ikke kan.
 */

const E2E_DIR = path.resolve(__dirname, '../../../e2e');
const BLINK_CLASS = 'mineo-field-attention-blink';

/** Den delte helper, der har afløst det bare dobbeltklik. */
const SHARED_HELPERS = ['setFieldValue', 'setFieldValueAndSettle'] as const;

/**
 * Sidemenuens etiketter – samme mængde som `MINEO_PAGE_TITLES` i `e2e/support/mineoTest.ts`.
 *
 * Listen står her frem for at blive importeret, fordi værnet skal kunne fejle, hvis helperen selv
 * forsvinder. En import ville gøre værnet grønt af tomhed i netop det tilfælde; parret holdes i stedet
 * sammen af selv-testen «etiketterne findes stadig i helperen» nedenfor.
 */
const SIDE_MENU_LABELS = [
  'Stamdata',
  'Erstatningsopgørelse',
  'Erhvervsevnetab',
  'Varige mén',
  'Forsørgertab',
  'Årslønsberegning',
  'Renteberegning',
  'Satser',
  'Indstillinger',
  'Om',
] as const;

/** Testpasswordet hører ét sted til: `TEST_PASSWORD` i `e2e/support/mineoTest.ts`. */
const TEST_PASSWORD = 'Mineo-Codex-Test-2026';

/** De motorer, basisbanen IKKE dækker. En forgrening på dem kræver `@browsere`. */
const NON_BASELINE_ENGINES = ['firefox', 'webkit'] as const;

interface Violation {
  readonly file: string;
  readonly line: number;
  readonly detail: string;
}

const listSpecFiles = (): readonly string[] =>
  fs.readdirSync(E2E_DIR)
    .filter((name) => name.endsWith('.spec.ts'))
    .map((name) => path.join(E2E_DIR, name));

const parse = (filePath: string): ts.SourceFile =>
  ts.createSourceFile(
    filePath,
    fs.readFileSync(filePath, 'utf8'),
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    ts.ScriptKind.TS,
  );

const lineOf = (source: ts.SourceFile, node: ts.Node): number =>
  source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;

/** `x.dblclick()` som et FAKTISK kald – ikke ordet «dblclick» i en kommentar eller en streng. */
const findBareDoubleClickCalls = (source: ts.SourceFile): readonly ts.Node[] => {
  const found: ts.Node[] = [];
  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node)
      && ts.isPropertyAccessExpression(node.expression)
      && node.expression.name.text === 'dblclick'
    ) {
      found.push(node);
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(source, visit);
  return found;
};

/**
 * `expect(...).toHaveClass(...)` hvor argumentet nævner blinkklassen – altså en påstand, der venter på
 * den transiente markering i den levende DOM.
 */
const findLiveBlinkClassAssertions = (source: ts.SourceFile): readonly ts.Node[] => {
  const found: ts.Node[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const method = node.expression.name.text;
      if (method === 'toHaveClass') {
        // Både `toHaveClass(new RegExp(BLINK_CLASS))` og `toHaveClass(BLINK_CLASS)`; identifikatoren
        // `BLINK_CLASS` og den bare streng dækkes begge.
        const argumentText = node.arguments.map((argument) => argument.getText(source)).join(' ');
        if (argumentText.includes('BLINK_CLASS') || argumentText.includes(BLINK_CLASS)) {
          found.push(node);
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(source, visit);
  return found;
};

/**
 * `page.getByRole('button', { name: '<sidemenu-etiket>' }).click()` som et faktisk kald.
 *
 * Mønsteret genkendes på kæden – `getByRole(...)` et sted inde i modtageren af `.click()` – så både
 * `page.getByRole(...).click()` og `page.getByRole(...).first().click()` fanges.
 *
 * **Reglens loft, sagt højt:** navnet skal stå som en LITERAL. En løkke over sidenavne i en variabel
 * (`{ name: pageName }`) fanges ikke. Alternativet – at flage ethvert variabelnavn – ville ramme de
 * tests, der med vilje aflæser menuknapperne UDEN at navigere (fx `minimum-viewport-shell`), og en regel
 * med falske positive bliver slået fra. Literal-formen er den, 63 kaldsteder faktisk brugte.
 */
const findUnsettledMenuNavigation = (source: ts.SourceFile): readonly ts.Node[] => {
  const found: ts.Node[] = [];

  const menuLabelOf = (node: ts.Node): string | null => {
    let current: ts.Node | undefined = node;
    while (current !== undefined && ts.isCallExpression(current)) {
      if (ts.isPropertyAccessExpression(current.expression) && current.expression.name.text === 'getByRole') {
        const [role, options] = current.arguments;
        if (role !== undefined && ts.isStringLiteral(role) && role.text === 'button' && options !== undefined) {
          const label = SIDE_MENU_LABELS.find((candidate) => options.getText(source).includes(`'${candidate}'`));
          return label ?? null;
        }
        return null;
      }
      current = ts.isPropertyAccessExpression(current.expression) ? current.expression.expression : undefined;
    }
    return null;
  };

  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node)
      && ts.isPropertyAccessExpression(node.expression)
      && node.expression.name.text === 'click'
      && menuLabelOf(node.expression.expression) !== null
    ) {
      found.push(node);
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(source, visit);
  return found;
};

/** Testpasswordet eller en egen `login`-definition i et spec – begge er kopier af det delte grundlag. */
const findLocalLoginDuplication = (source: ts.SourceFile): readonly ts.Node[] => {
  const found: ts.Node[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isStringLiteral(node) && node.text === TEST_PASSWORD) found.push(node);
    if (
      ts.isVariableDeclaration(node)
      && ts.isIdentifier(node.name)
      && node.name.text === 'login'
      && node.initializer !== undefined
    ) {
      found.push(node);
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(source, visit);
  return found;
};

/**
 * Forgrening på en motor, basisbanen ikke kører: `browserName !== 'webkit'`, `=== 'firefox'` osv.
 *
 * `chromium` er bevidst UDE af mængden: en test, der kun skal køre ét sted, springer sig selv over i
 * alt andet end Chromium og kører netop derfor rigtigt i basisbanen uden noget tag.
 */
const findNonBaselineEngineBranches = (source: ts.SourceFile): readonly ts.Node[] => {
  const found: ts.Node[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isBinaryExpression(node)) {
      const operands = [node.left, node.right];
      const mentionsBrowserName = operands.some((side) => ts.isIdentifier(side) && side.text === 'browserName');
      const engine = operands.find(
        (side): side is ts.StringLiteral =>
          ts.isStringLiteral(side) && NON_BASELINE_ENGINES.some((name) => name === side.text),
      );
      if (mentionsBrowserName && engine !== undefined) found.push(node);
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(source, visit);
  return found;
};

/** Bærer filen browserbane-taget? Læses som kode, så ordet i en kommentar ikke tæller. */
const declaresBrowserLane = (source: ts.SourceFile): boolean => {
  let declares = false;
  const visit = (node: ts.Node): void => {
    if (ts.isPropertyAssignment(node) && node.name.getText(source) === 'tag') {
      const value = node.initializer.getText(source);
      if (value.includes('BROWSER_LANE_TAG') || value.includes('@browsere')) declares = true;
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(source, visit);
  return declares;
};

describe('E2E-specs måler ikke transient tilstand gennem et kapløb', () => {
  it('hævder aldrig blinkklassen på den levende DOM', () => {
    const violations: Violation[] = [];
    for (const file of listSpecFiles()) {
      const source = parse(file);
      for (const node of findLiveBlinkClassAssertions(source)) {
        violations.push({
          file: path.basename(file),
          line: lineOf(source, node),
          detail: node.getText(source).slice(0, 100),
        });
      }
    }

    expect(
      violations,
      'Blinkmarkeringen varer 1,5 s. En toHaveClass-påstand på den levende DOM er et kapløb mod den '
      + 'timer – brug den nedskrevne observation fra startBlinkSampling/readBlinkObservation i stedet.\n'
      + violations.map((v) => `  ${v.file}:${v.line} – ${v.detail}`).join('\n'),
    ).toEqual([]);
  });

  it('bruger den delte felt-helper frem for et bart dobbeltklik', () => {
    const violations: Violation[] = [];
    for (const file of listSpecFiles()) {
      const source = parse(file);
      for (const node of findBareDoubleClickCalls(source)) {
        violations.push({
          file: path.basename(file),
          line: lineOf(source, node),
          detail: node.getText(source).slice(0, 100),
        });
      }
    }

    expect(
      violations,
      'Et bart dblclick() antager, at feltet er interaktivt, og at de to klik når inden for browserens '
      + `dobbeltklik-interval. Brug ${SHARED_HELPERS.join('/')} fra e2e/support/mineoTest.ts.\n`
      + violations.map((v) => `  ${v.file}:${v.line} – ${v.detail}`).join('\n'),
    ).toEqual([]);
  });

  it('navigerer i sidemenuen gennem openPage, ikke gennem et bart klik', () => {
    const violations: Violation[] = [];
    for (const file of listSpecFiles()) {
      const source = parse(file);
      for (const node of findUnsettledMenuNavigation(source)) {
        violations.push({
          file: path.basename(file),
          line: lineOf(source, node),
          detail: node.getText(source).slice(0, 100),
        });
      }
    }

    expect(
      violations,
      'Et klik på en menuknap skifter kun URL\'en; sidens chunk monteres bagefter, så den næste påstand '
      + 'kan måle den FORRIGE side. Brug openPage(page, \'<side>\') fra e2e/support/mineoTest.ts, som '
      + 'venter på destinationens egen sidetitel.\n'
      + violations.map((v) => `  ${v.file}:${v.line} – ${v.detail}`).join('\n'),
    ).toEqual([]);
  });

  it('henter login og testpassword fra det delte grundlag', () => {
    const violations: Violation[] = [];
    for (const file of listSpecFiles()) {
      const source = parse(file);
      for (const node of findLocalLoginDuplication(source)) {
        violations.push({
          file: path.basename(file),
          line: lineOf(source, node),
          detail: node.getText(source).slice(0, 60),
        });
      }
    }

    expect(
      violations,
      'Testpasswordet og login-rejsen hører ét sted til: TEST_PASSWORD og login i '
      + 'e2e/support/mineoTest.ts. En lokal kopi mister helperens ventepunkt for app-shellen.\n'
      + violations.map((v) => `  ${v.file}:${v.line} – ${v.detail}`).join('\n'),
    ).toEqual([]);
  });

  it('lader en motorafhængig test ligge i browserbanen', () => {
    const violations: Violation[] = [];
    for (const file of listSpecFiles()) {
      const source = parse(file);
      if (declaresBrowserLane(source)) continue;
      for (const node of findNonBaselineEngineBranches(source)) {
        violations.push({
          file: path.basename(file),
          line: lineOf(source, node),
          detail: node.getText(source).slice(0, 80),
        });
      }
    }

    expect(
      violations,
      'Testen forgrener på en motor, basisbanen ikke kører, men dens describe mangler BROWSER_LANE_TAG. '
      + 'Uden taget kører den kun i Chrome og springer sig selv over hver gang – grøn i optællingen, '
      + 'uden at hævde noget.\n'
      + violations.map((v) => `  ${v.file}:${v.line} – ${v.detail}`).join('\n'),
    ).toEqual([]);
  });

  /**
   * Selv-test (jf. guard-selvtest-princippet): et værn, der er grønt fordi det ikke måler noget, er
   * værdiløst. Her bevises hver detektor på en fixture, der INDEHOLDER overtrædelsen – at den ikke
   * udløses af de samme ord i en kommentar eller en streng – og at målet stadig FINDES.
   */
  describe('værnet kan faktisk fejle', () => {
    const fixture = (body: string): ts.SourceFile =>
      ts.createSourceFile('fixture.spec.ts', body, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

    it('fanger et ægte dblclick-kald', () => {
      const source = fixture('await input.dblclick();\nawait input.fill("x");');
      expect(findBareDoubleClickCalls(source)).toHaveLength(1);
    });

    it('fanger en ægte toHaveClass-påstand på blinkklassen', () => {
      const source = fixture('await expect(surface).toHaveClass(new RegExp(BLINK_CLASS));');
      expect(findLiveBlinkClassAssertions(source)).toHaveLength(1);
    });

    it('fanger et bart menuklik – også bag et led som .first()', () => {
      expect(findUnsettledMenuNavigation(fixture(
        "await page.getByRole('button', { name: 'Erstatningsopgørelse' }).click();",
      ))).toHaveLength(1);
      expect(findUnsettledMenuNavigation(fixture(
        "await page.getByRole('button', { name: 'Satser', exact: true }).first().click();",
      ))).toHaveLength(1);
    });

    it('skelner menuknappen fra en hvilken som helst anden knap', () => {
      expect(findUnsettledMenuNavigation(fixture(
        "await page.getByRole('button', { name: 'Gem' }).click();\n"
        + "await openPage(page, 'Satser');",
      ))).toHaveLength(0);
    });

    it('fanger en lokal kopi af testpasswordet og af login', () => {
      expect(findLocalLoginDuplication(fixture(
        "const TEST_PASSWORD = 'Mineo-Codex-Test-2026';\n"
        + 'const login = async (page) => { await page.goto("/"); };',
      ))).toHaveLength(2);
    });

    it('fanger en forgrening på en motor uden for basisbanen – men ikke på chromium', () => {
      expect(findNonBaselineEngineBranches(fixture(
        "test.skip(browserName !== 'webkit', 'kun WebKit');",
      ))).toHaveLength(1);
      expect(findNonBaselineEngineBranches(fixture(
        "test.skip(({ browserName }) => browserName !== 'chromium', 'kun én gang');",
      ))).toHaveLength(0);
    });

    it('læser bane-taget som kode, ikke som et ord i en kommentar', () => {
      expect(declaresBrowserLane(fixture(
        "test.describe('x', { tag: BROWSER_LANE_TAG }, () => {});",
      ))).toBe(true);
      expect(declaresBrowserLane(fixture(
        '// Filen kørte før med tag: BROWSER_LANE_TAG, men er nu utagget.\n'
        + "test.describe('x', () => {});",
      ))).toBe(false);
    });

    it('udløses IKKE af de samme ord i kommentarer og strenge', () => {
      const source = fixture(
        '// Tidligere brugte denne fil input.dblclick() og toHaveClass(BLINK_CLASS).\n'
        + 'const forklaring = "dblclick() og toHaveClass(BLINK_CLASS) er afløst af helperen";\n'
        + "// Og et bart page.getByRole('button', { name: 'Stamdata' }).click() er afløst af openPage.\n"
        + 'await setFieldValueAndSettle(input, "01-01-2026");',
      );
      expect(findBareDoubleClickCalls(source)).toHaveLength(0);
      expect(findLiveBlinkClassAssertions(source)).toHaveLength(0);
      expect(findUnsettledMenuNavigation(source)).toHaveLength(0);
    });

    it('måler et levende mål: der FINDES spec-filer at kontrollere', () => {
      // Grøn-af-tomhed-kontrollen: hvis mappen flyttes, skal værnet fejle frem for at bestå tavst.
      expect(listSpecFiles().length).toBeGreaterThan(10);
    });

    it('måler et levende mål: helperen bærer stadig etiketterne og passwordet', () => {
      // Uden dette ville en omdøbt eller slettet `openPage`/`TEST_PASSWORD` efterlade reglerne grønne
      // og uden noget at pege hen på.
      const helper = fs.readFileSync(path.join(E2E_DIR, 'support/mineoTest.ts'), 'utf8');
      expect(helper).toContain('export const openPage');
      expect(helper).toContain(`export const TEST_PASSWORD = '${TEST_PASSWORD}'`);
      for (const label of SIDE_MENU_LABELS) {
        expect(helper, `Sidemenu-etiketten «${label}» findes ikke længere i openPage's kort.`)
          .toContain(label);
      }
    });
  });
});
