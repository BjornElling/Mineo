# Mineo - Satser domænekontrakt

**Status:** Minimal domænekontrakt (normativ)  
**Type:** Domæne-/sagsglobal kontrakt  
**Prioritet:** Underordnet `form-contract.md`, `domain-boundary-contract.md` og `persistence-contract.md`.  
**Senest verificeret mod kode:** 2026-07-12

---

## 1. Scope

`satser` er en sags-global persisted sektion og skrives kun fra siden `Satser`. Den persisterede sektion indeholder aktuelt udelukkende det valgte **satsår** (`aargang`, jf. `satserSchema.ts`); selve sats- og rentetabellerne er programdata og gemmes ikke.

Satser-domænet kan samtidig læse lovbestemte reference-data fra `src/data/lovbestemteRates`. Denne kontrakt adskiller derfor brugerens sagsspecifikke satsgrundlag (det valgte satsår) fra reference-data.
Reference-dataenes katalogmetadata og integritetskrav følger desuden `calculation-data-contract.md`.

**Autoritativ beregningskilde:** Satsårs-opslag, gate og PDF-gate ejes af `src/domain/policies/satserCalculations.ts` (`resolveSatserEffectiveAargang`, `resolveSatserAargangErrorMessage`, `canDownloadSatser`, `resolveSatserPdfGate`). Opregulering fra ét år til et andet — den to-metoders sats-anvendelse, der er fundamentet for de øvrige domæners reguleringer — ejes af de **to kanoniske opregulerings-motorer** i `src/domain/satser/opreguleringsmotorer.ts` (`opregulerMedAslAarsloensmaksimum` og `opregulerMedAkkumuleretReguleringssats`). Ingen anden opreguleringssti må indføres; alle domæner der opregulerer beløb skal kalde disse motorer.

**Fail-closed for manglende satsdækning:** Begge motorer returnerer `manglendeAar` (de år hvor nødvendigt indeks/sats mangler). Er listen ikke-tom, er `faktor`/`deltaPct` **ikke** pålidelige, og kalderen skal fail-close (synlig feltfejl frem for et tavst "ingen regulering"-resultat). Den akkumulerede reguleringssats kræver satsdækning for start-, slut- **og** alle mellemår, også når start-årets sats ikke multipliceres ind i selve faktoren — datadækningen er en selvstændig invariant.

---

## 2. Kildehierarki

1. Lovbestemte reference-tabeller er statiske programdata og gemmes ikke som brugerinput.
2. Persisted `satser` er brugerens sagsspecifikke satsgrundlag og gemmes i `.eo`.
3. Andre domæner må læse `satser` som autoritativt sagsinput, når deres domænekontrakt tillader det.
4. PDF-output for satser skal bruge samme kildehierarki og må ikke blande reference-data og brugerinput implicit.

---

## 3. Save/load

Kun schema-valideret brugerindtastet eller brugervalgt satsdata må ligge i `satser`-sektionen.

Reference-data må ikke injiceres under load blot for at gøre en gammel fil komplet.

---

## 4. Minimumstestflade

Tests skal dække:

1. hvad der gemmes i `.eo`,
2. hvad der kommer fra reference-data,
3. at andre domæner læser satser via autoriseret committed state,
4. at satser-PDF følger samme kildehierarki,
5. at begge opregulerings-motorer fail-closer med ikke-tom `manglendeAar` ved manglende indeks/sats — herunder at akkumuleret reguleringssats kræver dækning for start-, slut- og mellemår (`src/__tests__/domain/satser/opreguleringsmotorer.test.ts`).
