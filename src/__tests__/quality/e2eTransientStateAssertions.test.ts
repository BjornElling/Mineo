import fs from 'node:fs';
import path from 'node:path';

import ts from 'typescript';

/**
 * Værn mod to måleartefakter i E2E-suiten.
 *
 * Begge er tests, der måler noget ANDET end det, de påstår at måle — og som derfor er grønne på en
 * hurtig maskine og røde på en langsom, uden at produktet ændrer sig:
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
 * Værnet er en AST-kontrol, ikke en regex: det skal kunne skelne kode fra kommentar (begge mønstre
 * OMTALES netop i kommentarerne ovenfor og i specs' egne forklaringer), hvilket en tekstsøgning ikke kan.
 */

const E2E_DIR = path.resolve(__dirname, '../../../e2e');
const BLINK_CLASS = 'mineo-field-attention-blink';

/** Den delte helper, der har afløst det bare dobbeltklik. */
const SHARED_HELPERS = ['setFieldValue', 'setFieldValueAndSettle'] as const;

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

/** `x.dblclick()` som et FAKTISK kald — ikke ordet «dblclick» i en kommentar eller en streng. */
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
 * `expect(...).toHaveClass(...)` hvor argumentet nævner blinkklassen — altså en påstand, der venter på
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
      + 'timer — brug den nedskrevne observation fra startBlinkSampling/readBlinkObservation i stedet.\n'
      + violations.map((v) => `  ${v.file}:${v.line} — ${v.detail}`).join('\n'),
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
      + violations.map((v) => `  ${v.file}:${v.line} — ${v.detail}`).join('\n'),
    ).toEqual([]);
  });

  /**
   * Selv-test (jf. guard-selvtest-princippet): et værn, der er grønt fordi det ikke måler noget, er
   * værdiløst. Her bevises begge detektorer på en fixture, der INDEHOLDER overtrædelserne — og at de
   * ikke udløses af de samme ord i en kommentar eller en streng.
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

    it('udløses IKKE af de samme ord i kommentarer og strenge', () => {
      const source = fixture(
        '// Tidligere brugte denne fil input.dblclick() og toHaveClass(BLINK_CLASS).\n'
        + 'const forklaring = "dblclick() og toHaveClass(BLINK_CLASS) er afløst af helperen";\n'
        + 'await setFieldValueAndSettle(input, "01-01-2026");',
      );
      expect(findBareDoubleClickCalls(source)).toHaveLength(0);
      expect(findLiveBlinkClassAssertions(source)).toHaveLength(0);
    });

    it('måler et levende mål: der FINDES spec-filer at kontrollere', () => {
      // Grøn-af-tomhed-kontrollen: hvis mappen flyttes, skal værnet fejle frem for at bestå tavst.
      expect(listSpecFiles().length).toBeGreaterThan(10);
    });
  });
});
