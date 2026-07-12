import fs from 'node:fs';

// Commit-msg-hook: fanger den gentagne fejl hvor subject-linjen starter med et bart `@`
// (typisk fordi PowerShell-here-string-syntaks `-m @'...'@` blev brugt i Bash-værktøjet, hvor
// `@`'erne bliver literal og lækker ind i beskeden). Se CLAUDE.md → "Commit-besked".

const messagePath = process.argv[2];

if (!messagePath) {
  console.error('check:commit-msg: mangler sti til commit-besked-fil (kaldes normalt af Git commit-msg-hook).');
  process.exit(1);
}

const raw = fs.readFileSync(messagePath, 'utf8');

// Første ikke-tomme linje der ikke er en Git-kommentar (`#`-linjer strippes af Git).
const subject = raw
  .split(/\r?\n/)
  .map((line) => line.trim())
  .find((line) => line.length > 0 && !line.startsWith('#'));

if (!subject) {
  // Tom besked håndteres af Git selv; her blokerer vi ikke yderligere.
  process.exit(0);
}

if (subject.startsWith('@')) {
  console.error('Commit blokeret: subject-linjen starter med et bart `@`.');
  console.error(`  Subject: ${subject}`);
  console.error('');
  console.error('Årsag er typisk PowerShell-here-string-syntaks `git commit -m @\'...\'@` brugt i Bash-');
  console.error('værktøjet. Brug i stedet en ægte bash-heredoc:');
  console.error("    git commit -F - <<'EOF'");
  console.error('    <selvstændig beskrivende subject-linje>');
  console.error('    EOF');
  console.error('(Se CLAUDE.md → "Commit-besked: undgå det gentagne @-præfiks".)');
  process.exit(1);
}

process.exit(0);
