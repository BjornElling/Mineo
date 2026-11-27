# Fund – gruppe G2a

Dokument: `src/contracts/eo-snapshot-contract.md` (EOS). Efterprøvet afsnit for afsnit mod koden, rettet og stemplet
2026-11-27. De øvrige G2-kontrakter (G2b) er ikke rørt.

De to kendte drift-kandidater er bekræftet og rettet (koden har ret):
- EOS §2.2 «Ferieperioder»: en ferie-dato før skade-/anmeldelsesdatoen, før 01-01-2005, efter dags dato eller
  på/efter en TAF-afskæring er en rød, blokerende celle (`collectFerieperiodeBoundIssues` i `tafRowCellIssues.ts`),
  også uden TAF-rækker. Teksten «lægges ukritisk til grund» er erstattet.
- «udviklerbeslutning 1/2 (2026-07-25)» (§3.3): kildedokumentet er slettet; reglerne står nu som nutidige
  afgørelser. Rettet mod koden: `withForligGate` neutraliserer flere forligsafhængige felter end de fire nævnte, og
  Beregning-fanen falder kun tilbage til `readyBranches.tafPerioder`.

2011-reglen: skrevet som «skade-/anmeldelsesdato» i §2.2, §2.3 pkt. 2 og §6.2 pkt. 2 (koden læser
`stamdata.skadedato`, som ved erhvervssygdom er anmeldelsesdatoen).

Øvrige rettelser mod koden: §1 (`computeEoSnapshot` tager værdier fra `buildErstatningsopgoerelseReaderProjection`,
ikke en «readyInputProjection»); §2.2 bounds-listerne (fra-dato på/efter afskæring, til-dato efter dags dato,
svie/smerte efter dags dato, EET-dato = virkningsdato ellers afgørelsesdato, «ikke påklaget» = `!== 'Ja'`, mén kun
ved `verserendeKlageMen = 'Nej'`, ferie-overlap, komponentnavnet `TafPeriodeTable`); §2.3 dobbelt «6.» omnummereret;
§2.4 svie/smerte-motoren i fejlstien er forligs-gatet; §3.1 BB-258-historik fjernet, 0 kr.-løn er en descriptor-
grænse; §3.4 `buildZeroOutput` findes kun i svie/smerte-motoren; §5 `snapshot.sourceToken` findes ikke (snapshottets
`revision` afledes af reader-projektionens `sourceToken`); §6.1 teststier rettet, indgang 1 (overlap) beskriver nu,
at overlappet kun blokerer TAF-grenen og beregningsperioden får tal på begge sider; §7 kun totals normaliserer til 0,
canonical output er `null` og dokumentet udelader afsnittet; §10 citatet bruger bindestreg som koden; §11 aliaserne
er ikke versionsbundne, og to yderligere udgåede nøgler fjernes; §13 bilaget hedder «Midlertidigt EET»,
`buildTafIndtaegterModel`/`tafPerYearDerived` rettet til `buildTafIndtaegterBeregning`/`buildTafPerYearBuildOutcome`;
§14 komprimeringstogglen vises altid ved aktiv TAF (virker først fra 2. opgørelse), `tidligereModtagetTaf`
neutraliseres ved inaktiv TAF; §16 kræver også satser for det foreslåede år. Al dato-/ID-proveniens
(«2026-10-30 (BB-187)», «BB-320», «42.790/42.791-fejlen», «brugerfund 2026-09-17» osv.) er fjernet.

G2b's fire gentagelser er erstattet af henvisninger: §1 → `snapshot-contract.md` §2–§3; §5 → SC §10 (det
EO-specifikke bevaret); §3.3 første afsnit → SC §2 pkt. 4; §13 portegenskaberne (`MoneyOre`, manglende/ugyldig
context som blokerende issue, «ingen relevante rækker» ≠ «context mangler») → `eet-snapshot-contract.md` §5.

## (a) Behandlede rapportpunkter

- udtraek-1/A2: indarbejdet i EOS §8 pkt. 3 (nulopgørelse).
- udtraek-1/A3: indarbejdet i EOS §8 pkt. 4 (fladerne viser ingen beløb); sammendragets tekster overladt til
  `error-contract.md` §9 (G3), jf. udtraek-3/A14.
- udtraek-1/A5: indarbejdet i EOS §17 («0 er tomt», ordbrug).
- udtraek-1/A7: forkastet for EOS – dækket i `input-field-behavior-contract.md` §4.16 (G1).
- udtraek-1/A10: indarbejdet i EOS §14 (feltet er kun relevant ved ansat og opsagt; før skadedato er rødt).
  Udtrækkene 1/A10 og 3/A39 modsiger hinanden; koden: rød kun når feltet er relevant (ansat på skadestidspunktet).
