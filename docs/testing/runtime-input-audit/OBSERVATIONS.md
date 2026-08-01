# Mineo runtime-input-audit — øvrige observationer

Registrér ikke-crashende afvigelser, inkonsistens, datatabsmistanke, kontraktdrift, parallel logik og spørgsmål, som senere skal vurderes af udvikleren eller brugeren.

## Indeks

| ID | Kort titel | Kategori | Flade | Status | Først set |
|---|---|---|---|---|---|
| OBS-001 | Kapitaliseringsfelter bevares ved skift til midlertidig afgørelse | Kontraktdrift / Dataintegritet | SURF-004 / EET oplysninger / ASL-afgørelsestabel | Bekræftet | 2026-08-01 19:35 Europe/Copenhagen |

### OBS-001 — Kapitaliseringsfelter bevares ved skift til midlertidig afgørelse

- Status: Bekræftet
- Kategori: Kontraktdrift / Dataintegritet
- Først set: 2026-08-01 19:35 Europe/Copenhagen
- Commit/build og dirty-state: c694d13 / 2026.08.1196.c694d13; auditdokumenter samt brugerbestilt audit-skillændring, ingen produktkode
- Flade/scenarie: SURF-004 / EET oplysninger / ASL-afgørelsestabel
- Relaterede fund: —

**Starttilstand og reproduktion**

1. Log ind gennem den synlige loginformular.
2. På Stamdata blev den syntetiske sag udfyldt med `EO-001`, `AB`, `CD`, `Test Person`, `01-01-1980`, `Arbejdsulykke` og `01-01-2020`.
3. På Erhvervsevnetab → EET oplysninger blev første afgørelse udfyldt som: Afgørelsesdato `01-01-2020`, Virkningsdato `01-01-2020`, EET `50 %`, Afgørelsestype `Endelig`, Kap.dato `01-01-2020` og Kap. `50 %`.
4. Afgørelsestype blev skiftet til `Midlertidig` via dropdown.
5. Scenariet blev gentaget fra samme gyldige række med samme resultat.

**Observeret adfærd**

Efter skiftet til `Midlertidig` stod `Kap.dato` fortsat som `01-01-2020` og `Kap. %` fortsat som `50`. Begge felter blev markeret røde med henholdsvis:

- `Kapitaliseringsdato må kun udfyldes ved endelig eller delvist endelig afgørelsestype.`
- `Kapitaliseringsprocent må ikke udfyldes ved midlertidig eller ikke-valgt afgørelsestype.`

De tidligere værdier blev altså ikke ryddet ved mode-/relevansskiftet.

**Sammenligningsgrundlag**

`src/contracts/form-contract.md` §7 punkt 5 kræver, at et felt med aktiv rød fejl ryddes i samme transaktion, når et styrende valg gør feltet irrelevant. `src/inputCore/catalog/erhvervsevnetabDescriptors.ts` beskriver samtidig afgørelsestypen som styrende for kapitaliseringsfelterne.

**Hvorfor det bør undersøges**

En bruger, der ændrer en udfyldt endelig afgørelse til midlertidig, efterlades med to røde kapitaliseringsfelter, som ikke længere er relevante for den valgte afgørelsestype. Det kan føre til uventet validerings-/dokumentblokering og kræver manuel oprydning i felter, som burde følge modevalget.

**Evidens**

- Screenshot/trace/kildereference: Playwright-snapshot `.playwright-cli/page-2026-08-01T17-35-54-916Z.yml`; kontrakt `src/contracts/form-contract.md` §7.5; descriptor `src/inputCore/catalog/erhvervsevnetabDescriptors.ts`
- Reproducerbarhed: 2/2 fra gyldig række

## Postskabelon

### OBS-NNN — Kort, observerbar titel

- Status: Ny / Bekræftet / Ustabil / Dublet / Kræver afklaring
- Kategori: Inkonsistens / Dataintegritet / Kontraktdrift / Parallel logik / UX / Beregningsobservation / Andet
- Først set: YYYY-MM-DD HH:mm Europe/Copenhagen
- Commit/build og dirty-state: —
- Flade/scenarie: SURF-/EDGE-/CUT-id
- Relaterede fund: —

**Starttilstand og reproduktion**

1. …

**Observeret adfærd**

Beskriv kun det konkrete, observerbare resultat.

**Sammenligningsgrundlag**

Angiv den anden flade, kontrakt, schema-branch eller nærliggende værdi, der opfører sig anderledes.

**Hvorfor det bør undersøges**

Beskriv risikoen eller det nødvendige bruger-/udviklervalg uden at foreslå en kodeændring.

**Evidens**

- Screenshot/trace/kildereference: —
- Reproducerbarhed: —
