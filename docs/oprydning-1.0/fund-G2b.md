# Fund – gruppe G2b

Dokumenter: `eet-snapshot-contract.md` (EET), `forsoergertab-snapshot-contract.md` (FT), `snapshot-contract.md` (SC),
`indskudte-loentillaeg-contract.md` (ILT), `feriepenge-begreber-contract.md` (FB). Alle fem er efterprøvet afsnit for
afsnit, rettet og stemplet 2026-11-27. `eo-snapshot-contract.md` er ikke rørt.

Rettet mod koden (koden har ret):
- SC §5: EO bruger ikke projektionsformen, men en status-/invariantform (`status`, `invariants`, `blockedDependencies`,
  `readyBranches`). Afsnittet beskriver nu tre former.
- SC §2: reglen om afhængighedsspecifik blokering og fallback-afhængigheder (fælles for EO, EET og FT) har fået sit
  ene hjem her; EET og FT henviser.
- EET §2: kapitaliseringsfanen afhænger ikke af beregningsdatoen; EET efter EAL blokeres kun af de ASL-kolonner, der kan
  ændre afgørelsesvalget, og kun når EAL-procenten er tom (`aslAfgoerelserIssuesForEal`).
- EET §4: 0 i ASL-tabellens «EET %» melder «Erhvervsevnetabet skal være mellem 5 og 100» (feltets bounds), ikke
  rækkereglens «må ikke være 0 %».
- FT §1/§3/§4: snapshottet har ikke længere felt-UI-projektioner for alle felter, kun kønsfeltets tilstand, grænser,
  domæne-`FieldIssue`s og EAL-oplysningen; gaten er fail-closed for ethvert `error`-issue undtagen de rene mangler, og
  en udfyldt, men afvist ASL-del blokerer som ugyldigt input. Linket til Stamdata vises kun ved tom/ugyldig værdi.
- ILT §2a pkt. 1: togglen findes også på Årsløn i Overenskomst-tilstand (tre flader, ikke to); alle afgør valget med
  `harValgtStoreBededagstillaeg`. ILT §2 pkt. 4: beregningen bruger konstanterne, ikke satstrappeopslaget.
- ILT §6: påstanden om en eksisterende implementeringsplan for særligt ferietillæg er fjernet (se (c) 1).
- FB §3: feltnavn, skillelinje og grænser ejes af `feriePctYdelse.ts`, kravet af `feriePctKrav.ts`.
- Historik fjernet: datoer i overskrifter og stempler, `BB-`/`M-`-ID'er, «afklaringslog 9b», «tidligere … havde»,
  «længere», risikolinjen i FB §5. Gentagelser mellem EET/FT og SC (parallelle beregninger, runtimefejl,
  issue-persistens, dokumentgaten) er erstattet af henvisninger til SC. EET §5 og `eo-snapshot-contract.md` §13 er
  delt: EET ejer importportens egenskaber, EO ejer forbruget (togglen, afgrænsningen, beregningsdatoen, issues).

Note til G7: `udtraek-2` A29's påstand om, at EET efter EAL lader en afgørelse efter beregningsdatoen bære kravet, er
forældet – motoren filtrerer på beregningsdatoen (`filterAslRowsKnownAtBeregningsdato`), og
`docs/domain/eet/eal-beregning.md` (punkt 0) siger det rigtige. Ingen modstrid mellem mine kontrakter og
domænedokumenterne ud over den kendte `forsoergertab-beregning.md` §5.3 (udtraek-2 A1).

## (a) Behandlede rapportpunkter

- udtraek-1/A37: indarbejdet i EET §4.3.
- udtraek-1/A38: indarbejdet i EET §4.3.
- udtraek-1/A39: indarbejdet i EET §4 («EET-procenter», ingen lovmæssighedshale) for EET-advarslerne; en generel
  regel hører til `error-contract.md` (G3).
- udtraek-1/A41: indarbejdet i EET §4 («EET-procenter»).
- udtraek-1/A43: indarbejdet i EET §4 («EET-procenter», 0 i de to felter) og §4.4 («Køn», «Bemærk»-boksen). Fanens
  manglende «Fejl og advarsler» og fulde feltnavne i fejlbeskeder hører til `error-contract.md` (G3).