- udtraek-1/A15 (overladt fra G2b): indarbejdet i EOS §15 «Manuel lønudvikling».
- udtraek-1/A18: indarbejdet i EOS §6.1 (rød kontekstdato bevarer afledte visninger).
- udtraek-1/A20: indarbejdet i EOS §14.
- udtraek-1/A23: indarbejdet i EOS §6.3 (én definition af «tom»).
- udtraek-1/A24: BB-426 indarbejdet i EOS §2.2 (dækningsadvarsler venter); BB-431 i EOS §14; BB-429 i EOS §2.2
  (ferierække uden til-dato); BB-432 (dagsløn under 100 kr.) overladt til `docs/domain/taf/tabt-arbejdsfortjeneste.md` (G7).
- udtraek-1/A25: «TAF-perioder viser første og sidste dato» indarbejdet i EOS §6.2 pkt. 3; huller mellem TAF-rækker
  overladt til `tabt-arbejdsfortjeneste.md` (G7).
- udtraek-1/A29 (overladt fra G1): BB-457 (kildeskiftets bekræftelse) indarbejdet i EOS §13 «Single source of
  truth»; BB-460 (korte udsving i grafen) indarbejdet i EOS §1.1. BB-453 overladt til
  `docs/domain/sygeferiegodtgoerelse/sygeferiegodtgoerelse.md` (G7); BB-461 («Der er ingen indtægter at vise i
  grafen») overladt til `document-output-contract.md` (G3).
- udtraek-1/A30: indarbejdet i EOS §6.3.
- udtraek-1/A64 (også overladt fra G2b): efterprøvet; §13 dækker kun-errors-stopper og BB-358-advarslen (nu med
  ordret tekst). Tom virkningsdato = afgørelsesdato indarbejdet i EOS §2.2 (afskæringsdatoerne); for EET-siden
  overladt til `eet-snapshot-contract.md` (G2b, udtraek-4/A32).
- udtraek-1/A66: forkastet for EOS – dækket i `input-field-behavior-contract.md` §6 (G1).
- udtraek-1/A68: TAF-dokumenternes uafhængighed af S/S m.m. er allerede i EOS §13 (`erTafUafhaengigEoFejl`); de
  øvrige fire delpunkter overladt til `document-output-contract.md`/`aarsloen-contract.md` (G3/G5).
- udtraek-2/A4: forkastet for EOS – EOS beskriver ikke indtægtsrækkernes dubletregel; hører til
  `aarsloen-contract.md` (G5) og `tabt-arbejdsfortjeneste.md` (G7). EOS §2.3 pkt. 5a nævner kun, at indtægtsrækker
  må overlappe.
- udtraek-3/A2: indarbejdet i EOS §14 «Bevidst undtagelse». Rettet mod koden: togglen vises også ved 1. opgørelse
  (når TAF er aktiv); den virker først fra 2. Udtrækkets «vises først fra 2. opgørelse» er en fejlfortolkning –
  BB-203's afgørelse handler om standardværdien og skjulningen.
- udtraek-3/A8: indarbejdet i EOS §8 pkt. 3.
- udtraek-3/A11: indarbejdet i EOS §17. Takstlinjen ved forlig overladt til `document-output-contract.md` (G3);
  koden skriver «Taksten udgør 50 % af (…, dog højst …), svarende til …, dog højst …», ikke udtrækkets kortform.
  Ophørsgrunden i EO-kontrol (NY-12b-1) er dækket af EOS §6.2 pkt. 2.
- udtraek-3/A12: indarbejdet i EOS §17.
- udtraek-3/A13: indarbejdet i EOS §17.
- udtraek-3/A14: «fladerne viser ingen beløb» i EOS §8 pkt. 4; sammendragets tekster overladt til
  `error-contract.md` §9 (G3) – alle findes ordret i `eoBeregningSummaryTexts.ts`/`useEoBeregningViewModel.ts`.
- udtraek-3/A15: indarbejdet i EOS §2.2 (afskæringstekster).
- udtraek-3/A22: BB-425 indarbejdet i EOS §6.2 pkt. 2; BB-426 i EOS §2.2.
- udtraek-3/A23: indarbejdet i EOS §2.2 (ferieperioder).
- udtraek-3/A24: indarbejdet i EOS §7.
- udtraek-3/A27: indarbejdet i EOS §2.2.
- udtraek-3/A29: indarbejdet i EOS §14.
- udtraek-3/A31: indarbejdet i EOS §2.3 pkt. 5a.
- udtraek-3/A32: indarbejdet i EOS §6.1 (rød kontekstdato) og indgang 1 (22/22 ved overlap). Rettet: værdierne står i
  Kontroltabellens sammentælling og som `-`, ikke `–`.
- udtraek-3/A33: indarbejdet i EOS §14. BB-433 (en fejl i periodens slutdato rydder ikke en anden ferieindtastning)
  kunne ikke genfindes som selvstændig regel; den følger af §14 «Læsegrænsen» (kun et skjult felt ryddes).
