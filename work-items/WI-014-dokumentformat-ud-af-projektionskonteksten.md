# WI-014: Fjern dokumentformatet fra projektionskonteksten

- **Status:** `lukket 2026-07-29` — gennemført som en del af draft/commit-reviewets **etape 11**
  (fundene R6-F03 + R0-F03), ikke som en selvstændig WI-kørsel. Se
  `docs/review/draft-commit-review/fund-oversigt.md` → etape 11's note.
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

- [x] Det er en typefejl at læse `documentDownloadFormat` i en definitions `project`.
- [x] Alle 18 hovedapp-outputs projicerer uændret (invariant 1), verificeret mod gate-matrixen.
- [x] Fuld suite og de fire gates grønne; intet snapshot opdateret.
- [x] `documentGateFormatInvariance.test.ts` bevaret — men **omskrevet frem for nedgraderet til
      sikkerhedsnet**. Se afvigelsen nedenfor.
- [x] Kontrakten opdateret med, at grænsen nu er strukturel (`document-output-contract.md` §A2.1,
      `app-settings.md`).

## Godkendelsesgate

- **Påkrævet:** nej (`godkendelse ikke påkrævet`). Ingen synlig UI/UX og ingen beregningsregler
  ændres; invariant 1-3 gør uændretheden til acceptance criteria.

## Løsningen, som den blev gennemført

Scopens spørgsmål 1 blev besvaret af kortlægningen: definitionerne læser i produktionen **præcis én**
ting fra `settings` — `projectEoRowPolicy(context.settings)` i `eoDocumentDefinitions.ts`. Løsningen er
derfor en projiceret delmængde og ikke en nominel indpakning:

- `DocumentSourceSnapshot` bærer nu `gateSettings` + `renderSettings` som to disjunkte halvdele, og
  `DocumentExecutionEnvironment`/`DocumentOutput` er generiske over begge.
- `DocumentSourceContext` er generisk over GATE-halvdelen alene. Hovedappen binder
  `MineoDocumentGateSettings = EoRowPolicy`; standalone binder `void` for begge.
- `projectDocumentRenderSettings` er render-halvdelens eneste konstruktør, og
  `DocumentRenderSettings` er gjort NOMINEL af samme grund som de to øvrige: uden mærket ville hele
  `AppSettings` være strukturelt assignable.
- `captureSource` projicerer begge halvdele fra ÉT `readSourceSettings()`-læs, så R6-F01's atomicitet
  ikke svækkes af opdelingen.

**Afvigelser fra planen — begge i skærpende retning:**

1. **`documentGateFormatInvariance.test.ts` er omskrevet, ikke bevaret som sikkerhedsnet.** Planen
   antog, at den gamle invarians-sammenligning kunne stå tilbage. Det kan den ikke: der findes ingen
   formatakse at variere i en projektion længere, så en bevaret udgave ville måle en anden invariant
   end sit eget navn. Filen hævder nu typegrænsen med en RIGTIG TypeScript-oversættelse af en virtuel
   definition mod det ægte program (TS2339) plus en kontrolprøve, der skal kompilere rent — og med
   dét er den stærkere end den fixture, den afløser.
2. **Den løftede renderers `settings`-parameter er fjernet, og den døde `DocumentSettings`-DTO med den**
   (INC-F19). Begge var åbne veje til format/brevhoved uden om gaten; ingen af dem havde en consumer.

## Verifikation

- **Plan:** gate-matrixen + format-invariansen + `documentFileName` + docx/pdf-generatorsuiter efter
  ændringen; derefter fuld gate.
- **Resultat:** gennemført som etape 11. Se etapens note i
  `docs/review/draft-commit-review/fund-oversigt.md` for gate- og suite-tal samt mutationsbeviserne.

## Review-fund

Fundene ER reviewfundene R6-F03 + R0-F03; WI'en var deres sporing. Tilfældighedsfundet INC-F19 kom til
under gennemførelsen og står i registeret.

## Resterende / risici

Ingen. Invariant 1–4 holdt: ingen gate skiftede udfald, intet golden-snapshot blev regenereret, og
standalone (`void` på begge halvdele) var upåvirket ud over sin signatur.
