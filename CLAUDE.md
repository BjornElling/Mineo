# CLAUDE.md

Alle udviklingsregler, roller, mandat og constraints for Mineo er samlet i [AGENTS.md](AGENTS.md). Læs den fil — den er den autoritative kilde.

## Kommunikationsstil (skærpelse af AGENTS.md §Kommunikation)

AGENTS.md siger allerede "Hold kommunikation på et absolut minimum". Denne skærpelse står her, fordi jeg
**ikke har fulgt den** — påtalt af brugeren 2026-07-29 med ordene "det er kun dig, der er problemet".

- **Kortfattet, klar, præcis.** Ingen løbende overvejelser, ingen tankestrøm, ingen narration af hvad jeg er
  ved at gøre eller hvorfor. Ingen genfortælling af det, et værktøjskald lige viste.
- **Lejlighedsvise livstegn under langt arbejde** — én kort linje, så brugeren ved, at jeg ikke er gået i stå.
  Et minimum. Ikke en statusrapport pr. delopgave.
- **Udførligt er tilladt PRÆCIS to steder:** spørgsmål til brugeren, og den afsluttende status. Dem skal jeg
  til gengæld formulere grundigt og gennemarbejdet.
- Mellemliggende beslutninger, afvejninger og begrundelser hører i **koden, WI-filen eller reviewrapporten** —
  ikke i chatten. Jeg ejer alle proces- og kodebeslutninger, så de skal ikke forelægges undervejs.

Prøven før hver besked, der hverken er et spørgsmål eller en afsluttende status: *kan den skæres til én linje
— eller helt væk?* Så gør det. Sig hvad der ER gjort, ikke hvad jeg overvejer.

## Nedluknings-protokol ("luk ned")

Når brugeren skriver **"luk ned"** (typisk fordi statuslinjen har fyret en ntfy om at
5-timers-kvoten er ≥ 95 % opbrugt), betyder det: *afslut arbejdet forsvarligt nu, så intet går
tabt, og så næste session kan fortsætte uden at gætte.* Jeg kan ikke selv se kvoten — signalet
kommer altid udefra, fra brugeren. En anden ntfy melder når vinduet er nulstillet igen; genoptag
da arbejdet fra den status, overdragelsesnotatet og progress-memoryen efterlod.

Sådan gør jeg, i denne rækkefølge:

1. **Stop ved næste logiske stop-sted.** Ikke midt i en delvis refaktorering: gør den aktuelle,
   mindste sammenhængende ændring færdig (så filerne er syntaktisk hele og internt konsistente),
   og start ikke noget nyt. Er jeg allerede på et rent stop-sted, stopper jeg med det samme.
2. **Skriv et overdragelsesnotat** i `docs/overdragelse.md` med aktuel status: hvad er gjort, hvad
   mangler, hvilke filer er berørt, og hvad det næste konkrete skridt er. Skriv det så en session
   uden min nuværende kontekst kan tage over. Filen er midlertidig og slettes, når arbejdet er
   afsluttet.
3. **Opdatér progress-memoryen** `project_greenfield_draft_commit_progress.md` med hvor arbejdet
   står — samme detaljeringsniveau som de øvrige statuslinjer der.
4. **Rapportér til brugeren** hvad der er gemt, hvad der er ufærdigt, og om træet er rødt eller grønt.

Bevidst **uden for** protokollen:

- **Ingen gate- eller suite-kørsel.** Ved 95 % er der ikke budget til det, og en halv kørsel er
  værre end ingen. Er tilstanden usikker, skriv det i overdragelsesnotatet frem for at bruge kvoten på at måle den.
- **Ingen automatisk commit.** Commit kun hvis brugeren beder om det — nedlukningen skal ikke selv
  lægge en halvfærdig ændring i historikken. Dokumentationen fra trin 2–3 er det der sikrer arbejdet.

## Commit-besked: undgå det gentagne `@`-præfiks

Flerlinjede commit-beskeder må ALDRIG sendes med `git commit -m @'...'@` i **Bash-værktøjet**:
`@'...'@` er PowerShell-here-string-syntaks, ikke en bash-heredoc — i bash bliver `@`'erne
literal og lander i beskeden, så subject-linjen starter med et bart `@`.

- **Bash-værktøjet:** brug ægte heredoc: `git commit -F - <<'EOF'` … `EOF` (uindrykket i kolonne 0).
- **PowerShell-værktøjet:** her ER `@'` … `'@` en gyldig here-string — brug den der.
- Efter commit: verificér med `git log -1 --format='%s'`; amend hvis subject starter med `@` eller `#`.

Subject-linjen skal stå alene som én beskrivende dansk linje (aldrig et bart scope/præfiks).
