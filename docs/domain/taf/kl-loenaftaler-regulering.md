# KL-lønaftaler – regulering (særlig logik)

Dette er det normative dokument for, hvordan reguleringsgrundlaget **"KL-lønaftaler"**
adskiller sig fra de øvrige reguleringsmodeller (KRL-satstabel, statistik,
overenskomst, manuelt angivet). Reguleringsformen KL-lønaftaler har bevidst både en **alternativ
beregningsmetode** og **alternative visninger**. Læs dette dokument før refactors,
der rører lønudviklings-/regulerings-koden – ellers ser KL-lønaftaler-særtilfældene ud som
inkonsistens, der "burde" forenes med de andre modeller. Det skal de ikke.

> Kortform: Reguleringsformen KL-lønaftaler regulerer **trinvist på selve lønnen**
> med afrunding på hvert trin, modsat de øvrige modeller, der fremskriver via ét samlet indeksforhold. Den har
> **ingen akkumuleret regulering** i nogen brugervendt visning.

---

## 1. Forretningslogik

### 1.1 Datakilden
KL-lønaftalerne lagres som rene **periode-reguleringssatser** `[dato, sats]` i
[`src/data/klLoenaftaler.ts`](../../../src/data/klLoenaftaler.ts) – ikke som
akkumulerede indeks. Satserne er bevidst beregningsteknisk unøjagtige (afrundet til
nærmeste 0,05 % af den procentvise fremskrivning i akkumuleret regulering) og indgår
udelukkende for at lave en **parallel til Erstatningsnævnets (forkerte)
reguleringssatser**. Se noten i datafilen for, hvordan nye satser tilføjes.

### 1.2 Beregningsmetoden (kæde-opregulering med trinvis afrunding)
Skadelidtes løn opreguleres **trin for trin**:

```
løn_0 = basisløn (på reguleringsdatoen)
løn_i = afrund_til_2_decimaler( løn_{i-1} × (1 + periodesats_i / 100) )
```

dvs. den forudgående regulerede løn forhøjes med næste periodes sats og afrundes til
to decimaler, hvorefter den afrundede værdi opreguleres til næste sats osv. Dette
afviger fra de øvrige modeller, der beregner ét samlet indeksforhold
(`løn = basisløn × (1 + akkumuleret/100)`) uden mellemliggende afrunding.

TAF-beløbet for et segment bruger den afrundede løn: `beløb = afrund(reguleret løn × antal)`.

Selve kæden ligger i
[`src/domain/erstatningsopgoerelse/engines/klLoenaftalerReguleretLoen.ts`](../../../src/domain/erstatningsopgoerelse/engines/klLoenaftalerReguleretLoen.ts).

### 1.3 Ingen akkumuleret regulering (brugervendt)
KL-lønaftaler-modellen viser aldrig en akkumuleret reguleringsprocent. Hvor de øvrige modeller
viser indeks/akkumuleret udvikling, viser KL-lønaftaler i stedet periodesatsen og den
resulterende regulerede løn.

---

## 2. Hvorfor `deltaPct` internt stadig er den akkumulerede regulering

Et `LoenudviklingSegment` bærer `deltaPct` (regulering ift. basis) + `maanedsloenOre/dagsloenOre`
(basisløn). For KL-lønaftaler fastholdes denne repræsentation **med vilje**:

- `deltaPct` = den akkumulerede regulering **afledt af den kæde-opregulerede,
  afrundede løn**: `(reguleret_løn / basisløn − 1) × 100`, i fuld præcision
  (afrundet til 8 decimaler for at fjerne flydende-komma-støj). Så
  `basisløn × (1 + deltaPct/100)` reproducerer **præcis** den trinvist afrundede løn.
- Dette holder SFGG-sporet korrekt:
  - **Sygeferiegodtgørelse** (`resolveAdjustedRate`) regulerer ferielov-satsen med
    `deltaPct` (samme procentuelle udvikling som lønnen), og validerer at KL-lønaftaler-segmentets
    `deltaPct` reproducerer `reguleretLoenOre`.

Konsekvens: `deltaPct` er en intern repræsentation, der **tilfældigvis** er den
akkumulerede regulering, men den vises aldrig som "akkumuleret regulering" for KL-lønaftaler.
At nulstille `deltaPct` til 0 (og lægge lønnen i `maanedsloenOre`) ville knække SFGG
og den tværgående segmentkontrakt – gør det ikke.

