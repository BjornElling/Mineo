---
name: greenfield
description: Gennemfør et Mineo-greenfield-scope — Claude planlægger og beslutter, Codex sol reviewer uafhængigt.
argument-hint: "[scope eller arbejdsnotat]"
disable-model-invocation: true
model: opus
effort: high
---

# Greenfield-arbejdsgang

Gennemfør eller genoptag scopet i **$ARGUMENTS**.

AGENTS.md og de bindende kontrakter har forrang. Claude Code er eneste skriver i working tree.
Codex bruges read-only som **uafhængig reviewer** — ikke som kortlægger og ikke som
beslutningstager. Codex-fund er hypoteser, som skal verificeres mod kode, kontrakter og tests —
de implementeres ikke blindt.

## 0. Beslutningsmyndighed

**Claude Code (opus, high) afgør alle processuelle og designmæssige beslutninger og står for al
planlægning og kortlægning.** Opstår der et valg om struktur, arkitektur, navngivning, opdeling,
rækkefølge, scope-afgrænsning eller proces (fx "ét scope eller to?", "skal disse to gates
ensartes?", "hvilket af to mønstre vinder?"), træffes det her, ud fra ét kriterium: **hvad giver
det bedste og mest velstrukturerede slutprodukt.** Beslutningen registreres kort i arbejdsnotatet
sammen med den evidens (filreferencer, kontraktafsnit, tests) den hviler på, så den senere kan
anfægtes af revieweren.

Beslutninger træffes på **high**. Rammer implementeringen på medium et reelt nyt arkitektur- eller
procesvalg, standses den del, og beslutningen tages på high (jf. §3) — der gættes ikke videre.

**Brugeren involveres ikke i beslutningsprocesser undervejs** — ikke i tekniske, processuelle
eller designmæssige valg. Den ENESTE undtagelse er ændringer i **synlig UI/UX eller
beregningstal/-regler**; de forelægges efter §2 som konkrete eksempler på, hvordan en bruger vil
opleve forskellen på de to muligheder (ikke som teknisk beskrivelse).

**Rent kosmetiske ændringer retter Claude uden videre.** Kosmetisk = ingen adfærdsændring
overhovedet: navnekonsistens, eksportnavne, kommentar-/dokumentationssprog, filplacering uden
importsemantisk effekt, formatering, døde typer. Er der den mindste tvivl om, at ændringen kan
flytte adfærd, tal eller UI, er den ikke kosmetisk.

## Låst modelpolitik og arbejdsdeling

Modelpolitikken og arbejdsdelingen er brugerbeslutninger og kan ikke ændres, optimeres væk eller
fraviges af workflowet eller en agent uden en ny, udtrykkelig brugerbeslutning. De gælder denne
arbejdsgang — uden for den er der ingen fast arbejdsdeling mellem Claude Code og Codex.

| Rolle | Model | Effort |
|---|---|---|
| Design-, proces- og arkitekturbeslutninger; al planlægning og kortlægning | Claude Code, Opus | high |
| Implementering af det allerede besluttede scope | Claude Code, Opus | medium |
| Uafhængigt slutreview — standard | Codex sol | medium |
| Uafhængigt slutreview — klasse H, eller scope der har været forgæves forsøgt løst før | Codex sol | high |

- **Arbejdsdelingen:** Claude Code står for al planlægning, kortlægning og alle design- og
  procesbeslutninger (Opus/high) samt implementeringen (Opus/medium). Codex bruges read-only som
  uafhængig reviewer — sol/medium som standard, sol/high ved trust-kritisk arbejde eller scope der
  har været forsøgt løst forgæves før.
- Claude Code bruger kun Opus i Mineo. Sonnet må aldrig bruges.
- Codex bruger kun Sol i denne arbejdsgang. Luna må aldrig bruges. Terra bruges ikke her; bruges
  Terra uden for arbejdsgangen, er reasoning-effort altid `high` — aldrig `low` eller `medium`.
- Codex kortlægger ikke og beslutter ikke. Dens ene opgave er at anfægte det færdige arbejde.

## 1. Preflight og arbejdsnotat

1. Læs de relevante kontrakter i `src/contracts/` og det relevante arkitekturdokument i
   `docs/architecture/`. Claude-memory er kun orientering og aldrig autoritet.
2. Inspicér `git status` og `git diff`. Bevar eksisterende ændringer, og noter baseline i
   arbejdsnotatet.
3. Skriv et **arbejdsnotat** for scopet, før produktionskode ændres: scope, invarianter,
   acceptance criteria, testplan og risikoklasse. Notatet er arbejdsgangens hukommelse — det er
   dét, revieweren i §4 får forelagt, og dét, beslutninger registreres i.

**Hvor notatet bor.** Er scopet lille nok til at blive gennemført i én session, holdes notatet i
hovedtråden. Strækker arbejdet sig over flere sessioner, eller skal det kunne genoptages efter en
godkendelsespause, skrives det til en midlertidig fil i `docs/` (fx `docs/arbejdsnotat-<slug>.md`),
som **slettes, når arbejdet er afsluttet og committet**. Efterlad aldrig et afsluttet arbejdsnotat i
repoet: en færdig opgaves plan er hverken dokumentation eller historik, og den vil senere blive læst
som en beskrivelse af nutiden. Varig viden fra arbejdet hører i en kontrakt, i koden eller i en test.

Hav kun ét aktivt greenfield-scope ad gangen.

### Kortlægning (Claude, high)

Kortlægningen sker her i hovedtråden, før implementering — den uddelegeres ikke til Codex.
Kortlæg eksisterende adfærd, invarianter, parallel logik der skal konsolideres eller bevidst
holdes adskilt, samt de testbare acceptance criteria. Ved brede gennemgange fanes ud til
subagents (jf. AGENTS.md §Reviews og subagents), så hovedtråden beholder konklusionerne og ikke
fil-dumps. Skriv konklusionerne i arbejdsnotatet med filreferencer — de er grundlaget, revieweren
senere prøver at vælte.

For klasse H er kortlægningen ikke valgfri: den skal eksplicit dække, hvilke tal, hvilken
persisteret form og hvilke gates der kan flytte sig, og hvorfor de ikke gør det.

### Risikoklasse og review-routing

| Klasse | Kendetegn | Slutreview |
|---|---|---|
| **L** | Dokumentation, mekanik eller helt lokalt kendt mønster; ingen adfærdsrisiko | Dokumentation: intet Codex-kald. Kode: sol, medium |
| **M** | Almindelig kode/refaktorering med afgrænset adfærd | Sol, medium |
| **H** | Beregning, schema/data-integritet, save/load/session, delt state/runtime, dokumentgate eller tværgående/tvetydig arkitektur | Sol, high |

Uafhængigt af klasse hæves reviewet til **sol/high**, hvis scopet er usædvanligt sammensat, eller
hvis det har været forsøgt løst forgæves før (tidligere forsøg rullet tilbage, gentaget review-fund i
samme område, en rettelse der har genintroduceret et tidligere lukket problem). Noter i arbejdsnotatet
hvorfor der er hævet.

## 2. Godkendelsesgate

Hvis arbejdet kan ændre synlig UI/UX eller beregningstal/-regler, sæt status
`afventer-godkendelse`, forelæg den konkrete brugeroplevelse og stop før implementering.
Forelæg som konkrete eksempler på, hvad brugeren faktisk vil se ved hver mulighed — aldrig som
teknisk beskrivelse. Alt ANDET afgøres uden brugeren (§0).
Efter eksplicit godkendelse noteres beslutningen og status sættes `klar`. Rent teknisk arbejde
markeres `godkendelse ikke påkrævet` og sættes direkte `klar`.

Skillens modeltilstand gælder kun den tur, hvor `/greenfield` påkaldes. Efter en pause til
brugergodkendelse skal handoffen derfor bede brugeren genoptage med `/greenfield <arbejdsnotat eller scope>`. En
almindelig bekræftelse må registreres, men implementeringen må først fortsætte, når skillen er
påkaldt igen; ellers falder sessionen tilbage til sit standardvalg.

## 3. Implementering og gate

Implementeringen kører på **Opus/medium**. Skillen påkaldes på high; når planlægningen efter §1 er
skrevet i arbejdsnotatet og der ikke er flere åbne designvalg, sænkes efforten til medium for selve
udførelsen. Er scopet så lille, at planlægning og udførelse er samme skridt, gennemføres det bare
på high — skift ikke frem og tilbage for et par filer.

Fordi arkitekturen allerede er afgjort, følger implementeringen arbejdsnotatet. **Opstår der et reelt nyt
design- eller arkitekturvalg undervejs, standses den del** — der gættes ikke, og valget skubbes
ikke til revieweren. Løft efforten til high, træf beslutningen efter §0, skriv den i arbejdsnotatet, og
genoptag udførelsen. Genbrug før ny kode, og konsolidér kun adfærd der faktisk skal være ens.

Sæt status `under-implementering`. Kør de mindst omfattende relevante checks fra AGENTS.md
efter sammenhængende delændringer. For klasse H køres den fulde krævede gate før handoff.
Ved cutover-migrering bruges projektets `/verify`-skill, efter at dens kendte mellemtilstand
er kontrolleret mod den aktuelle plan og kode.

## 4. Uafhængigt review

Sæt status `review`, og kør review, når acceptance criteria og den første kvalitetsgate er grønne.

Fordi design og implementering nu ligger samme sted, er Codex den eneste uafhængige instans i
arbejdsgangen. Reviewet må derfor **ikke** begrænses til, om koden gør det arbejdsnotatet siger — det skal
også kunne anfægte selve beslutningen. Hver prompt forelægger arbejdsnotatets registrerede designvalg som
noget, revieweren aktivt skal prøve at vælte.

To krav gælder ethvert review i denne arbejdsgang og skal stå i prompten:

- **Rod frem for symptom.** For hvert fund skal Codex tage stilling til, om det er en isoleret fejl
  eller et udslag af et underliggende strukturelt problem — og sige hvilket af de to. Peger flere
  fund på samme årsag, skal den årsag navngives frem for at blive rapporteret som spredte
  symptomer. Kravet er tosidet: Codex skal også skrive, når et fund faktisk *er* lokalt, så
  vurderingen ikke skævvrides mod at opskalere alt til arkitekturkritik.
- **Anbefalet løsning.** Codex skal for hvert fund anbefale, hvordan det bedst lukkes, og ved
  strukturelle og arkitektoniske fund begrunde anbefalingen i den samlede struktur — ikke kun i
  det sted, fejlen viser sig. Sol er stærk til de store strukturelle sammenhænge, og den vurdering
  skal indhentes frem for at blive gættet her.

Anbefalingerne er **input til beslutningen, ikke selve beslutningen**. §0 gælder uændret: valget
træffes her, på high, mod kode og kontrakter. Vælges en anden løsning end den anbefalede, noteres
det i arbejdsnotatet med begrundelse — en anbefaling implementeres hverken blindt eller afvises tavst.

Ligger den identificerede rod **uden for arbejdsnotatets scope**, udvides arbejdet ikke stiltiende: der
udskilles rodårsagen som et selvstændigt scope med Codex' anbefaling skrevet ned, og det aktuelle
arbejdsnotat noterer, at dets rettelse er symptomatisk, og hvorfor det er forsvarligt indtil videre.
Er rodårsagen ikke løst ved handoff, hører den i `docs/aabne-beslutninger-og-daekningshuller.md` —
ikke i et efterladt arbejdsnotat.

```powershell
# L (kode) og M
codex review --uncommitted -c 'model="gpt-5.6-sol"' -c 'model_reasoning_effort="medium"' `
  "Review <arbejdsnotat eller scope> mod diff og berørte tests. Kontrollér korrekthed, invarianter, utilsigtet adfærdsændring, parallel logik og testhuller. arbejdsnotatets designvalg er truffet af den samme agent, der skrev koden: efterprøv dem selvstændigt, og sig til, hvis et valg er forkert eller en enklere struktur var mulig. For HVERT fund: (1) angiv om det er en isoleret fejl eller et symptom på et underliggende strukturelt problem — og navngiv i så fald årsagen; peger flere fund på samme rod, rapportér roden frem for symptomerne, men skriv også udtrykkeligt når et fund faktisk er lokalt; (2) anbefal hvordan det bedst løses, og begrund strukturelle anbefalinger i den samlede struktur, ikke kun i det sted fejlen viser sig. Returnér kun handlingskrævende fund med fil/linje og evidens."

# H, eller scope der har været forsøgt løst forgæves før
codex review --uncommitted -c 'model="gpt-5.6-sol"' -c 'model_reasoning_effort="high"' `
  "Kritisk review af <arbejdsnotat eller scope> mod diff og tests. Kontrollér især beregningstal, datatab, schema/runtime-integritet, stale revisions, atomisk save/load, fail-closed gates, kontrakter og manglende invarianttests. arbejdsnotatets designvalg er truffet af den samme agent, der skrev koden, og er ikke reviewet af andre: efterprøv dem fra bunden — er afgrænsningen rigtig, er den valgte struktur den rigtige, og er noget trust-kritisk overset, fordi planen ikke så efter det? For HVERT fund: (1) grav til roden — angiv om det er en isoleret fejl eller et symptom på et underliggende strukturelt problem, navngiv årsagen, og saml fund der deler rod under den ene årsag i stedet for at rapportere dem spredt; skriv også udtrykkeligt når et fund faktisk er lokalt, så vurderingen ikke skævvrides mod arkitekturkritik; (2) anbefal den bedste løsning og begrund den i den samlede struktur — vurdér for arkitektoniske og strukturelle fund, om den rigtige rettelse ligger et andet sted end der hvor fejlen viser sig, og sig til hvis roden ligger uden for arbejdsnotatets scope. Returnér kun handlingskrævende fund med fil/linje og evidens."
```

Hvis working tree indeholder andre ændringer, må et globalt `--uncommitted`-review ikke bruges
ukritisk. Brug i stedet `codex exec ... -s read-only` med arbejdsnotatets præcise filer og afgrænsning,
og bed Codex ignorere baseline-ændringer uden for arbejdsnotatet.

Registrér hvert fund som `bekræftet`, `afvist med evidens` eller `udskilt til eget scope` — og for fund, hvor Codex
har udpeget en rod eller anbefalet en løsning, tillige om roden accepteres, og om anbefalingen
følges eller fraviges (med begrundelse). Rent kosmetiske fund
retter Claude uden videre (§0); rejser et fund et design- eller procesvalg, afgøres det efter §0 —
på high, ikke af brugeren. Et fund må kun afvises mod konkret evidens i kode, kontrakt eller test,
aldrig fordi det strider mod den plan, der blev lagt før reviewet: at planen bliver anfægtet, er
netop reviewets formål. Ret alle bekræftede fund i scope og kør relevante checks igen. Kør et
fokuseret re-review, hvis rettelsen ændrer produktionskode på grund af et
korrektheds-/integritetsfund; rettelser i klasse H re-reviewes altid.
Afslut først, når alle fund har en dokumenteret disposition, acceptance criteria er opfyldt,
og relevante gates er grønne.

## 5. Handoff

Sæt status `afsluttet`. Rapportér kort: ændrede filer, udførte og bevidst fravalgte checks,
bekræftede/rettede fund, afviste fund med årsag, opfyldte acceptance criteria og resterende
scopes/risici. Slet et midlertidigt arbejdsnotat, når arbejdet er committet. Commit kun efter
brugerens udtrykkelige besked; push aldrig.
