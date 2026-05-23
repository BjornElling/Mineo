# Mineo - EET snapshot-kontrakt

**Status:** Minimal domænekontrakt (normativ)  
**Type:** Domænekontrakt  
**Prioritet:** Underordnet `form-contract.md`, `domain-boundary-contract.md` og `snapshot-contract.md`.

---

## 1. Autoritativ Entry

`computeEetSnapshot(...)` er den autoritative entry for Erhvervsevnetab-sidevisning, tabprojektioner og EET-PDF-flow.

UI, PDF og EO-import må ikke lave parallelle EET-beregninger uden om snapshot/projektioner eller de helpers, som denne kontrakt udpeger.

---

## 2. Projektioner

Snapshot-formen er issue-/tab-projektionsformen fra `snapshot-contract.md`.

Aktuelle projektioner:

1. `loebendeYdelser`
2. `kapitalisering`
3. `efterEal`
4. `differencekrav`

Hver projektion skal deklarere issues, blocking-status og beregningsresultat på en måde, som tab- og PDF-laget kan bruge uden ny domæneberegning.

---

## 3. Blocking og Runtimefejl

Forventelige brugerinputtilstande rapporteres som issues. Uventede runtimefejl må ikke give gyldige totals eller PDF-projektioner.

Ved runtime exception skal snapshot/projektionen fail-close med blokerende issue og `computation: null` eller tilsvarende domænespecifik tom tilstand.

`differencekrav` må have særskilt blocking-semantik, hvor et blokerende beregningsresultat kan blokere uden et almindeligt `severity: 'error'` issue. Denne undtagelse skal være testdækket.

---

## 4. Row-level Fejl

Row-level valideringsfejl på ASL-/EAL-afgørelsesrækker kan rapporteres via den centrale field-error bus og indgår ikke nødvendigvis i `EetSnapshot.hasBlockingErrors`.

Kaldere må derfor ikke antage, at snapshotets blocking-flag alene er komplet save-/UI-gate for hele siden.

---

## 5. EO Import

EO's midlertidigt-EET-import må kun bruge EET-output gennem den snævre undtagelse i `domain-boundary-contract.md` og `eo-snapshot-contract.md`.

Importrelevante grupper må kun være `Midlertidig` eller `Delvist endelig`. Ukendte eller kontraktstridige afgørelsestyper i importrelevant output skal fail-close; de må ikke silently droppes som irrelevante.

Ændringer i EET-issue-typer skal altid revurdere EO-konsekvensen, fordi EO bevidst propagerer EET-issues ukritisk, når importen er aktiv.

---

## 6. Minimumstestflade

Tests skal dække:

1. snapshot bygges fra committed state,
2. runtime exception giver blokerende tom projektion,
3. de fire projektioners blocking-status,
4. row-level error-bus undtagelsen,
5. EO-import med `Midlertidig`, `Delvist endelig`, `Endelig` og ukendt afgørelsestype.
