/**
 * KOMMENTARER læst af TypeScripts AST – ikke af et linjefilter.
 *
 * Modulet findes, fordi et værn over kommentarprosa har præcis det modsatte behov af
 * `productionLanguageGuard`s linjescan: i testtræet er de forbudte ord LEGITIME som kode. To værn
 * bærer deres mønstre som regex-literaler, `deletionLedger` bærer slettede stinavne som data, og
 * fraværsreglerne bærer forbudte symbolnavne som allowlists. Et tekstfilter kan per konstruktion ikke
 * skelne den kode fra en kommentar, der omtaler et lukket arbejdsforløb – og et værn, der ikke kan
 * skelne, tvinger enten falske fund igennem eller får en filundtagelse, som gør det tavst netop dér,
 * hvor overtrædelserne kan gemme sig ([[project_structural_questions_need_ast]]).
 *
 * Scanneren læser derfor KUN kommentar-trivia. En streng, et identifier og et regex-literal er ikke
 * kommentarer og kan ikke udløse et fund, uanset hvad de indeholder.
 */
import ts from 'typescript';

export type SourceComment = Readonly<{
  /** Kommentarens tekst UDEN `//`, `/*` og de ledende `*` pr. linje. */
  text: string;
  /** 1-indekseret linje for kommentarens start, så et fund kan rapporteres som fil:linje. */
  line: number;
}>;

/**
 * Fjerner kommentar-syntaksen, så et mønster matcher prosaen frem for markørerne.
 *
 * Uden strippet ville en JSDoc-linjes ledende `*` indgå i teksten, og et mønster med `\b`-grænser
 * kunne opføre sig forskelligt afhængigt af, om forfatteren skrev `//` eller `/** *\/`.
 */
const stripCommentSyntax = (raw: string): string => raw
  .replace(/^\/\*\*?/, '')
  .replace(/\*\/$/, '')
  .replace(/^\/\//gm, '')
  .split(/\r?\n/)
  .map((line) => line.replace(/^\s*\*(?!\/)/, ''))
  .join('\n');

/**
 * Hver kommentar i filen, én post pr. sammenhængende kommentarblok.
 *
 * Kommentarer er TRIVIA og hænger på det efterfølgende (eller foregående) TOKEN – ikke på en node.
 * Derfor gås hvert token i træet igennem, og både dets leading og trailing trivia opsamles;
 * positionerne dedupliceres, fordi den samme kommentar kan være trailing for ét token og leading for
 * det næste. Filens allerførste kommentar hentes særskilt fra offset 0, og EOF-tokenet bærer en
 * afsluttende kommentar sidst i filen.
 *
 * **Ikke `ts.createScanner`.** En rå scanner ser ud til at virke på en kort fil, men taber i praksis
 * langt de fleste kommentarer i en rigtig kildefil (målt: 14 fundet mod AST-trivias 119 i samme fil),
 * fordi kommentarer konsumeres som trivia foran det næste token frem for at blive udstedt som egne
 * tokens. Et værn bygget på den vej ville være tavst grønt – netop den fejlklasse, kvalitetsværnene
 * findes for at udelukke ([[project_guard_selftest_principle]]).
 *
 * Trivia-vejen giver samtidig den ønskede sondring: et regex-literal, en streng og et identifier er
 * ikke trivia og kan aldrig rapporteres som kommentar.
 */
export const sourceComments = (content: string, fileName = 'file.ts'): readonly SourceComment[] => {
  const source = ts.createSourceFile(
    fileName, content, ts.ScriptTarget.Latest, /* setParentNodes */ true,
    fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );
  const seen = new Set<number>();
  const comments: SourceComment[] = [];

  const collect = (ranges: readonly ts.CommentRange[] | undefined): void => {
    for (const range of ranges ?? []) {
      if (seen.has(range.pos)) continue;
      seen.add(range.pos);
      comments.push({
        text: stripCommentSyntax(content.slice(range.pos, range.end)),
        line: source.getLineAndCharacterOfPosition(range.pos).line + 1,
      });
    }
  };

  const walk = (node: ts.Node): void => {
    const children = node.getChildren(source);
    if (children.length === 0) {
      collect(ts.getLeadingCommentRanges(content, node.getFullStart()));
      collect(ts.getTrailingCommentRanges(content, node.getEnd()));
      return;
    }
    for (const child of children) walk(child);
  };

  walk(source);
  // Filens allerførste kommentar har intet forudgående token, og en kommentar EFTER sidste statement
  // hænger på EOF-tokenet. Uden begge opsamlinger ville netop de to positioner være usynlige.
  collect(ts.getLeadingCommentRanges(content, 0));
  collect(ts.getLeadingCommentRanges(content, source.endOfFileToken.getFullStart()));

  return comments.sort((a, b) => a.line - b.line);
};