### 2.1 `reguleretLoenOre`
Den kæde-opregulerede, afrundede enhedsløn bæres **eksplicit** på segmentet som det
valgfri felt `reguleretLoenOre` (kun sat for KL-lønaftaler). Det er både signalet "dette segment bruger reguleringsformen KL-lønaftaler"
og den værdi, indkomst-linjerne viser. Definition i
[`eoTypes.ts`](../../../src/domain/erstatningsopgoerelse/shared/eoTypes.ts);
feltet er valgfrit i canonical-schemaet og propageres gennem `tafPerYearDerived`.
TAF fordelt på år bruger `reguleretLoenOre` som autoritativ KL-lønaftaler-enhedsløn ved
kalenderårssplit, så årsfordelingen ikke afhænger af at genberegne KL-beløb via
`deltaPct`.

---

## 3. Alternative visninger (og hvorfor)

Alle gated på `loenudviklingBeregningsgrundlag === 'KL-lønaftaler'` eller på
tilstedeværelsen af `segment.reguleretLoenOre`. Øvrige modeller er uændrede.

| Visning | Standardmodeller | KL-lønaftaler |
| --- | --- | --- |
| **Reguleringsværdier**-tabel | model-specifikke kolonner (fx KRL: reguleringsprocent) | `Fra-dato \| Regulering` (periodesats); **ingen** akkumuleret kolonne |
| **Beregnet regulering**-tabel | `Fra-dato \| Til-dato \| Indeksberegning \| Indeks \| Lønudvikling` | `Fra-dato \| Til-dato \| Lønudvikling \| Reguleret løn` – Lønudvikling **gentager periodesatsen** (ikke akkumuleret), Reguleret løn = kæde-opreguleret |
| **Forventet indkomst**-linje (EO, TAF/år, TAF opreguleret) | `antal á basisløn kr. x (100 % + delta %)` | `antal á reguleret løn kr.` (ingen faktor-tekst) |
| **Download-dokument** (`KL-lønaftaler`) | – | kompakt `Dato \| Regulering`-tabel (kun periodesatser) |

---

## 4. Filoversigt (hvor særlogikken bor)

| Fil | KL-lønaftaler-særlogik |
| --- | --- |
| `src/data/klLoenaftaler.ts` | Periode-satser som eneste kilde; ingen akkumuleret KL-satstabel eksporteres |
| `src/domain/erstatningsopgoerelse/engines/klLoenaftalerReguleretLoen.ts` | KL-lønaftaler-kæde-resolver (`loenAt`/`deltaPctAt`) |
| `src/domain/erstatningsopgoerelse/engines/loenudviklingBeregning.ts` | Bygger resolver for KL-lønaftaler; sætter `deltaPct` (fuld præcision) og `reguleretLoenOre` |
| `src/domain/erstatningsopgoerelse/engines/reguleringsPresentation.ts` | KL-lønaftaler-grene i `buildReguleringsvaerdierTableData` og `buildReguleringIndexRows` |
| `src/domain/erstatningsopgoerelse/engines/tafPerYearDerived.ts` | Propagerer og bruger `reguleretLoenOre` som KL-lønaftaler-enhedsløn i år-segmenter |
| `src/domain/erstatningsopgoerelse/shared/eoTypes.ts` | `reguleretLoenOre`-feltet |
| `src/domain/erstatningsopgoerelse/snapshot/eoCanonicalOutput.ts` | `reguleretLoenOre` valgfrit i schema |
| `src/document/generators/eo/sections/reguleringSection.ts` | KL-lønaftaler-variant af Beregnet regulering-tabel + forklarende tekst |
| `src/document/generators/eo/sections/opgoerelseSection.ts` | KL-lønaftaler-indkomstlinje (reguleret løn, ingen faktor) |
| `src/document/generators/tafFordelt/tafFordeltPaaAarDocument.ts` | KL-lønaftaler-indkomstlinje |
| `src/document/generators/tafFordelt/tafOpreguleretPaaAarDocument.ts` | KL-lønaftaler-indkomstlinje |
| `src/domain/eoInspektion/eoInspektionRegulationViewModel.ts` | KL-lønaftaler-variant af Beregnet regulering-tabel |
| `src/document/generators/klLoenaftaler/klLoenaftalerDocument.ts` | Download-dokument (kompakt 2-kolonne) |

---

## 5. Invarianter (må ikke brydes uden at læse dette dokument)

1. KL-lønaftaler viser **aldrig** akkumuleret regulering i en brugervendt tabel/linje.
2. For KL-lønaftaler reproducerer `basisløn × (1 + deltaPct/100)` den trinvist afrundede løn –
   derfor er KL-lønaftalers `deltaPct` i fuld præcision (ikke afrundet til 2 decimaler som de
   øvrige modeller).
3. `reguleretLoenOre` er kun sat for KL-lønaftaler og er den autoritative enhedsløn i
   indkomst-linjer og TAF-årsfordeling; når den er sat, vises ingen
   `x (100 % + …)`-faktor.
4. Øvrige reguleringsmodeller må ikke ændre adfærd som følge af KL-lønaftaler-særlogik.
