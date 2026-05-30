# Mineo - Satser domænekontrakt

**Status:** Minimal domænekontrakt (normativ)  
**Type:** Domæne-/sagsglobal kontrakt  
**Prioritet:** Underordnet `form-contract.md`, `domain-boundary-contract.md` og `persistence-contract.md`.  
**Senest verificeret mod kode:** 2026-05-30

---

## 1. Scope

`satser` er en sags-global persisted sektion og skrives kun fra siden `Satser`.

Satser-domænet kan samtidig læse lovbestemte reference-data fra `src/data/lovbestemteRates`. Denne kontrakt adskiller derfor brugerens sagsspecifikke satsgrundlag fra reference-data.

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
4. at satser-PDF følger samme kildehierarki.
