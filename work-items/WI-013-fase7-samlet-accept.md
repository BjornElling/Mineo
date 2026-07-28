# WI-013: Fase 7 — samlet accept

- **Status:** `afsluttet` 2026-07-28
- **Oprettet:** 2026-07-28
- **Slice/scope:** greenfield-planens Fase 7 "Samlet accept"
  (`docs/architecture/draft-commit-greenfield-design.md` linje 1770-1818)
- **Kilde:** brugerønske ("fortsæt arbejdet med fase 7 … må gerne gøre hele fasen færdig i en omgang")
- **Afhængighed:** Fase 1-6 (alle lukket; Fase 6 lukket 2026-07-26 med WI-012 efter genåbning).
- **Risikoklasse:** **M**. Fasen tilføjer ACCEPT-dækning og ændrer ikke beregning, dokumentindhold
  eller UI-flade. Risikoen er den samme som WI-012's: **falsk accept** — en afleveringsgate, der
  erklærer cutoveren færdig ud fra dækning, der ikke findes. Ingen trust-kritisk outputsti ændres,
  så sol/medium er tilstrækkeligt. **Hæves ikke** til H: der er ingen tidligere forgæves forsøg på
  denne fase, og ingen produktionsadfærd er i spil.
- **Baseline:** HEAD `dfd7b54b` ("sproglige rettelser af tooltips"), rent working tree.

---

## 0. Kortlægning (gennemført 2026-07-28, opus/high)

Fase 7 har tre dele: automatiske gates, en manuel browsermatrix på 15 punkter og en afsluttende
afleveringsgate med seks betingelser. Kortlægningen viser, at kun én af de tre dele kan tages
bogstaveligt, og at fasens reelle arbejde ligger i den midterste.

### 0.1 Den centrale beslutning: browsermatrixen konverteres til automatiseret acceptmatrix

Planens punkt "Manuel browsermatrix" er skrevet FØR fase 1-5 blev bygget. På det tidspunkt var
input-tilstand mount-afhængig, og de 15 scenarier KUNNE kun observeres i en browser.

Det er ikke længere sandt, og det er ikke et tilfælde: **§10 acceptkriterium 22 kræver eksplicit, at
"Issues, beregninger og gates ikke afhænger af component mount"**, og kriterium 7 at et lukket felt
ingen lokal kopi har. Hele designets formål er, at netop disse 15 adfærdstræk er observerbare uden
en browser. En manuel matrix ville derfor måle arkitekturen med det instrument, arkitekturen blev
bygget for at afskaffe.

Dertil to praktiske forhold, der peger samme vej:

1. En "dokumenteret gennemført" manuel matrix er et engangs-bevis. Det rådner ved næste commit og
   kan ikke fejle i CI. Det er præcis den **falsk tryghed**, WI-012's dødt-værn-detektor blev bygget
   for at udelukke — et bevis, hvis eneste egenskab er, at nogen engang skrev "OK".
2. Jeg kan ikke køre en browser i dette miljø. At erklære matrixen gennemført ville være en
   påstand uden dækning.

**Beslutning (§0, high):** Fase 7 leverer matrixen som **automatiseret dækning**, ikke som manuel
afkrydsning. De 15 punkter mappes til eksisterende eller nye tests, og hvert punkt får en navngivet
dækningskilde. Restposter, der GENUINT kræver et øje (fx pixel-layout), noteres eksplicit som
udenfor og efterlades til brugeren — de erklæres ikke gennemførte.

Konsekvens for planen: afsnittet "Manuel browsermatrix" omskrives til "Acceptmatrix", og
afleveringsgatens betingelse "browsermatrixen er dokumenteret gennemført" får sin præcise,
maskinelt kontrollerbare betydning.

### 0.2 Dækningsmåling af de 15 punkter (fan-out, verificeret mod testfiler)

