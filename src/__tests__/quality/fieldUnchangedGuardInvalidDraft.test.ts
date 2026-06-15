// Værn mod regression af "clear/edit af ugyldigt felt strander invalidDrafts".
//
// De bundne Styled*-felter committer på blur, men kortslutter commit'et når draften matcher den
// committede værdi (`unchanged`). Hvis den kortslutning IKKE også kræver `committedInvalidDraft === undefined`,
// vil en clear (eller edit til en værdi der matcher committed) af et felt med en ikke-committbar rå draft
// springe commit'et over → invalidDrafts-entryet ryddes aldrig → feltet re-syncer til den gamle ugyldige
// værdi, og Gem forbliver blokeret. Tilsvarende SKAL den øjeblikkelige Backspace/Delete-clear-sti rydde
// invalidDrafts, da den omgår den normale commit-wrapper.
//
// Siden 2026-06 ejes denne commit-/clear-lim af den delte `useStyledFieldAdapter`-hook for de syv
// numeriske blur-commit-felter (Amount/Date/Integer/Percent/Fraction/Week/Year). `StyledTextField`
// (fri tekst + textarea) ejer fortsat sin egen lim. Denne guard scanner derfor BÅDE hook'en og de
// bespoke felt-filer, kræver at de migrerede felter faktisk delegerer til hook'en, og har selv-tests
// der beviser at scanneren fanger en overtrædelse (vacuous-pass-værn).
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const INPUTS_DIR = join(process.cwd(), 'src', 'components', 'inputs');
const ADAPTER_HOOK = join(process.cwd(), 'src', 'hooks', 'useStyledFieldAdapter.ts');

/** Felter der delegerer commit-/clear-limen til den delte hook (må ikke have egen divergerende blur-sti). */
const HOOK_DELEGATING_FIELDS = [
  'StyledAmountField',
  'StyledDateField',
  'StyledIntegerField',
  'StyledPercentField',
  'StyledFractionField',
  'StyledWeekField',
  'StyledYearField',
] as const;

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

/**
 * Find alle immediate-commit Delete/Backspace-clear-blokke (editor lukket) og returnér hver bloks tekst
 * fra Backspace/Delete-checket til det afsluttende `return;`. Disse blokke committer feltet straks ved
 * Delete og SKAL også rydde et evt. invalidDrafts-entry (de omgår den normale commit-wrapper).
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

/** En immediate-commit-clear-blok kendes på at den committer og tømmer draften. */
const isCommitClearBlock = (block: string): boolean =>
  (block.includes('onCommit') || block.includes('commitValue')) && /setDraft(Base)?\(''\)/.test(block);

// Bespoke felt-filer der fortsat ejer deres egen commit-/clear-lim (i praksis StyledTextField).
const bespokeFieldFiles = readdirSync(INPUTS_DIR)
  .filter((entry) => entry.endsWith('.tsx'))
  .map((entry) => join(INPUTS_DIR, entry))
  .filter((file) => {
    const src = readFileSync(file, 'utf8');
    return src.includes('useFieldInvalidDraftChannel') && src.includes('const unchanged =');
  });

// Alle kilder der ejer en blur-commit-/immediate-clear-sti: den delte hook + de bespoke felter.
const commitOwningSources = [ADAPTER_HOOK, ...bespokeFieldFiles];

describe('blur-commit kortslutning inkluderer committedInvalidDraft', () => {
  it('den delte hooks default-commit-betingelse refererer committedInvalidDraft', () => {
    const src = readFileSync(ADAPTER_HOOK, 'utf8');
    const marker = 'const defaultShouldCommit =';
    const start = src.indexOf(marker);
    expect(start).toBeGreaterThanOrEqual(0);
    const statement = src.slice(start, src.indexOf(';', start) + 1);
    expect(statement).toContain('committedInvalidDraft');
  });

  it('scanner faktisk mindst ét bespoke felt (StyledTextField) — ikke vacuous', () => {
    expect(bespokeFieldFiles.length).toBeGreaterThanOrEqual(1);
  });

  it.each(bespokeFieldFiles.map((f) => [f.split(/[\\/]/).pop()!, f] as const))(
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

describe('migrerede felter delegerer commit-limen til useStyledFieldAdapter', () => {
  it.each(HOOK_DELEGATING_FIELDS)('%s bruger useStyledFieldAdapter og har ingen egen blur-sti', (name) => {
    const src = readFileSync(join(INPUTS_DIR, `${name}.tsx`), 'utf8');
    expect(src).toContain('useStyledFieldAdapter');
    // Må ikke genindføre en lokal commit-/clear-lim, der kunne divergere fra hook'en.
    expect(src).not.toContain('useFieldInvalidDraftChannel');
    expect(src).not.toContain("e.key === 'Backspace' || e.key === 'Delete'");
  });
});

describe('immediate-Delete-clear rydder invalidDrafts', () => {
  it('scanner faktisk immediate-Delete-blokke (ikke vacuous)', () => {
    const total = commitOwningSources.reduce((n, f) => n + extractImmediateDeleteBlocks(readFileSync(f, 'utf8')).length, 0);
    // Hook'en har én delt immediate-Delete-blok; StyledTextField har to (input + textarea).
    expect(total).toBeGreaterThanOrEqual(3);
  });

  it.each(commitOwningSources.map((f) => [f.split(/[\\/]/).pop()!, f] as const))(
    '%s: hver immediate-Delete-commit-blok rydder invalidDrafts (clearInvalidDraft)',
    (_name, file) => {
      const blocks = extractImmediateDeleteBlocks(readFileSync(file, 'utf8'));
      expect(blocks.length).toBeGreaterThan(0);
      for (const block of blocks) {
        if (!isCommitClearBlock(block)) continue;
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
    expect(isCommitClearBlock(block)).toBe(true);
    expect(block).not.toContain('clearInvalidDraft');
  });
});
