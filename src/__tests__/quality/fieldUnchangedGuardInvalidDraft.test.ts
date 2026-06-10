// Værn mod regression af "clear/edit af ugyldigt felt strander invalidDrafts".
//
// De bundne Styled*-felter har en blur-commit-kortslutning `const unchanged = draft === format(value)`,
// der springer commit'et over når draften matcher den committede værdi. Hvis den IKKE også kræver
// `committedInvalidDraft === undefined`, vil en clear (eller edit til en værdi der matcher committed)
// af et felt med en ikke-committbar rå draft springe commit'et over → invalidDrafts-entryet ryddes
// aldrig → feltet re-syncer til den gamle ugyldige værdi, og Gem forbliver blokeret.
//
// Denne guard scanner dynamisk alle bundne felt-komponenter (dem der bruger invalidDraft-kanalen) og
// fejler hvis en `const unchanged =`-kortslutning mangler `committedInvalidDraft`. En selv-test beviser
// at scanneren faktisk fanger en overtrædelse (vacuous-pass-værn).
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const INPUTS_DIR = join(process.cwd(), 'src', 'components', 'inputs');

/** Find alle `const unchanged = …;`-statements i en kilde (multi-line understøttet). */
const extractUnchangedStatements = (source: string): string[] => {
  const statements: string[] = [];
  const marker = 'const unchanged =';
  let from = 0;
  for (;;) {
    const start = source.indexOf(marker, from);
    if (start === -1) break;
    const end = source.indexOf(';', start);
    statements.push(source.slice(start, end === -1 ? source.length : end + 1));
    from = end === -1 ? source.length : end + 1;
  }
  return statements;
};

const boundFieldFiles = readdirSync(INPUTS_DIR)
  .filter((entry) => entry.endsWith('.tsx'))
  .map((entry) => join(INPUTS_DIR, entry))
  .filter((file) => {
    const src = readFileSync(file, 'utf8');
    return src.includes('useFieldInvalidDraftChannel') && src.includes('const unchanged =');
  });

describe('felt-blur "unchanged"-guard inkluderer committedInvalidDraft', () => {
  it('scanner faktisk et meningsfuldt antal bundne felt-komponenter (ikke vacuous)', () => {
    // Per 2026-06: 8 komponenter (Amount/Date/Fraction/Integer/Percent/Text/Week/Year). Hvis globben
    // pludselig finder langt færre, er scanneren brudt og guarden ville passere tomt.
    expect(boundFieldFiles.length).toBeGreaterThanOrEqual(8);
  });

  it.each(boundFieldFiles.map((f) => [f.split(/[\\/]/).pop()!, f] as const))(
    '%s: hver "unchanged"-kortslutning kræver committedInvalidDraft === undefined',
    (_name, file) => {
      const statements = extractUnchangedStatements(readFileSync(file, 'utf8'));
      expect(statements.length).toBeGreaterThan(0);
      for (const statement of statements) {
        expect(statement).toContain('committedInvalidDraft');
      }
    }
  );

  it('selv-test: scanneren fanger en kortslutning der mangler committedInvalidDraft', () => {
    const violating = `
      onBlur={(e) => {
        onBlurBase(e);
        const unchanged = draft === formatX(value);
        if (!unchanged) commit();
      }}
    `;
    const statements = extractUnchangedStatements(violating);
    expect(statements).toHaveLength(1);
    expect(statements[0]).not.toContain('committedInvalidDraft');

    const compliant = 'const unchanged = draft === formatX(value) && committedInvalidDraft === undefined;';
    expect(extractUnchangedStatements(compliant)[0]).toContain('committedInvalidDraft');
  });
});

/**
 * Find alle immediate-commit Delete/Backspace-clear-blokke (editor lukket) og returnér hver bloks tekst
 * fra Backspace/Delete-checket til det afsluttende `return;`. Disse blokke committer feltet straks ved
 * Delete og SKAL også rydde et evt. invalidDrafts-entry (de omgår useDraftField-commit-wrapperen).
 */
const extractImmediateDeleteBlocks = (source: string): string[] => {
  const blocks: string[] = [];
  const marker = "e.key === 'Backspace' || e.key === 'Delete'";
  let from = 0;
  for (;;) {
    const start = source.indexOf(marker, from);
    if (start === -1) break;
    const end = source.indexOf('return;', start);
    const block = source.slice(start, end === -1 ? source.length : end + 'return;'.length);
    blocks.push(block);
    from = end === -1 ? source.length : end + 'return;'.length;
  }
  return blocks;
};

describe('immediate-Delete-clear rydder invalidDrafts', () => {
  it('scanner faktisk immediate-Delete-blokke (ikke vacuous)', () => {
    const total = boundFieldFiles.reduce((n, f) => n + extractImmediateDeleteBlocks(readFileSync(f, 'utf8')).length, 0);
    // Per 2026-06: hvert af de 8 felter har mindst én immediate-Delete-blok (Text har to).
    expect(total).toBeGreaterThanOrEqual(8);
  });

  it.each(boundFieldFiles.map((f) => [f.split(/[\\/]/).pop()!, f] as const))(
    '%s: hver immediate-Delete-blok rydder invalidDrafts (clearInvalidDraft)',
    (_name, file) => {
      const blocks = extractImmediateDeleteBlocks(readFileSync(file, 'utf8'));
      expect(blocks.length).toBeGreaterThan(0);
      for (const block of blocks) {
        // En immediate-commit-clear-blok kendes på at den committer (onCommit) og tømmer draften (setDraft).
        const isCommitClear = block.includes('onCommit') && /setDraft(Base)?\(''\)/.test(block);
        if (!isCommitClear) continue;
        expect(block).toContain('clearInvalidDraft');
      }
    }
  );

  it('selv-test: scanneren fanger en immediate-Delete-blok uden clearInvalidDraft', () => {
    const violating = `
      if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        const result = parseX('', { mode: 'commit' });
        if (result.ok) { onCommit?.(createCommitEvent(result.value)); }
        setDraft('');
        return;
      }
    `;
    const [block] = extractImmediateDeleteBlocks(violating);
    expect(block).toBeDefined();
    expect(block.includes('onCommit') && /setDraft(Base)?\(''\)/.test(block)).toBe(true);
    expect(block).not.toContain('clearInvalidDraft');
  });
});
