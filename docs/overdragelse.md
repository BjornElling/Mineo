# Overdragelsesnotat — nedlukning 2026-08-07

Midlertidig fil. Slettes når arbejdet er afsluttet.

## Status: RENT STOP-STED. Træet er GRØNT.

- **Branch:** `greenfield`
- **Seneste commit:** `bb52b902` «Giv enum-etiketterne ét hjem»
- **Arbejdstræ:** kun `docs/review/parallel-redesign-review.md` + dette notat er uncommittede.
  Al kode er committet.
- **Verificeret før nedlukning:** 530 testfiler / 6746 tests grønne, `typecheck` (kilde),
  `typecheck:test` og `lint` grønne. Ingen gate er kørt under nedlukningen (jf.
  nedluknings-protokollen) — tallene er fra den fulde kørsel umiddelbart før sidste commit.

## Hvad er gjort i denne session

Fire kandidater lukket, hver som sin egen commit:

| Commit | Kandidat |
|---|---|
| `1982e99a` | **#26** (Container → `containerNavigation/`) og **#35** (carry-forward-opslag) |
| `3a5ca95b` | **#45** (tabellernes rækkefølge-lag, omskåret — ingen `GridSpec`) |
| `bb52b902` | **#21** (enum-etiketter fik ét hjem, omskåret — intet settings-register) |

Tre af de fire var skåret forkert i planen. Detaljerne — inkl. hvad der bevidst IKKE er gjort
og hvorfor — står i `docs/review/parallel-redesign-review.md` under afsnittet **«Gennemført
2026-08-07 (tredje omgang: #26, #35, #45 og #21)»**. Læs det afsnit frem for at genlæse koden.

## Hvad mangler

**Én kandidat: #52 — normative kontrakter: invariant-kerne vs. implementeringskort.**

Næste konkrete skridt:

1. **Verificér tallene først.** Planens tal er fra 2026-08-06 (15 af 29 kontrakter afviger;
   `document-output-contract.md` har 38 filreferencer i normativ brødtekst; `app-settings.md`
   har 10 refs på 80 linjer). Flere kontrakter er redigeret siden — bl.a.
   `app-shell-contract.md` §5.3 (blev en tabel med værn) og `keyboard-navigation.md`. Tæl om.
2. Løsningen findes allerede som `contract-template.md`: §2 Normative Regler = invariant,
   §3 Autoritative Kilder = implementeringskort, §4 Testkobling, §5 Kendte Undtagelser.
   Årsagen til at 15 afviger er, at `contract-topology-procedure.md` **l. 41** gør de øvrige
   template-afsnit *anbefalede, ikke håndhævede*.
3. Forbilleder at rette sig ind efter: `calculation-data-contract.md`, `auth-gate-contract.md`.
   Fire kontrakter har 0 filreferencer og viser at det er muligt.
4. Overvej et værn: en filreference i et afsnit markeret «normativt, ikke-forklarende» er
   præcis den drift kandidaten handler om, og `contractCoverageMatrix.test.ts` findes allerede
   som sted at hænge en kontrol op.

## Åbent spørgsmål til brugeren (uændret, blokerer ikke #52)

**Satsens enhed på Anciennitetstillæg.** Lønindkomst lader brugeren VÆLGE enheden
(`anciennitetstillaegSatsAngivesPer`: Time/Måned); EO-oplysninger UDLEDER den af
`beregnesUdFra` og viser intet valg. Begge adfærd er bevaret uændret bag `satsEnhedSlot`.
Spørgsmålet: skal EO-oplysninger også have valget, eller er udledningen den ønskede adfærd dér?
Ingen ændring foretages før svar. Se «Nyt UI/UX-spørgsmål der afventer brugeren» i
review-filen.

## Registreret undervejs, hører til senere spor (ikke gjort)

Disse er fundet under arbejdet og bevidst ikke lavet — de står også i review-filens
tredje-omgang-afsnit:

- **`DanishDateString`-datalaget** har to private `danishDateToNumber`-kopier
  (`overenskomstRates.ts:139`, `offentligLoenLookup.ts:24`) med samme krop.
- **`.filter().reduce()`-max-familien:** seks interval-start-resolvere (fem i
  `eetKapitaliseringOpslag.ts`, én i `forsoergertabAslYdelser.ts`) med samme form. De er
  interval-opslag med slutdato-afvisning, ikke carry-forward, så de hørte ikke under #35.
- **`RowDeleteButton`s omgivende celle** (`position: relative` + `paddingRight: 28`) er stadig
  skrevet i hånden 10 steder i fire varianter.
- **`Indstillinger.tsx`:** de fire `is…Option`-typeguards er samme mønster fire gange og hører
  principielt ved enummet. Og `defaultDirectoryHandleId` alene fylder ~143 af filens 605
  linjer — dét er sidens største enkeltansvar, ikke metadata.

## Note til næste session

Arbejdsformen der betalte sig hver gang: **verificér kandidatens præmis mod koden, før dens
bogstav implementeres** — også ordet «blokeret» (#35 var det ikke). Og **mutationstest hvert
værn**; overlever mutationen, mangler fixturet noget. To gange i denne session var den farlige
del ikke refaktoreringen, men en tie-break eller asymmetri, ingen fixture dækkede.
