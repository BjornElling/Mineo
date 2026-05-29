// Værn mod undo/redo-fokus-regression for sags-input-felter.
//
// Undo/redo gendanner en committed ændring og fokuserer det felt, ændringen hører til. Restore
// finder feltet i DOM via `data-mineo-undo-field-path`, som stammer fra feltets `name`-prop. Mangler
// `name`, kan restore ikke finde feltet, og fokus lander forkert (eller slet ikke). Det gælder TO
// klasser af felter, der begge committer til persisteret state:
//
//   1. Immediate-commit widgets (StyledToggleSwitch/StyledDropdown/StyledRadioButton): committer uden
//      forudgående fokus → kan slet ikke spores af focus-trackeren → name er eneste identitetskilde.
//   2. Blur-commit input-felter (StyledDateField/StyledAmountField/StyledTextField/StyledPercentField/
//      StyledYearField/StyledIntegerField/StyledWeekField/StyledFractionField): committer på blur efter
//      fokus er flyttet videre. focus-trackeren giver en focusToken-fallback, men den durable identitet
//      (invalid-draft-restore, navigation mellem sider, remounts) kræver et stabilt `name` lig feltets
//      fieldPath.
//
// Denne test scanner alle sags-input-sider og fejler hvis et sådant felt mangler `name`.
//
// Undtaget (deltager IKKE i undo/redo):
//   - Felter med `ref={loentrinFinder...}` (transient modal-state, ikke persisteret).
//   - Felter hvis `onCommit` kun skriver til lokal React-state (`setX(...)`) uden at kalde en
//     persist-vej (setValues/setFieldValue/update.../commitField/handle...Blur/handle...Commit).
//     Det dækker "komponér-og-indsæt"-hjælpere (fx sygedagpenge-indsæt på OffentligeYdelserTab).
//   - Disabled felter med `onCommit={undefined}` (committer aldrig → ingen undo-frame).
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const PAGES_DIR = join(process.cwd(), 'src', 'components', 'pages');

const IMMEDIATE_COMMIT_WIDGETS = ['StyledToggleSwitch', 'StyledDropdown', 'StyledRadioButton'] as const;
const BLUR_COMMIT_FIELDS = [
  'StyledDateField',
  'StyledAmountField',
  'StyledTextField',
  'StyledPercentField',
  'StyledYearField',
  'StyledIntegerField',
  'StyledWeekField',
  'StyledFractionField',
] as const;
const ALL_WIDGETS = [...IMMEDIATE_COMMIT_WIDGETS, ...BLUR_COMMIT_FIELDS] as const;

// Filer/mønstre der ikke er sags-input og derfor ikke deltager i undo/redo.
const EXCLUDED_FILE_PATTERNS = [/Debug/, /Indstillinger/, /Mineo\.tsx$/];
// Transiente widgets der ikke committer til persisteret state (lokal modal-state).
const TRANSIENT_REFS = [/ref=\{loentrinFinder/];
// Persist-veje: hvis onCommit-handleren refererer en af disse, committer feltet til undo-bærende state.
const PERSIST_PATHS =
  /\bsetValues\b|\bsetFieldValue\b|\bupdate[A-Z]\w*\(|\bcommitField\b|\bhandle\w*(Blur|Commit|Change)\b|\bsetFaelles\w*FieldValue\b/;
// Lokal React-state-setter (transient): onCommit der KUN kalder set...(...) og ingen persist-vej.
const LOCAL_STATE_SETTER = /\bset[A-Z]\w*\(/;

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

// Et felt deltager i undo/redo hvis det committer til persisteret state.
const isPersistedCommit = (tag: string): boolean => {
  // Disabled felt uden commit committer aldrig.
  if (/onCommit=\{undefined\}/.test(tag)) return false;
  // onCommit der refererer en persist-vej er undo-bærende.
  if (PERSIST_PATHS.test(tag)) return true;
  // onCommit der KUN kalder en lokal state-setter (og ingen persist-vej) er transient.
  if (LOCAL_STATE_SETTER.test(tag)) return false;
  // Konservativt: hvis vi ikke kan afgøre det, antag at feltet er persisteret (kræv name).
  return true;
};

describe('sags-input-felter bærer name for undo/redo-fokus', () => {
  const files = collectTsx(PAGES_DIR).filter((f) => !EXCLUDED_FILE_PATTERNS.some((p) => p.test(f)));

  const collectOffenders = (widgets: readonly string[], requirePersistedCommit: boolean): string[] => {
    const offenders: string[] = [];
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      for (const widget of widgets) {
        for (const tag of findOpeningTags(source, widget)) {
          if (TRANSIENT_REFS.some((p) => p.test(tag))) continue;
          if (/\bname=/.test(tag)) continue;
          if (requirePersistedCommit && !isPersistedCommit(tag)) continue;
          const rel = file.replace(process.cwd(), '').replace(/\\/g, '/');
          offenders.push(`${rel}: <${widget}> uden name-prop:\n  ${tag.replace(/\s+/g, ' ').slice(0, 120)}`);
        }
      }
    }
    return offenders;
  };

  it('alle immediate-commit widgets (toggle/dropdown/radio) i sags-sider har name', () => {
    const offenders = collectOffenders(IMMEDIATE_COMMIT_WIDGETS, false);
    expect(offenders, `Immediate-commit widgets uden name-prop (bryder undo/redo-fokus):\n${offenders.join('\n')}`).toEqual([]);
  });

  it('alle persisterede blur-commit input-felter i sags-sider har name', () => {
    const offenders = collectOffenders(BLUR_COMMIT_FIELDS, true);
    expect(offenders, `Blur-commit input-felter uden name-prop (bryder undo/redo-fokus):\n${offenders.join('\n')}`).toEqual([]);
  });

  it('dækker alle Styled-input-typer der kan committe til persisteret state', () => {
    // Vagt mod at en ny Styled-input-type tilføjes uden at blive omfattet af værnet.
    expect(ALL_WIDGETS.length).toBe(11);
  });
});
