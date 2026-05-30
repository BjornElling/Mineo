# Mineo – PDF-kontrakt

**Status:** Gældende arkitektur (normativ)
**Type:** Tværgående kontrakt
**Gælder for:** Alle Mineo PDF-downloads og PDF-generering.
**Senest verificeret mod kode:** 2026-05-30

Denne kontrakt fastlægger tværgående regler for PDF-output. Domænespecifikke snapshot-kontrakter må gerne specificere egne projektioner, men de må ikke afvige fra reglerne her.

Visuel struktur, teksttyper, tabeller og spacing reguleres normativt af `pdf-layout-contract.md`.
`pdf-contract.md` regulerer data-, gate- og guard-regler for PDF-output.

---

## 1. Grundregel

1. PDF er trust-kritisk output.
2. PDF-renderere må kun bygge på committed, autoritativt input eller autoritative projektioner.
3. PDF-renderere må ikke læse draft-state, UI-state eller uautoriserede persisted sektioner.

---

## 2. Download-gate-definition

Download er blokeret hvis og kun hvis mindst én af følgende er sand:

1. Der findes blokerende feltfejl på de relevante committed inputfelter.
2. Den autoritative beregning ikke kan dannes. For snapshot-first-domæner betyder det en typed status/projektion fra `snapshot-contract.md` og den relevante domænekontrakt. For ikke-snapshot-domæner skal domænet levere et eksplicit preflight-/gate-resultat med samme semantik.
3. Det konkrete PDF-output er blokeret af output-specifikke invariants eller guards.

Konsekvens:
- Feltfejl, snapshot-status og output-specifikke blokeringer skal aggregeres eksplicit.
- Ingen download-knap må nøjes med kun én af disse tre kilder.
- Aggregeringen ejes af domæne-/snapshot-/preflight-laget eller et centralt PDF-gate-lag, ikke af den enkelte renderer.
- Download-knapper skal modtage et samlet gate-resultat med `canDownload` og auditerbare årsager.
- PDF-generatorer afgør ikke selv, om domænet er `fail_closed`; de modtager en allerede godkendt model eller returnerer runtime-fejl.

`pdfService.ts` er i den nuværende arkitektur service boundary for download-afvikling, lazy-load og runtime-fejl. Langsigtet skal domænepolitik og gates flyttes ud i domænesnapshots/projektioner, så service-laget bliver mekanisk adapter.

---

## 3. Toggle-guards for betingede felter

Når et felt i UI vises betinget af et toggle, et valg eller en anden brugerbeslutning, skal den PDF-renderer der kan udskrive feltet have en tilsvarende guard.

Acceptable mønstre:

1. Sektionsniveau:
   - engine/projection returnerer autoritativt `beregnes = false`
   - rendereren undertrykker hele sektionen
2. Feltniveau:
   - rendereren har en eksplicit `if`-guard før værdien skrives

Det er ikke acceptabelt at indføre parallel masking eller skjult data-mutation i entry-pointet kun for PDF.

Manglende guard er en kritisk fejl, fordi stale værdier ellers kan udskrives i et tillidskritisk dokument.

---

## 4. Semantisk fravalg

Hvis en delberegning er semantisk fravalgt i det autoritative beregningslag, må PDF-laget ikke genindføre den via visningsvalg.

Det gælder både:

- sektioner
- fradragslinjer
- mellemregninger
- bilag
- andre afledte visninger

Et PDF-UI-valg er et visningsønske, ikke en ret til at overstyre semantisk fravalg.

---

## 5. Runtime-fejl under download

1. Hvis download var korrekt gated men selve PDF-genereringen fejler ved runtime, er det en systemteknisk fejl.
2. Brugeren må ikke mødes af en `BugReportButton` inline i sideflowet eller i en download-dialog.
3. Fejlen routes via den centrale fejlrapportering jf. `error-debug-contract.md`.

Lokale PDF-fejlbeskeder må kun bruges til forventelige brugerrettelige gate-/preflight-tilstande eller DEV-specifik dev-server-nedetid. Uventede runtime-fejl under en godkendt download er systemfejl.

---

## 6. Domænespecifikke projektioner

EO- og TAF-fordelt-på-år-projektioner er specificeret i `eo-snapshot-contract.md`. Øvrige domæner skal pege på deres minimale domænekontrakt, fx:

- `aarsloen-contract.md`
- `renteberegning-contract.md`
- `varigemen-contract.md`
- `forsoergertab-snapshot-contract.md`
- `satser-contract.md`

Domænespecifikke projektioner må supplere denne kontrakt, men må ikke svække §1-§5.

---

## 7. Autoritative kilder og PDF-lag-topologi

1. `src/pdf/` er det **kanoniske** PDF-lag og opdelt i:
   - `src/pdf/infrastructure/` — adapter, writer, loader, config og service-boundary (`pdfService.ts`).
   - `src/pdf/shared/` — tabel-renderer, tekst-/format-utils, brevhoved-mapping og fælles options.
   - `src/pdf/domains/` — én generator (+ evt. `sections/`) pr. domæne.
2. `src/domain/erstatningsopgoerelse/pdf/*` (`eoPdfRegulering.ts`, `eoPdfLoenudvikling.ts`, `eoPdfMoneyUtils.ts`, `sharedPdfUtils.ts`, `eoPdfModelTypes.ts`) er et **resterende, ikke-kanonisk** EO-PDF-lag under afvikling. Ny PDF-kode skal lægges i `src/pdf/`, ikke her. Afviklingen/konsolideringen af dette lag er review-planens punkt 10.5; indtil da er filerne kun tilladt som understøttelse af eksisterende EO-regulerings-/lønudviklings-output.
3. Ingen ny generator må oprettes uden for `src/pdf/domains/`.
