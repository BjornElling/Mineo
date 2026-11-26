# Oprydning til version 1.0 – arbejdsdokument

Midlertidigt styringsdokument for oprydningen. Hele mappen `docs/oprydning-1.0/` slettes i den sidste commit,
når tjeklisten er afkrydset. **Genoptag altid herfra:** læs §1–§3, tag det næste ikke-afkrydsede arbejdsstykke i
§4, og opdatér dette dokument og commit ved stykkets afslutning.

## 1. Opdrag (udvikleren, 2026-11-25)

Programmet er funktionelt færdigt; fremover kommer kun fejlrettelser og afgrænsede forbedringer.

1. Al procestekst (forløbsbeskrivelser, auditspor, reviewrapporter, statusfiler) skal væk. Det, der har varig
   værdi, skrives ind i de organiserede dokumenter, hvor det hører hjemme.
2. Alle kontrakter og al dokumentation efterprøves mod programmets faktiske adfærd. Forældet viden rettes eller
   slettes. Når arbejdet er færdigt, er alle tilbageværende dokumenter bevidste og velstrukturerede.
3. Kodekommentarer og anden tekst ryddes for historik på samme måde.
4. Versionen sættes til 1.0, og arbejdet afsluttes med commit.

**Arbejdsform (udvikleren, 2026-11-26):** Arbejdet deles i mindre bidder. Hvert arbejdsstykke i §4 afsluttes
med opdatering af dette dokument og en commit, før det næste påbegyndes. Start højst 3–4 subagenter ad gangen:
13 samtidige agenter opbrugte 5-timers-kvoten tre gange og efterlod halvfærdigt arbejde.

## 2. Regler

**Varigt indhold** – det, en fremtidig udvikler eller programmeringsassistent skal vide for at ændre programmet
korrekt:
- normative regler for adfærd, beregning, persistens og UI → `src/contracts/`;
- udviklerens afgørelser om UI/UX og beregning, især afviste ønsker og bevidste særtilfælde, så de ikke
  genåbnes → den kontrakt, der ejer emnet;
- arkitektur og begrundelser for ikke-indlysende valg → `docs/architecture/` eller ved koden;
- domæneviden og fagregler → `docs/domain/`;
- faste arbejdsinstrukser → `docs/vejledninger/`, `AGENTS.md`, `src/__tests__/AGENTS.md`.

**Ikke varigt:** hvornår noget skete, hvem der fandt det, fund-ID'er (`BB-`, `BF-`, `NY-`, `M-`, `TD-`, `OBS-`,
`R1-F04` …), reviewforløb, «tidligere var …»-fortællinger, optællinger af hvad et værn fandt, statuslinjer.
Git-historikken bevarer det.

**Tekstform:** nutid; hvad der gælder og hvorfor («ellers kan …»). Dansk efter `AGENTS.md` §Sprogpolitik;
en-dash ` – ` som tankestreg.

**Detaljerede regler:** `kommentar-regler.md` (kodekommentarer og testtitler) og `kontrakt-regler.md`
(kontrakter og docs) i denne mappe. Begge er skrevet som subagent-instrukser og kan gives videre uændret.

**Faldgruber, der er sket:**
- Regex-rensning af `«BB-123 – titel»` skar en tankestreg midt over og efterlod ugyldig UTF-8. Kør altid
  `npm run check:mojibake` efter mekanisk rensning.
- Subagenter overskrev hinandens hjælpescripts i en fælles scratchpad. Giv hver agent sin egen mappe.
- Husky kræver, at en staged kontrakt har `**Senest verificeret mod kode:**` = dagens dato.

## 3. Materiale i denne mappe

| Fil | Indhold |
|---|---|
| `udtraek-1` … `udtraek-7` | Varigt indhold udtrukket af procesdokumenterne, før de slettes. Afsnit A = udviklerafgørelser, der mangler i kontrakterne; B = varige regler; C = åbne punkter. Hvert punkt har et foreslået hjem. `udtraek-6` blev afbrudt under skrivningen – kontrollér, at den er komplet, før `docs/testing/testdaekningsgennemgang*` slettes. |
| `kommentar-regler.md`, `kontrakt-regler.md` | Instrukser til fase 3 og fase 2. |
| `fund-<gruppe>.md` | Skrives af kontraktfasen: behandlede rapportpunkter og konflikter, der skal forelægges. |

