# WI-014: Fjern dokumentformatet fra projektionskonteksten

- **Status:** `kladde`
- **Oprettet:** 2026-07-28
- **Slice/scope:** dokumentlivscyklussens kildekontekst (`DocumentSourceContext`) og de 18
  hovedapp-dokumentdefinitioners `project`
- **Kilde:** Codex sol/medium-review af WI-013 (Fase 7), fund R3 — rodårsag identificeret UDEN FOR
  Fase 7's accept-scope og derfor udskilt jf. greenfield-skillens §4
- **Afhængighed:** Fase 7 lukket (WI-013).
- **Risikoklasse:** **M**. Ændringen er typestrukturel og skal per konstruktion ikke flytte nogen
  gate, noget tal eller noget dokumentindhold — men den rører den fælles kildekontekst, alle 21
  outputs projicerer fra, så en fejl her ville ramme bredt. Slutreview `sol/medium`.
- **Baseline:** fastlægges ved påbegyndelse.

---

## Problem

`DocumentSourceContext.settings` er hele `SourceSettings`, og `documentDownloadFormat` er et felt på
den (`src/settings/sourceSettings.ts:12`). Enhver af de 18 hovedapp-definitioner KAN derfor læse det
valgte outputformat i sin `project` — altså i gaten.

Gjorde én det, ville samme sag kunne være `ready` som PDF og `blocked` som Word. Det ville ikke blive
fanget af §A2a's "samme definition til reaktiv gate og click-preflight", fordi BEGGE kanaler ville se
den samme skæve gate. Normen er entydig: **formatet vælger writer, ikke dækning** — formatvalget sker
i miljøet EFTER gaten.

Fase 7 lukkede symptomet med `documentGateFormatInvariance.test.ts`, som projicerer alle 18
definitioner for begge formater og kræver identisk resultat. Men den test er et VÆRN oven på en åben
capability, og dens dækning er tynd der, hvor det betyder mest: målt er 34 af 36 projektioner
`blocked`, kun 2 `ready`. En formatafhængighed i en ready-gren ville ikke blive fanget.

Det er samme mønster som fase 6's genåbning (`InputWriteAuthority` oven på en offentlig
`setState`): **kan capabilityen fjernes, så fjern den; et værn oven på en åben capability er en
aftale, ikke en grænse.** Jf. [[project_typed_write_boundary_over_ast_guard]].

## Scope

**Inde:**

1. Kortlæg, hvad definitionerne FAKTISK læser fra `settings` (foreløbig observation: meget lidt —
   `eoDocumentDefinitions.ts:86` sender hele `context.settings` videre til `projectEoRowPolicy`, og
   `settings.defaultLoenPaaHelligdage` læses ét sted). Kortlægningen afgør, om løsningen er en
   projiceret delmængde (`GateSettings` uden formatet) eller en nominel indpakning.
2. Gør `documentDownloadFormat` utilgængeligt fra `project` — helst så det er en TYPEFEJL at læse
   det, ikke en regel der forbyder det.
3. Bevar formatets vej til writer-/filnavnelaget uændret (`documentFileName`, writer-valg,
   `documentFormat.ts`).
4. Behold `documentGateFormatInvariance.test.ts` som sikkerhedsnet, og opdatér dens hoveddoc til, at
   grænsen nu er strukturel og testen sekundær.

**Bevidst uden for scope:**

- Øvrige felter på `SourceSettings`. Kun formatet er normativt forbudt i gaten; brevhoved- og
  regulerings-indstillinger ER legitime gate-input.
- Ready-dækningen i format-invarianstesten. Når formatet er strukturelt usynligt, er spørgsmålet
  irrelevant, og en større fixture er derfor spildt arbejde.

## Invarianter (må ikke brydes)

1. Ingen gate skifter udfald. Alle 18 outputs har samme `ready`/`blocked` som før for samme input.
2. Beregningstal og dokumentindhold uændrede — golden-/paritetstests grønne UDEN regenerering.
3. Formatet virker fortsat: PDF og Word vælges korrekt, og filnavne beholder deres endelser
   (`documentFileName.test.ts` grøn).
4. Standalone MinProcesrente (`TSettings = void`) er upåvirket.

## Acceptance criteria

- [ ] Det er en typefejl at læse `documentDownloadFormat` i en definitions `project`.
- [ ] Alle 18 hovedapp-outputs projicerer uændret (invariant 1), verificeret mod gate-matrixen.
- [ ] `build:all`, fuld suite og de fire gates grønne; intet snapshot opdateret.
- [ ] `documentGateFormatInvariance.test.ts` bevaret og dens rolle omskrevet til sikkerhedsnet.
- [ ] Planens §A2a/Fase 7-afsnit opdateret med, at grænsen nu er strukturel.

## Godkendelsesgate

- **Påkrævet:** nej (`godkendelse ikke påkrævet`). Ingen synlig UI/UX og ingen beregningsregler
  ændres; invariant 1-3 gør uændretheden til acceptance criteria.

## Verifikation

- **Plan:** gate-matrixen + format-invariansen + `documentFileName` + docx/pdf-generatorsuiter efter
  ændringen; derefter fuld gate.
- **Resultat:** <udfyldes>

## Review-fund (udfyldes i review-fasen)

| # | Fund og evidens | Alvor | Disposition | Status |
|---|---|---|---|---|
|   |   |   | rettet / afvist med evidens / ny WI-xxx | |

## Resterende / risici

<udfyldes ved afslutning>
