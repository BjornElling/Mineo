import fs from 'node:fs';
import path from 'node:path';

import ts from 'typescript';

/**
 * Fraværsværn: Mineo genindlæser sig ALDRIG selv, når browseren gendanner dokumentet fra bfcache.
 *
 * **Invarianten.** En bfcache-gendannelse er ikke en ny session – brugeren vender tilbage til sit
 * eget, igangværende arbejde. Her lå tidligere en `pageshow`-lytter, der ubetinget kaldte
 * `location.reload()`. Den brød invarianten «en åben session skifter aldrig version»: den kunne skifte
 * build midt i en sag og kaste en åben editors draft væk uden om `CriticalActionCoordinator`. Se
 * beslutningsnoten i `src/App.tsx`.
 *
 * **Hvorfor et fraværsværn og ikke en E2E-test.** Påstanden blev før forsøgt bevist i browseren
 * (`e2e/pwa-service-worker.spec.ts`), men den test kunne ikke lade sig gøre: Chromium lægger ikke et
 * dokument i bfcache, mens DevTools-protokollen er tilsluttet – og den er tilsluttet i enhver
 * Playwright-kørsel. Testen sprang derfor sig selv over hver eneste gang og hævdede intet.
 *
 * Det, der faktisk er VORES, er ikke browserens beslutning om at bfcache, men om vi reagerer på
 * gendannelsen. Netop dét er en fraværspåstand om egen kode – og den kan hævdes hver gang.
 *
 * Værnet er en AST-kontrol, ikke en tekstsøgning: ordet `pageshow` står med vilje i beslutningsnoten i
 * `App.tsx` og i denne kommentar, og en regex kan ikke skelne den omtale fra en genindført lytter.
 */

const SRC_DIR = path.resolve(__dirname, '../..');
const APP_MODULE = path.join(SRC_DIR, 'App.tsx');

const listSourceFiles = (directory: string): readonly string[] =>
  fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return entry.name === '__tests__' ? [] : listSourceFiles(entryPath);
    }
    return entry.isFile() && /\.tsx?$/.test(entry.name) ? [entryPath] : [];
  });

const parse = (filePath: string): ts.SourceFile =>
  ts.createSourceFile(
    filePath,
    fs.readFileSync(filePath, 'utf8'),
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    ts.ScriptKind.TS,
  );

/** `addEventListener('pageshow', …)` som et FAKTISK kald – uanset hvad der lyttes på. */
export const findPageShowListeners = (source: ts.SourceFile): readonly ts.Node[] => {
  const found: ts.Node[] = [];
  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node)
      && ts.isPropertyAccessExpression(node.expression)
      && node.expression.name.text === 'addEventListener'
    ) {
      const [eventName] = node.arguments;
      if (eventName !== undefined && ts.isStringLiteral(eventName) && eventName.text === 'pageshow') {
        found.push(node);
      }
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(source, visit);
  return found;
};

describe('bfcache-gendannelse udløser ingen genindlæsning', () => {
  it('ingen produktionskode lytter på pageshow', () => {
    const violations = listSourceFiles(SRC_DIR).flatMap((file) => {
      const source = parse(file);
      return findPageShowListeners(source).map((node) => {
        const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
        return `${path.relative(SRC_DIR, file)}:${line}`;
      });
    });

    expect(
      violations,
      'En `pageshow`-lytter er genindført. En bfcache-gendannelse er ikke en ny session: reagerer vi '
      + 'på den, kan en åben sag skifte build og miste sin draft. Se beslutningsnoten i src/App.tsx.\n'
      + violations.map((entry) => `  ${entry}`).join('\n'),
    ).toEqual([]);
  });

  /**
   * Selv-test (jf. guard-selvtest-princippet): værnet skal bevise, at mønsteret FANGER, at målet
   * FINDES, og at det ikke udløses af den samme omtale i en kommentar.
   */
  describe('værnet kan faktisk fejle', () => {
    const fixture = (body: string): ts.SourceFile =>
      ts.createSourceFile('fixture.ts', body, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

    it('fanger en ægte pageshow-lytter', () => {
      expect(findPageShowListeners(fixture(
        "window.addEventListener('pageshow', (event) => { if (event.persisted) location.reload(); });",
      ))).toHaveLength(1);
    });

    it('udløses ikke af ordet i en kommentar eller en streng', () => {
      expect(findPageShowListeners(fixture(
        "// Her lå en addEventListener('pageshow', …), der kaldte location.reload().\n"
        + 'const note = "pageshow";',
      ))).toHaveLength(0);
    });

    it('måler et levende mål: beslutningsnoten står stadig i App.tsx', () => {
      // Grøn-af-tomhed-kontrollen. Forsvinder noten, er invarianten enten ophævet – og så skal dette
      // værn med – eller flyttet, og så peger fejlmeldingen forkert.
      expect(fs.readFileSync(APP_MODULE, 'utf8')).toContain('BEVIDST INGEN bfcache-genindlæsning');
    });

    it('måler et levende mål: der FINDES kildefiler at gennemsøge', () => {
      expect(listSourceFiles(SRC_DIR).length).toBeGreaterThan(100);
    });
  });
});