- udtraek-3/A36 (overladt fra G1): indarbejdet i EOS §14.
- udtraek-3/A39: indarbejdet i EOS §14 (se udtraek-1/A10).
- udtraek-3/C1: 2011-reglen skrevet som «skade-/anmeldelsesdato» (se indledningen).
- udtraek-4/A10: indarbejdet i EOS §14.
- udtraek-4/A11: indarbejdet i EOS §15 «Manuel lønudvikling» (ordrette tekster).
- udtraek-4/A12 (også overladt fra G2b): indarbejdet i EOS §15. Se (c) 4.
- udtraek-4/A13: indarbejdet i EOS §15.
- udtraek-4/A14 (overladt fra G1 og G2b): indarbejdet i EOS §15; pladsholderens form står i IFB.
- udtraek-4/A18: indarbejdet i EOS §14.
- udtraek-4/A21: indarbejdet i EOS §15 (`buildLoenGrundlagSaetning`).
- udtraek-4/A28: indarbejdet i EOS §14.
- udtraek-4/A31: indarbejdet i EOS §13 «PDF-bilag».
- udtraek-4/A33: indarbejdet i EOS §13 (to gule linjer, valg A, inaktivt bilagsvalg, kildeskiftets tekst).
- udtraek-4/A36: overladt til `error-contract.md` §9 (G3) sammen med sammendragets øvrige tekster.
- udtraek-4/A37: indarbejdet i EOS §6.3 (ny). Præciseret: kun grupper uden rækker udelades.
- udtraek-4/A38: indarbejdet i EOS §6.3 (sidste punkt); dokumentsiden overladt til `document-output-contract.md` (G3).
- udtraek-4/B4: indarbejdet i EOS §6.
- udtraek-4/B6: indarbejdet i EOS §6.1.
- udtraek-5/A18: overladt til `document-output-contract.md` (G3) – EOS beskriver ikke stamdata-gaten.
- udtraek-5/B6: indarbejdet i EOS §6.
- udtraek-6/A10: indarbejdet i EOS §6.
- udtraek-6/A14: indarbejdet i EOS §17.
- udtraek-6/A18 (også overladt fra G2b): forkastet – koden har ingen sådan validator. Under beregningsperiode
  resolveres hvert ansættelsesforhold for sig (`buildPerAnsaettelseModel`); `assertUniform` i `overenskomstForm.ts`
  sammenligner aldrig på tværs, og forskellige valg vises som «Flere reguleringstyper».
- udtraek-6/A19: forkastet – overhalet. Statistiksegmenter før basisdatoen nedreguleres med indeksforholdet
  (`statistikForm.ts`); reglen står i `tabt-arbejdsfortjeneste.md` «Regulering før lønnens reguleringsdato».
- udtraek-6/A20: indarbejdet i EOS §15 «Reguleringsforløb pr. ansættelsesforhold».
- udtraek-6/A24: overladt til `docs/architecture/eo-row-evaluation-architecture.md` (G6) – rækkeevalueringsregler.
- udtraek-7/A5 og C1: ikke indarbejdet; se (b) 1.
- udtraek-7/A11: «(reduceret til max)» og modtaget 0 indarbejdet i EOS §17; anciennitetssats 0 i bilaget «Regulering»
  overladt til `tabt-arbejdsfortjeneste.md` (G7).
- udtraek-7/A12 (også overladt fra G2b): indarbejdet i EOS §10 pkt. 5.
- udtraek-7/A13: indarbejdet i EOS §1.1.
- udtraek-7/A14: indarbejdet i EOS §1.1.

Ikke indarbejdet (jf. README §3): den gamle afvisning af «Handlingen kan ikke fortrydes».

## (b) Konflikter kode ↔ udviklerafgørelse (forelægges)

1. **Kontrolfanerne findes stadig, selv om udvikleren har besluttet at afvikle dem.**
   - I dag: med «Vis kontrolfaner på Erstatningsopgørelse-side» slået til ser brugeren fanerne «EO-kontrol» og
     «Kontroltabel» med sammentælling, og en uoverensstemmelse melder «Teknisk fejl registreret». CSV hentes på
     Kontroltabel med «Download tabel (CSV-format)» som `{journalnr} - Kontroltabel.csv`.
   - Afgørelsen (`docs/review/kontrolfaner-vurdering-2026-11-24.md` «Afgørelser», nyere end EOS §6.2's
     2026-10-30): begge faner afvikles; dagsgrundlaget bevares som en særskilt CSV-download på Beregning
     («Download dagsgrundlag som CSV-udtræk», `{journalnr} - Dagsgrundlag.csv`) bygget som ren snapshotprojektion;
     ingen facitsager og ingen uafhængig referenceberegning. Rækkefølgen står i udtraek-7/C1.
   - Filer: `src/domain/eoInspektion/`, `src/domain/erstatningsopgoerelse/control/`, `EOKontrolTabel.tsx`,
     `EOInspektion.tsx`, `showEOInspektionMenu`, `inspektionSnapshot`, target `'inspektion'`,
     `control:sammentaelling_mismatch`.
   - EOS §6–§6.3 beskriver fanerne, som de er i dag. Anbefaling: gennemfør afviklingen som et selvstændigt
     arbejdsstykke (den rører beregningskontrol, indstillinger og load af gamle indstillinger) og omskriv da EOS §6;
     indtil da er kontrakten sand.

