#!/usr/bin/env node
// Fundoversigten er reviewets autoritative register. Denne gate udleder optællingen af de faktiske tabelrækker
// og sammenholder de rapportbundne id'er med deres kilder, så en ny rapportpost ikke kan underoptælles lydløst.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (relativePath) => readFileSync(resolve(root, relativePath), 'utf8');
const overview = read('docs/review/draft-commit-review/fund-oversigt.md');

const rowPattern = /^\|\s*((?:R[0-8]|GM|UT|INC)-F\d{2})\s*\|(.+)$/gm;
const rows = [...overview.matchAll(rowPattern)].map((match) => {
  const cells = match[0].split('|').slice(1, -1).map((cell) => cell.trim());
  const statusCell = cells.find((cell) =>
    /^(?:\*\*)?(?:Rettet \d{4}-\d{2}-\d{2}|Afvist med evidens|Åben|Hypotese)(?:\*\*)?$/.test(cell)
  );
  if (statusCell === undefined) throw new Error(`${match[1]} har ukendt eller manglende status`);
  return { id: match[1], status: statusCell.replaceAll('**', '') };
});

const ids = rows.map((row) => row.id);
const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
if (duplicates.length > 0) throw new Error(`Dublerede fund-id'er: ${[...new Set(duplicates)].join(', ')}`);

const groups = new Map();
for (const id of ids) {
  const group = id.slice(0, id.indexOf('-F'));
  const number = Number(id.slice(id.indexOf('-F') + 2));
  const numbers = groups.get(group) ?? [];
  numbers.push(number);
  groups.set(group, numbers);
}
for (const [group, numbers] of groups) {
  numbers.sort((a, b) => a - b);
  for (let expected = 1; expected <= numbers.at(-1); expected += 1) {
    if (!numbers.includes(expected)) throw new Error(`${group}-registret har hul ved F${String(expected).padStart(2, '0')}`);
  }
}

const reportSources = [
  ...Array.from({ length: 9 }, (_, index) =>
    `docs/review/draft-commit-review/R${index}-${[
      'baseline-og-vaern',
      'kontrakter-og-sluttilstandssprog',
      'inputkerne-og-felteditor',
      'issues-og-gates',
      'persistence-session-eo-undo-redo',
      'domaeneprojektioner-og-beregningsflow',
      'dokumentoutput-og-generatorer',
      'pages-shell-porte-og-ui-struktur',
      'testkvalitet-vaern-og-acceptmatrix',
    ][index]}.md`
  ),
  'docs/review/draft-commit-review/grill-me-konvergensreview.md',
  'docs/review/draft-commit-brugertestfund.md',
];

for (const reportPath of reportSources) {
  const report = read(reportPath);
  const reportIds = [...report.matchAll(/^###\s+((?:R[0-8]|GM|UT)-F\d{2})\b/gm)].map((match) => match[1]);
  for (const reportId of reportIds) {
    if (!ids.includes(reportId)) throw new Error(`${reportPath} har ${reportId}, som mangler i fundoversigten`);
  }
  const expectedPrefix = reportPath.includes('brugertest')
    ? 'UT-'
    : reportPath.includes('grill-me')
      ? 'GM-'
      : reportPath.match(/\/(R[0-8])-/)?.[1] + '-';
  for (const registeredId of ids.filter((id) => id.startsWith(expectedPrefix))) {
    if (!reportIds.includes(registeredId)) {
      throw new Error(`Fundoversigten har ${registeredId}, som mangler i ${reportPath}`);
    }
  }
}

const category = (prefix) => rows.filter((row) => row.id.startsWith(prefix));
const summary = [
  ['R0–R8 (fasefund)', rows.filter((row) => /^R[0-8]-/.test(row.id))],
  ['GM (konvergensreview)', category('GM-')],
  ['UT (brugertest)', category('UT-')],
  ['INC (tilfældighedsfund)', category('INC-')],
  ['I alt', rows],
];

for (const [label, findings] of summary) {
  const corrected = findings.filter((finding) => finding.status.startsWith('Rettet')).length;
  const rejected = findings.filter((finding) => finding.status === 'Afvist med evidens').length;
  const open = findings.length - corrected - rejected;
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const summaryPattern = new RegExp(
    `^\\|\\s*(?:\\*\\*)?${escapedLabel}(?:\\*\\*)?\\s*\\|\\s*(?:\\*\\*)?${findings.length}(?:\\*\\*)?`
    + `\\s*\\|\\s*(?:\\*\\*)?${open}(?:\\*\\*)?\\s*\\|\\s*(?:\\*\\*)?${corrected}(?:\\*\\*)?`
    + `\\s*\\|\\s*(?:\\*\\*)?${rejected}(?:\\*\\*)?\\s*\\|$`,
    'm'
  );
  if (!summaryPattern.test(overview)) {
    throw new Error(
      `Statusrækken '${label}' matcher ikke registret: ${findings.length} fund, ${open} åbne, `
      + `${corrected} rettede, ${rejected} afviste`
    );
  }
}

process.stdout.write(`Fundregister OK: ${rows.length} unikke fund uden huller eller rapportdrift.\n`);