| # | Punkt | Tilstand |
|---|---|---|
| 1 | Åben valid draft uden live hop | Dækket: `inputCore/editor/fieldEditor.test.ts`, `react/useFieldEditor.test.tsx`, `react/useFormFieldSurface.test.tsx` |
| 2 | Åben fejlende draft, uændret rød markering | Dækket: samme tre + `react/gridAdapter.test.tsx`, `react/fieldShells.test.tsx` |
| 3 | Blur, Enter, klik væk, side-/**fane**navigation | **Hul:** fane-skift settler ikke bevisligt. `MainLayout.navigationCommitGuard.test.tsx` dækker side-skift; `PageTabs.test.tsx` er præsentationel |
| 4 | Escape fra gyldigt, tomt og fejlende udgangspunkt | **Hul:** Escape er dækket, men kun fra ét (gyldigt) udgangspunkt; de tre udgangspunkter er ikke opregnet |
| 5 | Format- vs bounds-fejl, samme gates, forskellige beskeder | Dækket: `inputCore/inputCore.test.ts` §1.6-describe, `document/documentGateMatrix.test.ts` |
| 6 | Tomt required: ingen rød markering, contentbox-fejl, blokering | Dækket: `inputCore.test.ts` §1.7-describe, gate-matrix MISSING-cases |
| 7 | Warning uden blokering | Dækket: gate-matrix "warnings blokerer intet" + fire domænesuiter |
| 8 | Skjul fejlende input; vis gyldigt igen | Dækket: `inputCore.test.ts` §1.9/§3.6-describe, `eoHiddenFieldPersistence.test.ts` |
| 9 | Undo/redo-kæderne §7.2 | Dækket: `inputCore.test.ts` §7.2-describe, `dispatchInput.test.ts`, `inputHistory.test.ts` |
| 10 | F5 med gyldigt, **fejlende** og åben draft | **Hul:** hydration af en gyldig session er dækket; en session med `rejectedInputs` er IKKE, og "åben draft kasseres" er uasserteret |
| 11 | Placeholder-række med første fejlende input **overlever F5** | **Hul:** promoveringen asserteres som ét snapshot, men rehydreres aldrig gennem `initializeInputRuntime` — §10-kriterium 18's F5-ben mangler |
| 12 | Række-delete og undo/redo | Dækket: `inputCore.test.ts`, `dispatchInput.test.ts`, `gridAdapter.test.tsx` §7.2-describe |
| 13 | `.eo`-save/load + gammel tolerant `.eo` | Dækket bredt: `eoFileCodec`, `eoFileSchema`, `fileLoad.normalLoad`, `persistenceLoadSanitization`, `fileRoundTrip.fullState` |
| 14 | Hvert dokumentdomæne og **begge formater** | **Delvist hul:** begge formater er dækket i parity-/filnavn-/generator-suiterne, men `documentGateMatrix.test.ts` pinner `documentDownloadFormat: 'pdf'`. Ingen test svarer generisk på "afhænger nogen gate af format?" |
| 15 | Revisionændring under async dokumentforberedelse | Dækket: `documentLifecycleMatrix.test.ts` (tre stale-faser), `documentGenerationSession.test.ts`, `criticalActionCoordinator.test.ts` |

**Fem huller. Ingen af dem er kosmetiske**, og alle fem ligger på en invariant, planen selv gør
normativ (kriterium 18, 22, 25, 27).

### 0.3 Afgrænsning: gate-matrixen udvides IKKE til alle 21 outputs pr. inputklasse

Et nærliggende femte-hul ville være "gate-matrixen dækker kun 4 af 21 outputs". Det afvises
bevidst. `documentGateMatrix.test.ts:3-19` begrunder eksplicit, at de fire inputklasser er
**per-definition** og ikke kan konstrueras generisk: hvert output har sit eget required-felt, sit
eget bounds-interval og sin egen relevans-sektion. En generisk 21×4-matrix ville derfor skulle
gætte hvert outputs klassificerende felt — og en test, der gætter, beviser intet.

`documentCatalogCompleteness.test.ts` dækker allerede, at alle 21 har præcis én definition og kun
kan aktiveres gennem en lukket `DocumentAction`; per-domæne-gates dækker de enkelte domæner.

**Men FORMAT er ikke per-definition.** Spørgsmålet "må en gate afhænge af det valgte
downloadformat?" har ét normativt svar for alle 21 (nej — formatet vælger writer, ikke dækning), og
det kan derfor testes generisk over hele kataloget. Det er hullet i punkt 14, og det er den form,
rettelsen tager: én format-invarians-test over alle definitioner, ikke 21 kopier af fire cases.

### 0.4 Afleveringsgatens seks betingelser — målt

| Betingelse | Tilstand |
|---|---|
| Alle automatiske gates grønne | Køres i denne WI (typecheck, typecheck:test, lint, test, build:all + mojibake/filename-case/offentlig-loen) |
| Browsermatrixen dokumenteret gennemført | Omdefineres pr. §0.1; leveres som acceptmatrix med navngivne dækningskilder |
| Ledgeren har nul umigrerede entries | **Verificeret grøn** før implementering: `verify:ledgers` → 239 datafelter, 16 collections, 8 beregninger, 4 sagsfilstier, 18 dokumentoutputs, "Inventarvalidator OK", 2 testfiler/16 tests dækket |
| Alle slettelister tomme | Verificeres mod planens fire slettelister (linje 1096, 1198, 1233, 1314) — alle markeret "gennemført" af fase 2-5; kontrolleres maskinelt, ikke på ordet |
| Beregningstal og dokumentindhold uændrede for gyldige fixtures | Dækket af golden-/parity-suiterne; ingen produktionsændring i denne WI, så uændrethed er strukturelt sikret (kontrolleres ved at gaten er grøn UDEN snapshot-opdatering) |
| Ingen §1-produktregel afhænger af timing eller component mount | Dækkes af de nye punkt-3/10/11-tests, der netop kører uden mount, + eksisterende `no-queue-microtask`/`no-promise-tick`-værn |

## Scope

**Inde:**

1. Luk de fem dækningshuller fra §0.2 som automatiserede tests (punkt 3, 4, 10, 11, 14).
2. Etablér acceptmatrixen som en **maskinelt kontrolleret** artefakt: hvert af de 15 punkter bærer
   sin dækningskilde, og kilden skal findes. Samme fejlklasse som WI-012's dødt-værn-detektor —
   en matrix, der peger på en slettet testfil, er grøn af tomhed.
3. Verificér de fire slettelister maskinelt.
4. Kør den fulde afleveringsgate og dokumentér udfaldet.
5. Opdatér planens Fase 7-afsnit til den leverede virkelighed (status, acceptmatrix-omdefinering).

**Bevidst uden for scope:**

- **Ingen produktionskodeændring.** Viser et hul en reel produktionsfejl, standses fasen, og fejlen
  får sin egen WI (planens §9: ved forkert antagelse stoppes cutoveren). Fase 7 er accept, ikke
  reparation.
- Gate-matrix-udvidelse til 21×4 (§0.3, afvist med evidens).
- Genuint visuelle forhold (pixel-layout, fontrendering, PDF-visuel inspektion). De kan ikke
  automatiseres meningsfuldt her og erklæres ikke gennemførte — de listes til brugeren.
- `npm run test:coverage` i stedet for `npm run test`: planens Fase 7-liste kræver `test`.
  Coverage-varianten køres ikke, da den kun ændrer instrumentering, ikke udfald.

## Autoritativt grundlag

- `docs/architecture/draft-commit-greenfield-design.md` §Fase 7 (linje 1770-1818), §10
  acceptkriterier 1-30, §9 rollback-princip.
- `docs/contracts/error-contract.md` (fejlalgebra, §1.1/§11).
- `src/__tests__/document/documentGateMatrix.test.ts:3-19` — normativ begrundelse for, at
  inputklasserne er per-definition (grundlag for §0.3's afvisning).
- `src/__tests__/document/documentCatalogCompleteness.test.ts` — den eksisterende alle-21-liste;
  vært for format-invariansen.
- AGENTS.md (gate-krav, rollefordeling).

## Invarianter (må ikke brydes)

1. **Ingen produktionsadfærd ændres.** Beregningstal, dokumentindhold, persisteret form og UI er
   uændrede. Gaten skal være grøn uden at et golden-snapshot opdateres.
2. Nye tests må ikke svække eksisterende: ingen `it.skip`, ingen opblødte assertions, ingen
   snapshot-regenerering.
3. En dækningsangivelse i acceptmatrixen skal kunne FEJLE. Peger den på en testfil eller et
   testnavn, skal harnesset verificere, at kilden findes.
4. Fejlende og gyldigt input må ikke sammenblandes i hydration-testene: en session med
   `rejectedInputs` skal genopstå med sit issue INTAKT, ikke renset.

## Parallel / duplikeret logik

- **Fund:** dækningen af de 15 punkter ligger spredt over ~30 testfiler i seks mapper. Der findes
  ingen samlet oversigt over, hvad acceptkriterierne dækkes af.
- **Beslutning:** der oprettes ÉN acceptmatrix-artefakt, som *peger på* de eksisterende tests —
  testene flyttes eller duplikeres IKKE. Matrixen er et register, ikke en ny testkopi.
- **Begrundelse:** at samle de 15 punkters assertions i én fil ville duplikere dækning, der
  allerede bor korrekt ved sin egen grænse (jf. AGENTS.md "Konvergens": ensart kun adfærd, der
  faktisk skal være ens). Registret ensarter *sporbarheden*, ikke adfærden.

## Acceptance criteria

- [ ] Punkt 3: fane-skift settler bevisligt en åben draft (ikke kun side-skift).
- [ ] Punkt 4: Escape dækket fra alle tre udgangspunkter — gyldigt, tomt og fejlende afsluttet.
- [ ] Punkt 10: en session med `rejectedInputs` hydreres med sit issue intakt; åben draft
      overlever ikke reload.
- [ ] Punkt 11: placeholder-promoveret fejlende række rehydreres gennem `initializeInputRuntime`
      (§10-kriterium 18 end-to-end).
- [ ] Punkt 14: format-invarians verificeret generisk over alle katalogiserede definitioner.
- [ ] Acceptmatrixen findes, dækker alle 15 punkter, og dens dækningskilder verificeres maskinelt.
- [ ] De fire slettelister verificeret tomme maskinelt.
- [ ] Fuld afleveringsgate grøn: typecheck, typecheck:test, lint, test, build:all,
      check:mojibake, check:filename-case, check:offentlig-loen, verify:ledgers.
- [ ] Planens Fase 7-afsnit opdateret; ingen golden-snapshot ændret.

## Godkendelsesgate

- **Påkrævet:** **nej** — `godkendelse ikke påkrævet`.
- **Begrundelse:** WI'en tilføjer tests og dokumentation. Ingen synlig UI/UX og ingen
  beregningstal/-regler ændres; invariant 1 gør det til et acceptance criterion, at de ikke gør.
  Skulle en test afdække en reel afvigelse i tal eller UI, udløser det §9-stop og forelæggelse —
  det er ikke en del af denne WI's leverance.

## Verifikation

- **Plan:** målrettede kørsler af de berørte suiter efter hver sammenhængende delændring; derefter
  den fulde afleveringsgate i planens rækkefølge.
- **Resultat (2026-07-28):** hele afleveringsgaten GRØN.

| Gate | Udfald |
|---|---|
| `typecheck` | grøn |
| `typecheck:test` | grøn |
| `lint` (`--max-warnings 0`) | grøn |
| `test` | **493 filer / 6172 tests grøn** (baseline 483/6090) — efter review-rettelserne |
| `build:all` | exit 0; begge apps bygget |
| `check:mojibake` | OK (1421 filer) |
| `check:filename-case` | OK |
| `check:offentlig-loen` | OK |
| `verify:ledgers` | OK — 239 datafelter, 16 collections, 8 beregninger, 4 sagsfilstier, 18 dokumentoutputs; **nul umigrerede entries**; kørslen dækkede sine 2 testfiler / 16 tests |

**Ingen golden-/paritets-snapshot er opdateret.** Det er den maskinelle bekræftelse af invariant 1 og
af afleveringsgatens betingelse "beregningstal og dokumentindhold uændrede for gyldige fixtures": var
et tal eller et dokumentindhold flyttet, ville de eksisterende golden-tests være røde, og de er grønne
uden regenerering.

`build:all`s to `INEFFECTIVE_DYNAMIC_IMPORT`-advarsler er **præeksisterende**: målt til samme antal (2)
på et rent `HEAD` via `git stash -u`. De er ikke introduceret her.

### Mutationstest af den nye dækning (fase 6's princip: et værn skal kunne fejle)

Hver ny kontrol er observeret FEJLE, før den blev accepteret:

| Kontrol | Mutation | Udfald |
|---|---|---|
| Fane-settle (punkt 3) | `VarigeMen.tsx`: `onChange={setActiveTab}` → no-op | begge tests fejlede |
| Format-invarians (punkt 14) | `varigeMenDocumentDefinition`: `blocked` når format er `word` | fejlede i BEGGE inputtilstande, inkl. `ready`(pdf) vs `blocked`(word) |
| Acceptmatrix | indbygget modsat-retnings-case (`it`-navn der beviseligt ikke findes) | grøn = prædikatet kan skelne |
| Sletteliste | indbygget modsat-retnings-case (fil der findes / findes ikke) | grøn = prædikatet kan skelne |
| Allowlist-anti-rot | fjernet `utils/dateUtils.ts` fra `NEW_DATE_ALLOWLIST` | guarden fejlede → listen er load-bearing, ikke dekoration |

## 5. Egne fund under verifikationen (fundet AF den nye dækning, ikke af reviewet)

Fasen er accept, ikke reparation — men to fund kom fra de kontroller, WI'en netop indførte. Begge er
**værn-/oprydningsfund uden produktionsadfærd**, og de ligger derfor i scope (planens fase 6 trin 1
pålægger eksplicit fase 7 at verificere, at "ingen midlertidig fysisk rest består").

### F1 — tom rest fra trin 13: `src/components/inputs/table/`

Slettelisten for trin 13 opfører `components/inputs/table/`. Mappen fandtes stadig — **tom**. Git
sporer ikke tomme mapper, så hverken `git status`, AST-værnene eller den fulde suite kunne se den:
`legacy/forbidden-identifier` og `input/deleted-legacy-architecture-import` måler identifiers og
imports, dvs. om noget BRUGER en mekanisme, ikke om filen findes. Det er præcis det hul, den nye
`deletionLedger.test.ts` blev skrevet til.

**Disposition:** mappen fjernet (`rmdir`; den var tom og utracked, så ingen produktionskode ændredes).
**Rod:** lokal — én rest, ikke et mønster. Fysisk-fravær-kontrollen er nu permanent.

### F2 — fem døde allowlist-poster i `roundingNormGuard.test.ts` (strukturel rod)

Sporet fra F1: to testfiler refererede stier inde i den slettede mappe. Den ene
(`architecture/rules/storageRules.ts`) er en **absence**-liste, hvor en slettet sti er korrekt efter
design — den forbyder genindførelse. Den anden var en **allowlist**, og der er en død post ikke
harmløs: opstår en fil senere på samme sti, er den undtaget fra dag ét, uden at nogen har besluttet det.

Fem døde poster fundet: `components/inputs/table/TableAmountInput.tsx`,
`components/inputs/table/TablePercentInput.tsx`, `components/inputs/StyledPercentField.tsx` (alle
slettet i trin 13) samt `document/generators/renteberegning/rentePdf.ts` og
`document/generators/aarsloen/shDagePdf.ts` (omdøbt i Fase 5 til `renteDocument.ts`/`shDageDocument.ts`
— efterfølgerne bruger slet ikke `new Date(`, så undtagelsen skal ikke følge med navnet).

**Rod: STRUKTUREL,** samme fejlklasse som WI-012's `COMMIT_SENSITIVE_PREFIXES` (scan-rødder der ikke
fandtes). Rettelsen er derfor ikke kun at slette de fem poster, men at gøre forfaldet umuligt:

1. To allowlists levede inline i deres `it(...)` og kunne slet ikke kontrolleres udefra — de er hoistet
   til `NEW_DATE_ALLOWLIST` og `TO_ISO_STRING_SLICE_ALLOWLIST`. (Det var netop den inline-placering, der
   lod `StyledDateField.tsx` overleve sin fil.)
2. En generisk anti-rot-test kræver, at HVER post i alle fem allowlists peger på en fil, der findes i
   produktions-kildegrafen — plus en modsat-retnings-case, så kontrollen ikke kan bestå vakuøst.

**Verificeret load-bearing:** guarden fejler fortsat, når en levende post fjernes (se mutationstabellen)
— oprydningen svækkede ikke normen, den fjernede kun undtagelser for filer, der ikke eksisterer.

## Review-fund (Codex sol/medium, 2026-07-28)

Fem fund, alle handlingskrævende. **Fire bekræftet og rettet; ét delvist afvist med evidens.**
Reviewets samlede kritik — "kontroller, der kan blive falsk grønne" — var berettiget på tre punkter,
og den rammer samme rod som fase 6's genåbning: **et bevis, hvis eneste egenskab er at bestå, er ikke
et bevis.**

| # | Fund og evidens | Alvor | Rod (Codex → min vurdering) | Disposition | Status |
|---|---|---|---|---|---|
| R1 | `acceptanceMatrix.test.ts:340` brugte `content.includes(navn)`. Beviser kun at teksten optræder ET STED i filen — ikke at en AKTIV `it(...)` findes. Punkt 14 citerede `'pdf'` (matcher et importnavn); punkt 3 citerede `'KLIK'` (matcher en describe om to-trins-ÅBNING, ikke om at klikke væk) | Høj | strukturel → **accepteret** | **Rettet.** Registret parser nu aktive `it`/`test`/`describe`-deklarationer og udelukker `.skip`/`.todo`/`.failing`; navne matches mod de PARSEDE navne, ikke mod råtekst. Otte løse referencer (`pdf`, `KLIK`, `warning`, `round`, `settle`, `undo`, `Escape fortryder`, `persistedDataVersion`) er erstattet af fulde testnavne. To nye selvtests: parseren afviser en skippet test, og den genkender et navn der findes | bekræftet |
| R2 | `VarigeMen.tabNavigationSettle.test.tsx`: `user.click` blurrer inputtet FØR tabens `onChange`, så testen kan bestå alene via den allerede dækkede blur-sti; den beviser ikke, at et faneskift uden fokussekvens settler før unmount | Høj | strukturel (`PageTabs` skifter state uden commit-guard) → **diagnose accepteret, KONKLUSION AFVIST** | **Delvist afvist med evidens.** Diagnosen er rigtig og verificeret: mutation af `useFormFieldSurface.onBlur` (blur settler ikke) gør BEGGE tests røde, mens fanen fortsat skifter — testen går altså gennem blur. Men konklusionen ("produktionssiden vil kassere draften") holder ikke: der findes ingen produktionssti, der skifter fane med en uafsluttet draft. Fane-skift sker enten (a) ved brugerklik på `<Tab>`, som ALTID blurrer først, eller (b) programmatisk via `setActiveTabForPage` fra kun to callsites — `saveBlockedFocus` (kaldt fra `useFileSaveLoad.ts:235` EFTER `criticalActions.prepare('save')`, som settler) og `useEoBeregningViewModel:299` (fra et klik på et issue-link, som selv blurrer). Blur ER §1.3's settle-sti, så testen måler den rigtige grænse; en test der undertrykker blur, ville måle en tilstand produktionen ikke kan nå. **Resonnementet er skrevet ind i testen, så antagelsen er eksplicit og kan anfægtes igen** | afvist m. evidens |
| R3 | `documentGateFormatInvariance.test.ts`: kun to fælles inputtilstande; en formatafhængighed i en READY-gren ville ikke fanges | Høj | strukturel → **accepteret** | **Bekræftet ved måling** (instrumenteret kørsel): 34 af 36 projektioner er `blocked`, kun 2 `ready`. Rettet i scope: testen MÅLER nu sin egen ready-dækning og fejler, hvis den falder under 2; begrænsningen er dokumenteret i filen frem for skjult. Den fulde lukning — at fjerne `documentDownloadFormat` fra projektionskonteksten, så afhængigheden bliver umulig frem for testet — er en PRODUKTIONSændring uden for Fase 7's accept-scope (invariant 1) → **WI-014** | bekræftet |
| R4 | `dispatchInput.test.ts:672` hed "en åben draft overlever IKKE reload", men åbnede ingen editor og kaldte ikke `initializeInputRuntime` — navnet påstod mere end assertionen bar | Middel | lokal → **accepteret som lokal** | **Rettet.** Testen er omdøbt til det den faktisk måler (envelopen har kun to afsluttede kanaler). Den ADFÆRDSMÆSSIGE halvdel ligger nu i ny `react/openDraftNotPersisted.test.tsx`: en rigtig editor åbnes, draften ændres UDEN settle, en frisk store hydreres fra den ægte sessionStorage-envelope, og draftteksten må hverken findes canonical eller som rejected. To cases (gyldig og fejlende draft) | bekræftet |
| R5 | `deletionLedger.test.ts` manglede de otte `Styled*Field.tsx`; de kunne genopstå fysisk, mens testen erklærede slettelisterne tomme | Middel | strukturel (duplikerede, manuelt kopierede slettelsesinventarer) → **accepteret, og anbefalingen om ét fælles manifest FULGT** | **Rettet strukturelt.** Ledgeren læser nu `LEGACY_MODULE_PATH_SELFTEST.paths` fra `architecture/rules/storageRules.ts` — arkitekturværnets autoritative liste — frem for en håndkopi. De to kontroller er komplementære (værnet måler IMPORTER, ledgeren FYSISK eksistens) og deler nu kilde, så en fremtidig tilføjelse ét sted dækkes af begge. Plus en vakuøsitets-guard (manifestet må ikke tømmes) og eksplicit assertion på alle otte `Styled*Field`. Mutationstestet: en genindført `StyledPercentField.tsx` gør testen rød | bekræftet |

### Re-review af rettelserne (Codex sol/medium, 2026-07-28)

Fokuseret re-review bekræftede **R2, R4 og R5 som tilstrækkeligt lukket** og fandt tre nye fund. Alle
tre er accepteret; to var reelle falsk-grøn-huller i MIN egen rettelse af R1.

| # | Fund og evidens | Alvor | Rod | Disposition | Status |
|---|---|---|---|---|---|
| R6 | R1's rettelse var stadig falsk-grøn. Regexen læste RÅTEKST med et LINJE-lokalt skip-filter, så (a) `describe.skip('s', () => { it('navn') })` medtog den indlejrede test — skip arves ned gennem hierarkiet, og et linjefilter kan per konstruktion ikke se det — og (b) `// it('navn')` i en kommentar blev talt som en levende deklaration. **Verificeret ved probe før rettelsen: begge slap igennem** | Høj | strukturel: jeg målte tekst, hvor spørgsmålet er strukturelt → **accepteret** | **Rettet.** Regexen er erstattet af en ægte TypeScript-AST-walk: kommentarer og strengliteraler er ikke kald, og skip-tilstanden NEDARVES eksplicit gennem callback-kroppen. Håndterer også template-literal-navne (`` `${id}: …` ``), hvor de statiske dele er evidens. Selvtesten dækker nu alle svære former: arvet skip, aktiv suite der IKKE smitter, kommentar, strengliteral, `skipIf` vs `runIf`, `each`/`only`, og skippet dynamisk navn. **Mutationstestet på den rigtige mekanisme:** `describe.skip` på en ancestor gør registret rødt for punkt 1 | bekræftet |
| R7 | Punkt 3's "klik væk"-ben citerede en ESCAPE-test. Escape er §1.3's MODSATTE regel ("lukker uden at udstede en command") — en test, der beviser at intet committes, kan ikke bære et punkt om, at noget committes. Ingen test klikkede faktisk uden for feltet (blur-testen kalder `onBlur` direkte) | Middel | lokal semantisk fejl i registret → **accepteret som lokal** | **Rettet.** Ny `VarigeMen.clickAwaySettle.test.tsx`: klikker på et RIGTIGT element uden for feltet (sidens titel — ikke en fane, ikke et andet input, så hverken fane-skift eller en anden editors åbning kan forklare settlet) i den ægte side med den ægte runtime. To cases: gyldig og fejlende draft. Registret citerer nu den | bekræftet |
| R8 | Punkt 14 måtte ikke fremstå lukket, når 16 af 18 ready-grene er uprøvede; ready-gulvet på 2 forhindrer kun, at dækningen FALDER | Middel | strukturel, samme rod som R3 → **accepteret** | **Rettet i registret.** `AcceptancePoint` har nu et `knownLimitation`-felt, og punkt 14 bærer sin begrænsning eksplicit med henvisning til WI-014. En ny test kræver, at den nævnte WI-fil FINDES — ellers kunne et hul dokumenteres væk med en henvisning til en opfølgning, ingen har oprettet — og at punkt 14 er den ENESTE post med en begrænsning, så en ny (eller en lukket) bliver synlig. **Fase 7 lukkes altså med punkt 14 eksplicit noteret som delvist dækket**, ikke som fuldt dækket | bekræftet |

### Lære på tværs af R1, R3 og R4

De tre deler rod: **jeg byggede kontroller, hvis styrke jeg ikke selv målte.** R1 antog at en
substring var et bevis, R3 at to inputtilstande var repræsentative, R4 at et testnavn beskrev sin
assertion. Mutationstestene, jeg kørte, var for svage til at afsløre det — fx fejlede tab-mutationen
af den trivielle grund, at fanen ikke skiftede, frem for af den grund testen skulle bevise.
Konsekvens fremadrettet: **en mutation skal ramme den MEKANISME, testen påstår at måle**, ikke blot
gøre testen rød.

R6 bekræftede læren på den ubehagelige måde: min FØRSTE rettelse af R1 gentog fejlen i ny form — jeg
erstattede en tekstsøgning med en anden tekstsøgning og kaldte det parsing. Det er nøjagtigt samme
fejlklasse, som fase 6 blev genåbnet på ("klassificér efter tekstsøgning frem for efter den normative
model"). Reglen er nu konkret: **er spørgsmålet strukturelt — hierarki, arv, hvad der er kode kontra
kommentar — så er svaret et AST, ikke en regex.**

## Resterende / risici

- **WI-014 (oprettet):** fjern `documentDownloadFormat` fra `DocumentSourceContext.settings`, så en
  dokumentgate strukturelt ikke KAN afhænge af outputformatet. Fase 7's format-invarianstest bliver da
  et sikkerhedsnet frem for den primære grænse — jf. [[project_typed_write_boundary_over_ast_guard]]:
  kan capabilityen fjernes, så fjern den.
- **Genuint visuelle forhold er ikke verificeret** og erklæres ikke gennemførte: pixel-layout,
  fontrendering og visuel inspektion af de færdige PDF-/Word-filer. De kan ikke automatiseres
  meningsfuldt her. DokumentINDHOLD er derimod dækket af golden-/paritetstestene.
- Ready-dækningen i format-invariansen er 2 af 18. Gulvet er asserteret, men lav dækning i
  ready-grenen består, indtil WI-014 gør spørgsmålet irrelevant.
