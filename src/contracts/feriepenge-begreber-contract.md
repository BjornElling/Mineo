# Mineo - Feriepenge-begreber

**Status:** Gældende arkitektur (normativ)
**Type:** Tværgående kontrakt
**Prioritet:** Sideordnet de øvrige tværgående kontrakter. Begrænser enhver domænekontrakt, der producerer
brugervendt tekst om ferieydelser – herunder `aarsloen-contract.md` og erstatningsopgørelsens kontrakter.
**Senest verificeret mod kode:** 2026-08-26

---

## 1. Scope

Kontrakten fastlægger **sprogbrugen** om ferieydelser i al brugervendt tekst: feltlabels, advarsler,
tooltips, fejlbeskeder, rækketekster i «Fejl og advarsler» og genererede PDF/Word-dokumenter.

Den gælder **hele programmet**, ikke én flade. Feriepenge-formuleringer optræder mindst i:

- **Årsløn** – satsfeltet og sidens advarsler,
- **Erstatningsopgørelsen** – lønindkomst pr. ansættelsesforhold og sygeferiegodtgørelse,
- de **dokumenter**, begge flader producerer.

Kontrakten regulerer **ord**, ikke tal. Den ændrer ingen beregning og fastlægger ingen satser; hvilke
procentsatser der faktisk anvendes, ejes af beregningsdomænerne og deres egne kontrakter.

---

## 2. Normative regler

Brugerbeslutning 2026-08-26.

1. **En lønmodtagers løn tillægges enten a) feriegodtgørelse eller b) ferietillæg. Aldrig begge.**
2. **Hvad der udløser hvad:** Får lønmodtageren løn under ferie, får vedkommende **ferietillæg**. Ellers
   får vedkommende **feriegodtgørelse**.
3. **Beregningsteknisk omregning:** Til tider skal et ferietillæg beregningsteknisk opgøres som
   feriegodtgørelse. Da omregnes **1 % ferietillæg** til:
   - **12,5 % feriegodtgørelse** uden ret til 6. ferieuge,
   - **15 % feriegodtgørelse** med ret til 6. ferieuge.

   Ved **forhøjet ferietillæg** (mere end 1 %) lægges forhøjelsen oven i. Kommunalt ansatte har typisk et
   forhøjet ferietillæg på 1,95 %, svarende til **16,95 % feriegodtgørelse**. Andre satser forekommer.
4. **'Feriepenge' er en sproglig fællesnævner** for den formelle RET til en af de to ydelser, og bruges
   kun dér, hvor det potentielt kan være den ene eller den anden. **Om selve procentsatsen bruges altid
   den konkrete ydelses korrekte navn** – aldrig fællesbetegnelsen.

### 2a. Konsekvens for satsfeltet

Feltet hedder overalt **«Feriegodtgørelse/-tillæg»**, netop fordi det rummer begge ydelser (regel 1–2).
Tekster, der omtaler dets SATS, skal bruge feltets eget navn.

Ordene **«feriepengesats»** og **«feriegodtgørelsessats»** må ikke bruges om dette felts sats. Begge stod
tidligere i Årsløns advarsler, og ingen af dem stod på skærmen: feltet hed en tredje ting. En advarsel
skal føre brugeren hen til det felt, den handler om, og kan derfor kun bruge feltets synlige navn
(`form-contract.md` §7: et felt ejer sit navn ét sted).

---

## 3. Autoritative kilder

- **Feltnavnet** ejes af descriptor-katalogerne, som begge flader binder sig til:
  `src/inputCore/catalog/aarsloenDescriptors.ts` og
  `src/inputCore/catalog/erstatningsopgoerelseLoenDescriptors.ts`.
- **Årsløns advarselstekster** dannes ét sted: `beregnFejlmeddelelser` i
  `src/domain/aarsloen/aarsloenValidationPolicies.ts`. Sidekomponenterne renderer dem og formulerer dem
  ikke – en tekst, der er hardkodet i en komponent, står uden om både den kanoniske
  procentformattering og relevans-gatingen.
- **Procentformattering** følger den kanoniske `formatPercent` i `src/utils/formatUtils.ts`.

---

## 4. Testkobling

- `src/__tests__/domain/aarsloen/aarsloenValidationPolicies.test.ts` – hævder, at Årsløns
  advarselstekster bruger feltets eget navn og den kanoniske procentformattering.
- `src/__tests__/domain/erstatningsopgoerelse/loenindkomstSatsAssessment.test.ts` – hævder regel 2-3 i
  vejledningsteksten ved fuld løn under ferie: ydelsen er ferietillæg, som blot OPGØRES som
  feriegodtgørelse.
- `src/__tests__/domain/erstatningsopgoerelse/reguleringsPresentation.test.ts` – hævder
  reguleringstabellernes kolonneoverskrift for feriesatsen.

---

## 5. Kendte undtagelser

**Sygeferiegodtgørelse (SFGG).** `docs/domain/sygeferiegodtgoerelse/sygeferiegodtgoerelse.md` og
SFGG-motorerne bruger «feriepengesats» om den **lovbestemte** sats på 12,5 %, som altid anvendes uanset
hvad brugeren har indtastet for lønindkomsten. Her er ordet korrekt efter regel 4: teksten omtaler den
generelle ret og ikke ét felts indtastede sats.

*Risiko:* lav – ordet står i domænedokumentation og kodekommentarer, ikke i feltnær brugertekst.
*Re-evaluering:* hvis en SFGG-tekst en dag skal navngive et felts sats, gælder regel 4's hovedregel.
