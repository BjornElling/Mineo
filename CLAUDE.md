# CLAUDE.md

Alle udviklingsregler, roller, mandat og constraints for Mineo er samlet i [AGENTS.md](AGENTS.md). Læs den fil — den er den autoritative kilde.

## Commit-besked: undgå det gentagne `@`-præfiks

Flerlinjede commit-beskeder må ALDRIG sendes med `git commit -m @'...'@` i **Bash-værktøjet**:
`@'...'@` er PowerShell-here-string-syntaks, ikke en bash-heredoc — i bash bliver `@`'erne
literal og lander i beskeden, så subject-linjen starter med et bart `@`.

- **Bash-værktøjet:** brug ægte heredoc: `git commit -F - <<'EOF'` … `EOF` (uindrykket i kolonne 0).
- **PowerShell-værktøjet:** her ER `@'` … `'@` en gyldig here-string — brug den der.
- Efter commit: verificér med `git log -1 --format='%s'`; amend hvis subject starter med `@` eller `#`.

Subject-linjen skal stå alene som én beskrivende dansk linje (aldrig et bart scope/præfiks).