Kendte drift-kandidater fra udtrækket, som kontraktfasen skal efterprøve (koden synes at have ret):
`varigemen-contract.md` §2.5–2.8 (méngrad 1–4 er nu rød fejl, `MENGRAD_MIN = 5`); `input-field-behavior-contract.md`
§1.0a (dropdown-valg og «udfyldt række») og §4.6 («Indsæt dags dato» uden for grænsen bliver inaktiv med tooltip);
`eo-snapshot-contract.md` §2.2 (ferie uden for sit vindue giver rød celle) og «udviklerbeslutning 1 (2026-07-25)»
nær linje 349; `aarsloen-contract.md` §2a (tre standardværdier fra Indstillinger); `docs/domain/forsoergertab/`
§5.3 (dagbaseret optælling). Må IKKE indarbejdes: den gamle afvisning af «Handlingen kan ikke fortrydes» –
`critical-action-contract.md` §8 kræver linjen nu.

## 4. Tjekliste

### Afsluttet (commit «Oprydning til 1.0, del 1»)
- [x] Inventar, plan og regler.
- [x] Version 1.0.0 i `package.json`/`package-lock.json`. Udvikleren valgte visningen
      «Aktuel version: 1.0 (2026.11.1234.9c0b359)» på «Om Mineo» og siden for ikke-understøttede enheder:
      `VITE_APP_RELEASE` (fra `scripts/generate-build-info.mjs`) → `BUILD_INFO.release` → `DISPLAY_VERSION` i
      `src/config/buildInfo.ts`. Byggenummeret (`VERSION`) er uændret i fejlrapport, `.eo`-metadata og
      opdateringskontrol.
- [x] Udtræk af varigt indhold fra alle procesdokumenter (`udtraek-1` … `udtraek-7`).
- [x] ID-navngivne testfiler omdøbt (`td019*`, `td020*`, `*Brugerblik12x*`, `e2e/td-NNN-*`, `e2e/ui-0NN-*`,
      `e2e/calc-0NN-*`); Playwright-projektet hedder nu `firefox-fallback-filvaelger`.
- [x] Kommentarer og testtitler renset i: `src/domain/**`, `src/data/`, `src/validators/`, `src/schemas/`,
      `src/persistence/`, `src/settings/`, `src/config/`, `src/inputCore/`, `src/components/`, hele
      `src/__tests__/domain/`, størstedelen af resten af `src/__tests__/`, `e2e/`, `scripts/`, `.github/`, `.husky/`,
      config-filer.

### Arbejdsstykke 2 – Rest af kommentaroprydningen (lille)
- [ ] Find resterende træf: `git grep -nE "BB-[0-9]|BF-[0-9]|NY-[0-9]|\bM-[0-9]{2}\b|TD-?[0-9]{3}|R[0-9]-F[0-9]|afklaringslog|[Bb]rugerfund|[Bb]rugerblik|greenfield #|docs/(review|testing)|brugerfund-der|[Uu]dvikler(afgørelse|beslutning)" -- src e2e scripts ":!src/contracts"`.
      Ved commit af del 1 stod der ca. 90 træf i `src/document/**` (især `generators/`) og enkelte i `e2e/` og
      `src/__tests__/`. Mange i e2e/tests er testdata (journalnumre o.l.) og skal blive.
- [ ] Gennemlæs desuden `src/styles/`, `src/types/`, `src/utils/`, `src/hooks/`, `src/apps/`, `src/auth/`,
      `src/contexts/`, `src/pdf/`, `src/docx/`, `src/test/`, `src/__tests__/{utils,quality,components}` for
      dato-proveniens og «tidligere …»-fortællinger (mønsteret ovenfor fanger ikke dem).
- [ ] Kendt: `e2e/firefox-fallback-filvaelger.spec.ts` har en assertion-tekst med `OBS-005/OBS-028`, og
      `src/__tests__/domain/forsoergertab/forsoergertabIssueFields.test.ts:90` en fejlbesked med `(BB-117)`;
      begge må renses (assertion-beskeder er ikke testdata). `skjulteFelterRelevans12i.test.ts` bærer «12i» i
      navnet – omdøb.
- [ ] `npm run check:mojibake`, `typecheck`, `typecheck:test`, `typecheck:e2e`, `lint`; commit.

### Arbejdsstykke 3 – Kontrakter, gruppe G1–G2 (stort)
Instruks: `kontrakt-regler.md`. Én agent pr. gruppe, højst to ad gangen.
- [ ] G1: `input-field-behavior-contract.md`, `mineo-field-pattern.md`, `form-contract.md`, `keyboard-navigation.md`.
- [ ] G2: `eo-snapshot-contract.md`, `eet-snapshot-contract.md`, `forsoergertab-snapshot-contract.md`,
      `snapshot-contract.md`, `indskudte-loentillaeg-contract.md`, `feriepenge-begreber-contract.md`.
