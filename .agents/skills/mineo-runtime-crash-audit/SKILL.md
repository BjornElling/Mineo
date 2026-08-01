---
name: mineo-runtime-crash-audit
description: Udfør og genoptag en autonom, systematisk robustheds-audit af Mineo for uventede runtimefejl udløst af brugerinput og brugeradfærd. Brug skillen, når Mineo skal gennemgås felt for felt, afhængighed for afhængighed og regelgren for regelgren med ugyldige, delvise, ekstreme og grænserelaterede værdier samt tilstandsskift; når crash-, console-, promise-, error-boundary- eller fejlrapporthændelser skal reproduceres og registreres; eller når en tidligere audit skal fortsættes fra sit checkpoint. Skillen finder og dokumenterer problemer, men retter dem ikke.
---

# Mineo runtime crash-audit

Arbejd autonomt, reproducerbart og i små checkpointede batches. Målet er dækningsbevis for den definerede input- og interaktionsmodel, ikke en ubeviselig garanti om, at ingen fremtidig hændelse kan fejle.

## Ufravigelig afgrænsning

- Find, isolér og registrér. Ret ikke produktionskode, tests, kontrakter, data eller konfiguration.
- Ændr kun auditdokumenterne under `docs/testing/runtime-input-audit/`. Gem eventuelle screenshots/traces under `test-results/runtime-input-audit/`.
- Brug kun syntetiske data. Send intet eksternt, og blokér ekstern trafik/service workers som foreskrevet af projektet.
- Vurdér ikke juridiske eller beregningsmæssige regler. Registrér observerbare inkonsistenser eller kontraktbrud som observationer.
- Skeln forventet validering (fx rød kant og tooltip uden systemsignal) fra uventet runtimefejl.
- Spørg ikke brugeren om testvalg, rækkefølge eller klassifikation, når arbejdet kan fortsætte sikkert. Registrér tvivl og fortsæt.

## Start eller genoptag

1. Fastlæg repo-roden med `git rev-parse --show-toplevel`, og kør resten af arbejdet derfra.
2. Læs repoets `AGENTS.md`, relevante kontrakter og den komplette projektlokale `playwright-cli`-skill før browserstyring.
3. Kør `node .agents/skills/mineo-runtime-crash-audit/scripts/init-audit-workspace.mjs .` første gang. Scriptet overskriver aldrig eksisterende auditdokumenter.
4. Læs altid `STATUS.md` helt. Læs åbne poster i `CRASHES.md` og `OBSERVATIONS.md`; brug `rg` til målrettet opslag i lange filer.
5. Kontrollér `git status --short`, aktuel commit og buildversion. Behandl eksisterende ændringer som brugerens og rør dem ikke.
6. Hvis en række står `I gang`, gentag hele dens senest beskrevne arbejdsenhed fra en kendt ren tilstand. Tag ellers næste række i fast rækkefølge: global shell, sider i navigationens rækkefølge, faner og felter i synlig rækkefølge, derefter tværgående flows.
7. Markér arbejdsenheden `I gang` og skriv det konkrete næste scenarie, før browserarbejdet begynder.

Læs [references/audit-method.md](references/audit-method.md) helt før første auditkørsel og igen, når inventaret eller en ny afhængighedsklynge planlægges.

## Arbejdscyklus

### 1. Udled inventaret fra koden

Kortlæg den valgte flade før test: route/fane, alle editorer og handlinger, Zod-schema/feltdefinition, canonical tomværdi, formatdomæne, aktive grænser, afhængige felter, selectors/projektioner, opslag, beregningsgrene, dokumentforbrugere og alle eksplicitte skæringsdatoer/-tal. Registrér hver flade, branch og afhængighedskant som en selvstændig dækningsrække i `STATUS.md`.

Antag aldrig, at synlige felter er hele fladen. Medtag tabeller, dropdowns, toggles, radioer, overlays, hjælpefelter, tastaturhandlinger, undo/redo, navigation, gem/hent/nulstil og dokumenthandlinger.

