import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { collectSourceFiles, toRepoRelativePath } from '../testUtils';

/**
 * Kanonisk kilde-graf for arkitektur- og tekstværn.
 *
 * Motivet (greenfield #48): de gamle quality-guards genopfandt hver især en
 * directory-walk + `fs.readFileSync` + regex/substring-scan. Denne modul ejer ÉN
 * cache af alle produktions-kildefiler under `src/` – læst præcis én gang og AST-parset
 * højst én gang pr. fil ved første strukturelle adgang – som både AST-regler og de få bevidst
 * tekstbaserede kontraktværn forbruger. AST'en gør grænserne strukturelle
 * (fanger aliasing, destrukturering og bracket-notation), mens `text` bevarer
 * den præcise kildeform til regler hvor selve tekstformen er kontrakten.
 */

export type SourceEntry = Readonly<{
  /** Absolut sti på disk. */
  absolutePath: string;
  /** Repo-relativ sti med `/`-separatorer (stabil på tværs af OS). */
  relativePath: string;
  /** Filens rå indhold (UTF-8). Bevaret så tekst-form-regler kan genbruge cachen. */
  text: string;
  /** Lazy, cachet AST; tekstværn udløser ikke parsing af hele kildegrafen. */
  ast: ts.SourceFile;
}>;

const SRC_ROOT = path.resolve(process.cwd(), 'src');

let cache: readonly SourceEntry[] | null = null;

const parse = (relativePath: string, text: string): ts.SourceFile =>
  ts.createSourceFile(
    relativePath,
    text,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    relativePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );

const createSourceEntry = (
  absolutePath: string,
  relativePath: string,
  text: string
): SourceEntry => {
  let cachedAst: ts.SourceFile | undefined;
  return {
    absolutePath,
    relativePath,
    text,
    get ast() {
      cachedAst ??= parse(relativePath, text);
      return cachedAst;
    },
  };
};

/**
 * Alle produktions-kildefiler under `src/` (ekskl. `__tests__`/`test`), læst og
 * parset én gang og cachet på modulniveau. Regler filtrerer selv på `relativePath`
 * for at afgrænse deres scope.
 */
export const getSourceGraph = (): readonly SourceEntry[] => {
  if (cache) return cache;

  const entries = collectSourceFiles(SRC_ROOT).map((absolutePath): SourceEntry => {
    const relativePath = toRepoRelativePath(absolutePath);
    const text = fs.readFileSync(absolutePath, 'utf8');
    return createSourceEntry(absolutePath, relativePath, text);
  });

  cache = entries;
  return entries;
};

/** Bygger en syntetisk `SourceEntry` fra en kildestreng – bruges af regel-selvtests. */
export const makeSyntheticEntry = (relativePath: string, text: string): SourceEntry =>
  createSourceEntry(path.resolve(process.cwd(), relativePath), relativePath, text);

/** Kun til test: nulstil modul-cachen (så en test kan tvinge genindlæsning). */
export const resetSourceGraphCache = (): void => {
  cache = null;
};