- [ ] Gennemse fundfilerne; flyt konflikter til §5; commit.

### Arbejdsstykke 4 – Kontrakter, gruppe G3–G5
- [ ] G3: `document-output-contract.md`, `document-format-contract.md`, `critical-action-contract.md`,
      `error-contract.md`, `amount-contract.md`, `date-contract.md`.
- [ ] G4: `persistence-contract.md`, `schema-evolution.md`, `app-settings.md`, `undo-redo-contract.md`,
      `calculation-data-contract.md`, `domain-boundary-contract.md`, `periodisering-contract.md`.
- [ ] G5: `app-shell-contract.md` (inkl. versionsvisningen), `auth-gate-contract.md`, `page-component-contract.md`,
      `aarsloen-contract.md`, `satser-contract.md`, `varigemen-contract.md`, `renteberegning-contract.md`,
      `contract-template.md`, `contract-topology.json`.
- [ ] Gennemse fundfilerne; flyt konflikter til §5; commit.

### Arbejdsstykke 5 – Arkitektur- og domænedokumenter
- [ ] G6: `docs/architecture/*.md`. `input-architecture.md` omskrives fra historik til beskrivelse
      (`acceptanceMatrix.test.ts` læser §5); `contract-topology-procedure.md` renses for historik.
- [ ] G7: `docs/domain/**`; `docs/tilfoej-*.md` → `docs/vejledninger/` (opdatér henvisninger);
      `docs/implementation/README.md` omskrives til kun reglen; afklar om planen for særligt ferietillæg findes
      (AGENTS.md påstår det).
- [ ] Commit.

### Arbejdsstykke 6 – Topniveau, skills og sletning
- [ ] `AGENTS.md`, `CLAUDE.md`, `README.md`, `src/__tests__/AGENTS.md`: efterprøv og rens for historik
      (fx «1232 kørsler», «skete 2026-09-04», «påtalt af udvikleren …»); indarbejd testmetodik fra `udtraek-6` og
      B-punkter, der hører hjemme her. AGENTS.md §Projekt: fase = version 1.0, vedligehold.
- [ ] Skills (`.claude/skills/brugerblik`, `.claude/skills/fix-it`, `.agents/skills/jette-interaktionsaudit`,
      `.agents/skills/playwright-cli`): ret stier; indfør reglen, at en skills arbejdsmateriale under `docs/testing/`
      er midlertidigt og skal foldes ind i kontrakterne og slettes, når runden er afsluttet.
- [ ] Indarbejd udtrækkenes C-punkter (åbne punkter): enten i §5 her (til udvikleren) eller som kendte huller i
      den relevante kontrakt.
- [ ] Slet `docs/review/`, `docs/testing/`, `docs/brugerfund-der-skal-rettes.md`,
      `docs/dependency-update-2026-11-07.md`. Kontrollér med `git grep` at intet henviser til dem (inkl.
      `src/__tests__/quality/`, skills, `e2e/`).
- [ ] Skriv `docs/README.md`: dokumentationens struktur (hvad ligger hvor) og vedligeholdelsesregler
      (procesmateriale er midlertidigt; varige afgørelser i kontrakter; stempler).
- [ ] Claude-memory (`C:\Users\bjell\.claude\projects\c--Users-bjell-Mineo\memory\`): slet forældede proces- og
      statusminder (reviewstatus, greenfield-forløb, HISTORIK-linjer), opdatér `MEMORY.md`.
- [ ] Fuld gate: `typecheck`, `typecheck:test`, `typecheck:e2e`, `typecheck:node`, `lint`, fuld `npm run test`
      (≥ 20 min timeout), `check:contract-verification`, `check:mojibake`.
- [ ] Forelæg §5 for udvikleren; slet `docs/oprydning-1.0/`; afsluttende commit.

## 5. Forhold, der skal forelægges udvikleren

(Udfyldes fra fundfilerne: steder hvor koden strider mod en dokumenteret afgørelse om UI/UX eller beregning, og
åbne punkter fra udtrækkenes afsnit C.) Allerede kendt:
- Afskæringen ved 16. juni 2011 for midlertidigt EET læser ved erhvervssygdom anmeldelsesdatoen. Det ser bevidst
  ud i koden, men står ingen steder; udvikleren skal bekræfte reglen (`udtraek-3` C1).
- Modstridende status for to gamle Årsløn-fund om visning af 0 % og et tomt feriedagefelt trykt som «0»
  (`udtraek-1` C1) – afklares mod koden, før det forelægges.