- udtraek-1/A44: dubletdelen indarbejdet i EET §4 («Rækkeissues»); efterprøvet: `validateDuplicateAfgoerelse` markerer
  begge rækker på afgørelses- og virkningsdato, uafhængigt af sortering. Dropdown-delen tog G1.
- udtraek-1/A45: indarbejdet i EET §4 («Kapitalisering tæt på folkepension», beskedernes ordlyd).
- udtraek-1/A46: indarbejdet i EET §2 («Hver fanes afhængigheder»).
- udtraek-1/A47: indarbejdet i FT §4B.
- udtraek-1/A15: overladt til `eo-snapshot-contract.md` §15 (manuelle reguleringstabeller udfyldes ikke automatisk);
  FB regulerer kun ord og satsregler.
- udtraek-1/A64: overladt til `eo-snapshot-contract.md` §13 (EO's forbrug af importen).
- udtraek-2/A18: indarbejdet i EET §4.4.
- udtraek-2/A19: allerede indarbejdet i IFB §2.3 af G1; EET §4 henviser dertil.
- udtraek-2/A21: indarbejdet i EET §4 («EET-procenter»).
- udtraek-2/A22: indarbejdet i EET §4 («EET-procenter», `kapitaliseringUnder15WarningRowIds`).
- udtraek-2/A23: indarbejdet i EET §4 («Rækkeissues»).
- udtraek-2/A25: indarbejdet i EET §4.4.
- udtraek-2/A26: indarbejdet i EET §4.3 og §2; mekanikken overladt til `docs/domain/eet/kapitaliseret-eet.md` (G7).
- udtraek-2/A31: indarbejdet i EET §2 («Hver fanes afhængigheder»).
- udtraek-2/A34: indarbejdet i EET §4.2.
- udtraek-2/A39: delvist indarbejdet i EET §4.4 (afgørelsesoverskriften, «Mdr.» med fem decimaler, «opgjort til og
  med»/«ophører», «Grundydelse pr. år», «≤ 2 år»). Resten forkastet: de øvrige formuleringer (minustegn i formler,
  «(oprundet) =», «Rest-EET», tilbageholdt-noten, «kr.» på alle beløb, forligsprocentens trim) er tekstkonstanter,
  som koden og dens tests ejer, og uden en afgørelse, der kan genåbnes.
- udtraek-2/A41: indarbejdet i FT §4B.
- udtraek-4/A12: overladt til `eo-snapshot-contract.md` §15 (Manuelt angivet som vej til Store Bededagstillæg).
- udtraek-4/A14: overladt til `eo-snapshot-contract.md` §15.
- udtraek-4/A32: indarbejdet i EET §2.1 (info-ikonets tekst, «gælder ikke Forsørgertab»).
- udtraek-6/A18: overladt til `eo-snapshot-contract.md` (reguleringsafsnittet) – reglen om ens lønudviklingsvalg på
  tværs af ansættelsesforhold er EO's; ILT §2a beskriver kun selve tilvalget.
- udtraek-6/A23: indarbejdet i ILT §2a pkt. 5 (linket fører til togglen); efterprøvet i `eoRowIssueCatalog.ts`.
- udtraek-7/A4: indarbejdet i ILT §2b («Den angivne løn er den samlede løn»).
- udtraek-7/«afklaringslog 9b»: markørerne i ILT er fjernet.
- udtraek-7/A12: overladt til `eo-snapshot-contract.md` §10.

## Gentagelser i `eo-snapshot-contract.md`, der bør erstattes af henvisninger

1. §1, første afsnit («skal være `ready`; rå canonical sektioner må ikke gives som bypass») og «Ingen EO-total må
   beregnes parallelt …»: henvis til `snapshot-contract.md` §2–§3; behold kun EO's projektionsliste.
2. §5, bullets om `sourceToken`, stale-snapshot og «Stale state er et refresh-behov, ikke en systemfejl» samt
   indledningens settingsrevision: henvis til `snapshot-contract.md` §10; behold det EO-specifikke (Beregning,
   EOInspektion og EOKontrolTabel genbygger; kontroluoverensstemmelse vurderes kun på et friskt snapshot).
3. §3.3, første afsnit: princippet (en rød feltfejl blokerer kun den gren, der læser feltet) står nu i
   `snapshot-contract.md` §2 pkt. 4; EO-afsnittet kan henvise og beholde grenene og forligsundtagelsen.
4. §13, bullets «Importportens beløb er `MoneyOre` …», «Hvis import-context mangler, er schema-ugyldig …» (delen om at
   det er en blokerende issue) og «"Ingen relevante EET-rækker" og "EET-import-contexten mangler …" er forskellige
   tilstande»: henvis til `eet-snapshot-contract.md` §5, som ejer portens egenskaber. Reglerne om, at EET-sidens
   beregningsdato ikke læses, og om revurdering ved nye EET-issue-typer, har deres hjem i §13; EET henviser dertil.

## (b) Konflikter kode ↔ udviklerafgørelse (forelægges)

Ingen.

## (c) Uafklarede tvivlstilfælde

1. **Findes planen for særligt ferietillæg?** ILT §6 og `AGENTS.md` §Projekt sagde, at der er lavet en
   implementeringsplan. Den findes ikke i repoet (`docs/implementation/` rummer kun README), kun i Claude-memory
   (`saerligt-ferietillaeg-planned.md`, med satserne 0,96 % / 1,48 % fra 1. maj 2024). Brugeren ser intet – tillægget
   er ikke i programmet. ILT §6 siger nu blot, at projektet ikke er påbegyndt, og at tillægget kun må stå i
   dokumentation og en eventuel plan i `docs/implementation/`. Anbefaling: G7 afgør med udvikleren, om planen skal
   skrives ind i `docs/implementation/` (så memoryen kan slettes), eller om `AGENTS.md` skal holde op med at nævne den.
2. **Satstrappeopslaget bruges ikke af beregningen.** `resolveIndskudtLoentillaegPct` kaldes kun af tests;
   `STORE_BEDEDAG_SATSTRAPPE` kun af beregningsdatakataloget. Reguleringen gentager i stedet datogrænsen selv
   (`dateIso >= STORE_BEDEDAG_START ? STORE_BEDEDAG_PCT : 0` to gange i `overenskomstReguleringShared.ts`, desuden i
   `resolveStoreBededagstillaegPct`). Brugeren ser ingen forskel – tallene er de samme. ILT §2 pkt. 4 beskriver nu
   tilstanden. Anbefaling (ren intern refaktorering, ingen godkendelse nødvendig): lad de tre steder bruge ét opslag,
   eller fjern den ubrugte eksport, hvis modellen med flere trin ikke skal bevares som udvidelsespunkt.
3. **Skjult feriesats på den angivne løn.** `eoAngivetLoenFields.feriePct` («Feriegodtgørelse/-tillæg», grænse 0–100 %,
   ikke 25 %) har intet felt på skærmen, men læses ind i beregningen (`angivetLoenHelpers.ts`) og bruges af
   `manuelForm.ts` som fald-tilbage, når basisrækkens feriesats i «Manuelt angivet» er tom. I dag er værdien normalt
   tom, så brugeren ser intet. En værdi i en ældre fil ville dog kunne indgå uden at være synlig eller vurderet efter FB
   §2b. Anbefaling: undersøg, om sloten kan få en værdi; hvis ikke, dokumentér det ved descriptoren eller fjern læsningen.

## Afslutning (hovedagenten, 2026-11-27)

Alle punkter i (c) er lukket i arbejdsstykke 3:
- c1: forelagt; udvikleren valgte at fjerne omtalen af planen. `AGENTS.md` §Projekt og ILT §6 siger, at der ingen
  plan er; satserne står i `docs/domain/taf/tabt-arbejdsfortjeneste.md`; memoryen er slettet.
- c2: `resolveStoreBededagstillaegPct` og `overenskomstReguleringShared.ts` slår nu satsen op med
  `resolveIndskudtLoentillaegPct(STORE_BEDEDAG_SATSTRAPPE, …)`; ILT §2 pkt. 4 opdateret.
- c3: forelagt; udvikleren valgte, at den skjulte sats ikke læses. `angivetLoenHelpers.ts` giver `feriePct: undefined`;
  kommentar ved descriptoren; reglen står i EOS §15; testene tilpasset og en ny test tilføjet.