### 2. Design en endelig scenariomatrix

Brug partitioner og grænseanalyse fra referencen. Test mindst:

- tom, delvis, forkert format, whitespace/Unicode, paste og ekstreme repræsenterbare værdier;
- hver grænse ved `-1`, præcis grænse og `+1` i den relevante enhed;
- hver skæringsdato dagen før, på dagen og dagen efter;
- typing kontra paste samt settle via blur/Enter, Escape, Delete/Backspace og navigation med åben draft;
- afhængig først kontra forudsætning først; udfyld → skift overordnet valg → skift tilbage; ryd og genudfyld forudsætningen;
- parvise kombinationer på tværs af partitioner, 3-vejs kombinationer omkring høj-risiko-hubs og fuld kombination for små, endelige boolean-/mode-sæt;
- fortsat downstream-brug: validering, opslag, beregning, faneskift, dokumentgate, save/load og re-render, når inputtet indgår dér.

### 3. Kør med aktive orakler

Følg projektets browserinstruktioner og log ind gennem den synlige formular. Etabler en ren baseline før hver isoleret reproduktion. Overvåg fra før login:

- `pageerror`, uncaught exceptions/rejections og `console.error`;
- browser-/page-crash, fastlåst UI, blank side eller tabt interaktion;
- ErrorBoundary/fallback og ny central fejl-/fejlrapportmenu;
- uventet navigation, tabt afsluttet input eller anden brudt runtime-invariant;
- ekstern netværkstrafik.

Et af disse signaler er et kandidatfund, også hvis appen tilsyneladende fortsætter. Forventet rød validering alene er ikke et crashfund. Kør både isolerede scenarier fra ren sag og realistiske tilstandssekvenser i samme sag.

### 4. Isolér og registrér straks

Stop kun den aktuelle matrixgren ved et signal. Bevar resten af køen. Gentag fra ren tilstand mindst to gange, minimer handlingerne og afgør den første handling, der udløser signalet.

- Skriv reproducerbare runtimefejl i `CRASHES.md` med næste ledige `CRASH-NNN`.
- Skriv ikke-crashende afvigelser, inkonsistens, datatabsmistanke, parallel adfærd og tvivlsomme regler i `OBSERVATIONS.md` med `OBS-NNN`.
- Deduplikér efter fejltype/stacktop og kausal handling. Link relaterede scenarier i stedet for at skjule variationer.
- Indsæt præcis fejltekst og kort relevant stack; medtag aldrig persondata eller store logs.
- Registrér også ikke-reproducerbare signaler med status `Ustabil` og den fulde observerede sekvens.

### 5. Checkpoint

Opdatér dokumenterne umiddelbart efter hvert fund og efter hver lille matrixbatch. En batch må højst være én synlig flade eller én tæt afhængighedsklynge. Opdatér:

- rækkens status og dækkede partitioner/branches;
- senest afsluttede scenarie og præcist næste scenarie;
- nye/opdaterede fund-id'er;
- sessionens commit, dirty-state, browser og tidspunkt.

Før enhver pause eller handoff: stop ad hoc-server/browserprocesser, skriv checkpointet først, og rapportér kun antal nye crashfund, observationsfund, afsluttet arbejdsenhed og næste arbejdsenhed. Kør ingen kodekvalitetsgate, fordi skillen ikke ændrer kode.

## Afslutningskriterium

Markér først auditten afsluttet, når inventaret er afstemt mod både UI og kildekode, ingen række er `Ikke startet`, `I gang` eller `Blokeret`, alle identificerede branches/skæringer og afhængighedskanter har evidens, alle fejl er reproduceret eller markeret ærligt som ustabile, og den afsluttende fulde navigation-/stateful smoke er kørt uden nye systemfejl. Beskriv resterende testmodelrisiko; skriv aldrig, at fravær af observerede fejl beviser fravær af fejl.
