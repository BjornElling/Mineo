import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { collectSourceFiles, toRepoRelativePath } from '../testUtils';

/**
 * Kanonisk kilde-graf for de AST-baserede arkitekturregler.
 *
 * Motivet (greenfield #48): de gamle quality-guards genopfandt hver især en
 * directory-walk + `fs.readFileSync` + regex/substring-scan. Denne modul ejer ÉN
 * cache af alle produktions-kildefiler under `src/` — læst og parset til AST præcis
 * én gang pr. testkørsel — som alle regler forbruger. AST'en gør grænserne
 * strukturelle i stedet for tekstuelle (fanger aliasing, destrukturering,
 * bracket-notation som substring-scanninger dokumenterede at de missede).
 */

export type SourceEntry = Readonly<{
  /** Absolut sti på disk. */
  absolutePath: string;
  /** Repo-relativ sti med `/`-separatorer (stabil på tværs af OS). */
  relativePath: string;
  /** Filens rå indhold (UTF-8). Bevaret så tekst-form-regler kan genbruge cachen. */
  text: string;
  /** Lazily parset AST; genbruges på tværs af regler via memoisering. */
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
    return { absolutePath, relativePath, text, ast: parse(relativePath, text) };
  });

  cache = entries;
  return entries;
};

/** Bygger en syntetisk `SourceEntry` fra en kildestreng — bruges af regel-selvtests. */
export const makeSyntheticEntry = (relativePath: string, text: string): SourceEntry => ({
  absolutePath: path.resolve(process.cwd(), relativePath),
  relativePath,
  text,
  ast: parse(relativePath, text),
});

/** Kun til test: nulstil modul-cachen (så en test kan tvinge genindlæsning). */
export const resetSourceGraphCache = (): void => {
  cache = null;
};