## (c) Uafklarede tvivlstilfælde

1. **Forsvinder reguleringsforløbet ved et ugyldigt svie/smerte-satsår?** EOS §3.3 sagde (afgørelse 2026-07-25), at
   et ugyldigt satsår ikke må fjerne «den gyldige TAF-visning eller reguleringsforløbet». EOS §2.4 (også markeret
   som udviklerens afgørelse) og koden (`eoSnapshot.ts`, «BEVIDST UDELADT») fail-closer reguleringsforløbet i
   validerings-fejl-stien, som enhver rød feltfejl udløser. Brugeren ser i dag: med et rødt satsår viser
   EO-kontrols reguleringsafsnit pladsholdere; Beregning-fanen viser fortsat TAF-perioderne. EOS §3.3 henviser nu
   til §2.4 (koden og den senest redigerede formulering). Anbefaling: bekræft §2.4.
2. **Kontroltabellens markør ved to afskæringer samme dag.** Kontroltabellens TAF-dagskolonne (`resolveTafAfskaering`)
   foretrækker «Endeligt EET» før «Midlertidigt EET» før «Differencekrav»; dokumentet og EO-kontrol
   (`vaelgTafOphoersgrund`) foretrækker differencekrav først. Falder differencekravet og det endelige EET på samme
   dag, står der «Endeligt EET» i tabellen og differencekravet i dokumentet. Antallet af TAF-dage er det samme.
   Anbefaling: lad `resolveTafAfskaering` bruge `vaelgTafOphoersgrund` (intern rettelse; ændrer kun markørteksten i
   kontroltabellen) – eller lad den stå, da fanerne skal afvikles ((b) 1).
3. **Lokal overlapsulighed.** `validation/eoIncomeRowWarnings.ts:57` har sin egen `fra <= range.til && range.fra
   <= til` i stedet for `utils/closedDateRange`. Den bruges kun til at klassificere advarsler, men er netop den
   lokale kopi, EOS §2.3 pkt. 5a kalder en arkitekturfejl. Intet synligt for brugeren. Anbefaling: brug
   `closedDateRange` (intern rettelse).
4. **«Manuelt angivet» uden reguleringsrækker spærrer bevidst ikke** (afgørelse: vejen til Store Bededagstillæg på
   uændret løn), men intet i koden siger, at det er bevidst. Anbefaling: en kort kommentar ved reglen i
   `eoManualRegulationIssue.ts`/`manualRegulationIssues.ts`, så den ikke «rettes» senere.
5. **Satsreferencen ved rød slutdato på beregningsperioden** (EOS §6.1) har ingen test; mekanismen er
   `createTrackedInputReader(…, { includeContextIssues: true })`. De øvrige tre delregler er dækket af
   `e2e/erstatningsopgoerelse-tidligere-filer.spec.ts`. Anbefaling: tilføj en test.
6. **Forældet kodekommentar** i `src/domain/eoInspektion/eoInspektionSammentaelling.ts` (ca. l. 579, «to perioder
   der deler en dag») beskriver den tidligere overlapsgate; til kommentaroprydningen.

## Afslutning (hovedagenten, 2026-11-27)

Alle punkter i (b) og (c) er lukket i arbejdsstykke 3:
- b1: forelagt; udvikleren valgte «skriv ind, udfør efter 1.0». Afgørelsen og rækkefølgen står i EOS §6 «Besluttet
  afvikling»; afviklingen er et selvstændigt arbejdsstykke efter oprydningen.
- c1, c2: bortfalder ved afviklingen (fanernes egne visninger); EOS §6 siger, at fanernes skønhedsfejl ikke rettes.
- c3: `eoIncomeRowWarnings.ts` bruger nu `rangesOverlap` fra `utils/closedDateRange`.
- c4: kommentar ved `resolveUdloebWarning` i `manualRegulationIssues.ts` med henvisning til EOS §15.
- c5: test tilføjet i `ansaettelsesforholdSatserOgDatoer.test.ts` («er rød, og satsreferencen følger den røde
  slutdato»); EOS §6.1 henviser.
- c6: kommentaren i `eoInspektionSammentaelling.ts` rettet.
