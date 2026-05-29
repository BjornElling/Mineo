// Værn mod undo/redo-fokus-regression for immediate-commit widgets.
//
// StyledToggleSwitch / StyledDropdown / StyledRadioButton committer øjeblikkeligt (ikke på blur),
// så de KAN ikke spores via focus-trackeren. For at undo/redo kan finde og fokusere dem efter
// restore, SKAL de bære en `name`-prop (→ `data-mineo-undo-field-path`). Mangler den, lander
// undo-fokus på det forrige felt (den oprindelige fejl B).
//
// Denne test scanner alle sags-input-sider og fejler hvis en sådan widget mangler `name`.
// Undtaget: loentrin-finder-widgets (transient modal-state, ikke persisteret) og readonly-brug.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const PAGES_DIR = join(process.cwd(), 'src', 'components', 'pages');
const WIDGETS = ['StyledToggleSwitch', 'StyledDropdown', 'StyledRadioButton'] as const;

// Filer/mønstre der ikke er sags-input og derfor ikke deltager i undo/redo.
const EXCLUDED_FILE_PATTERNS = [/Debug/, /Indstillinger/, /Mineo\.tsx$/];
// Transiente widgets der ikke committer til persisteret state (lokal modal-state).
const TRANSIENT_REFS = [/ref=\{loentrinFinder/];

const collectTsx = (dir: string): string[] => {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...collectTsx(full));
    } else if (entry.endsWith('.tsx')) {
      out.push(full);
    }
  }
  return out;
};

// Find hvert <Widget ...> åbningstag (op til første '>' der ikke er inde i et udtryk).
const findOpeningTags = (source: string, widget: string): string[] => {
  const tags: string[] = [];
  // Kræv at widget-navnet efterfølges af whitespace eller '>' — så <StyledDropdown.Divider /> ikke matcher.
  const re = new RegExp(`<${widget}(?=[\\s>])`, 'g');
  let match: RegExpExecArray | null;
  while ((match = re.exec(source)) !== null) {
    // Læs frem til balanceret slut på åbningstagget.
    let depth = 0;
    let i = match.index;
    for (; i < source.length; i += 1) {
      const ch = source[i];
      if (ch === '{') depth += 1;
      else if (ch === '}') depth -= 1;
      else if (ch === '>' && depth === 0) break;
    }
    tags.push(source.slice(match.index, i + 1));
  }
  return tags;
};

describe('immediate-commit widgets bærer name for undo/redo-fokus', () => {
  const files = collectTsx(PAGES_DIR).filter(
    (f) => !EXCLUDED_FILE_PATTERNS.some((p) => p.test(f))
  );

  it('alle StyledToggleSwitch/StyledDropdown/StyledRadioButton i sags-sider har name', () => {
    const offenders: string[] = [];

    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      for (const widget of WIDGETS) {
        for (const tag of findOpeningTags(source, widget)) {
          if (TRANSIENT_REFS.some((p) => p.test(tag))) continue;
          if (/\bname=/.test(tag)) continue;
          const rel = file.replace(process.cwd(), '').replace(/\\/g, '/');
          offenders.push(`${rel}: <${widget}> uden name-prop:\n  ${tag.replace(/\s+/g, ' ').slice(0, 120)}`);
        }
      }
    }

    expect(offenders, `Immediate-commit widgets uden name-prop (bryder undo/redo-fokus):\n${offenders.join('\n')}`).toEqual([]);
  });
});
