// Samlet værn for FELT-IDENTITET på tværs af ALLE persisterende input-widgets (A2).
//
// Undo/redo og invalidDraft-recovery finder et felt igen i DOM via dets felt-identitet. Mangler den,
// lander fokus forkert efter en undo, eller en ugyldig draft kan ikke genfindes/ryddes. Identiteten
// bæres af disse attributter på det faktiske <input>:
//   - `name`                          (durable felt-id; kilde til undo-field-path-fallback)
//   - `data-mineo-undo-field-path`    (undo/redo-fokus-restore)
//   - `data-mineo-undo-focus-token`   (focus-token-fallback når name endnu ikke er kendt)
//   - `data-mineo-field-path`         (invalidDraft-recovery; KUN felter med en draft-tilstand)
//
// Tidligere var dette spredt: `immediateCommitWidgetUndoName` dækkede KUN formular-widgets i sags-sider,
// og INTET værn dækkede grid-tabellernes celle-inputs. Denne fil samler felt-identitets-værnet ét sted
// for alle tre familier — formular-blur-commit, formular-immediate-commit OG tabel-celler — så et nyt
// persisterende input ikke kan tilføjes uden at bære identitet.
//
// Beslægtet (men SEPARAT invariant, bevidst i egen fil): `fieldUnchangedGuardInvalidDraft.test.ts`
// håndhæver commit-/clear-SEMANTIKKEN omkring invalidDrafts — ikke at identiteten er til stede.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const PAGES_DIR = join(process.cwd(), 'src', 'components', 'pages');
const TABLE_INPUTS_DIR = join(process.cwd(), 'src', 'components', 'inputs', 'table');
const TABLE_INPUT_CORE = join(process.cwd(), 'src', 'hooks', 'tableInput', 'useTableInputCore.ts');

// ───────────────────────── Formular-familien (sags-sider) ─────────────────────────

const IMMEDIATE_COMMIT_WIDGETS = ['StyledToggleSwitch', 'StyledDropdown', 'StyledRadioButton', 'StyledCheckbox'] as const;
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
const ALL_FORM_WIDGETS = [...IMMEDIATE_COMMIT_WIDGETS, ...BLUR_COMMIT_FIELDS] as const;

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

describe('felt-identitet: formular-widgets i sags-sider bærer name', () => {
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

  it('alle immediate-commit widgets (toggle/dropdown/radio/checkbox) i sags-sider har name', () => {
    const offenders = collectOffenders(IMMEDIATE_COMMIT_WIDGETS, false);
    expect(offenders, `Immediate-commit widgets uden name-prop (bryder undo/redo-fokus):\n${offenders.join('\n')}`).toEqual([]);
  });

  it('alle persisterede blur-commit input-felter i sags-sider har name', () => {
    const offenders = collectOffenders(BLUR_COMMIT_FIELDS, true);
    expect(offenders, `Blur-commit input-felter uden name-prop (bryder undo/redo-fokus):\n${offenders.join('\n')}`).toEqual([]);
  });

  it('dækker alle Styled-input-typer der kan committe til persisteret state', () => {
    // Vagt mod at en ny Styled-input-type tilføjes uden at blive omfattet af værnet.
    expect(ALL_FORM_WIDGETS.length).toBe(12);
  });
});

// ───────────────────────── Tabel-familien (grid-celler) ─────────────────────────

type TableWidget = Readonly<{ name: string; file: string; source: string }>;

const tableWidgets: TableWidget[] = readdirSync(TABLE_INPUTS_DIR)
  .filter((entry) => entry.startsWith('Table') && entry.endsWith('.tsx'))
  .map((entry) => {
    const file = join(TABLE_INPUTS_DIR, entry);
    return { name: entry.replace(/\.tsx$/, ''), file, source: readFileSync(file, 'utf8') };
  });

// En tabel-celle med en draft-tilstand (blur/onPersist-commit) bygger på useTableInputCore og kan have
// en ikke-committbar draft → skal også bære `data-mineo-field-path` (invalidDraft-recovery).
// En immediate-commit tabel-widget (TableDropdown) har ingen draft-tilstand.
const isDraftCell = (w: TableWidget): boolean => w.source.includes('useTableInputCore');

describe('felt-identitet: tabel-celle-inputs videregiver identitet', () => {
  it('finder faktisk tabel-widgets (ikke vacuous)', () => {
    expect(tableWidgets.length).toBeGreaterThanOrEqual(7);
    // Mindst én draft-celle og mindst én immediate-commit (dropdown) — begge klasser dækkes.
    expect(tableWidgets.some(isDraftCell)).toBe(true);
    expect(tableWidgets.some((w) => !isDraftCell(w))).toBe(true);
  });

  it.each(tableWidgets.map((w) => [w.name, w] as const))(
    '%s bærer name + undo-field-path + undo-focus-token',
    (_name, w) => {
      // Fælles undo/redo-identitet for ALLE persisterende tabel-celler.
      expect(w.source, `${w.name}: mangler name-binding`).toMatch(/\bname[:=]/);
      expect(w.source, `${w.name}: mangler data-mineo-undo-field-path`).toContain('data-mineo-undo-field-path');
      expect(w.source, `${w.name}: mangler data-mineo-undo-focus-token`).toContain('data-mineo-undo-focus-token');
    }
  );

  it.each(tableWidgets.filter(isDraftCell).map((w) => [w.name, w] as const))(
    '%s (draft-celle) videregiver identitet fra useTableInputCore og bærer data-mineo-field-path',
    (_name, w) => {
      // Draft-celler skal kunne genfinde en ikke-committbar draft via invalidDraft-kanalen.
      expect(w.source, `${w.name}: mangler data-mineo-field-path`).toContain('data-mineo-field-path');
      // Ét sandt sted for identiteten: den kommer fra core, ikke lokalt udledte strenge.
      expect(w.source, `${w.name}: name kommer ikke fra core.htmlInputName`).toContain('core.htmlInputName');
      expect(w.source, `${w.name}: undo-field-path kommer ikke fra core.gridCellKey`).toContain('core.gridCellKey');
      expect(w.source, `${w.name}: field-path kommer ikke fra core.invalidDraftFieldPath`).toContain(
        'core.invalidDraftFieldPath'
      );
      expect(w.source, `${w.name}: undo-focus-token kommer ikke fra core.undoFocusToken`).toContain('core.undoFocusToken');
    }
  );

  it('useTableInputCore er den ene kilde til tabel-celle-identitet', () => {
    const core = readFileSync(TABLE_INPUT_CORE, 'utf8');
    for (const token of ['htmlInputName', 'gridCellKey', 'invalidDraftFieldPath', 'undoFocusToken']) {
      expect(core, `useTableInputCore eksponerer ikke ${token}`).toContain(token);
    }
  });

  it('selv-test: scanneren fanger en draft-celle uden data-mineo-field-path', () => {
    const violating = "inputProps={{ name: core.htmlInputName, 'data-mineo-undo-field-path': core.gridCellKey }}";
    expect(violating).not.toContain('data-mineo-field-path');
    const compliant = `${violating} /* + */ 'data-mineo-field-path': core.invalidDraftFieldPath`;
    expect(compliant).toContain('data-mineo-field-path');
  });
});
