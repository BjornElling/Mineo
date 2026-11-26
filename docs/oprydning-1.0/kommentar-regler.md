# Regler for kommentaroprydning (fase 3)

Baggrund: `docs/oprydning-1.0/README.md` §2. Programmet går i version 1.0; al procestekst skal ud af koden, mens
varige begrundelser bliver.

## Hvad du ændrer
KUN kommentartekst (`//`, `/* */`, JSDoc) i dine tildelte filer. Aldrig kode, identifikatorer, strengliteraler
(undtagen testtitler, se nedenfor) eller formatering uden for kommentarer.

## Hvad skal ud
- Fund- og proces-ID'er: `BB-123`, `BF-12`, `NY-12a-3`, `M-58`, `TD-019`/`td020`, `R1-F04`, `A1/C5`, `AP2`,
  «afklaringslog 10a», «Brugerblik 12g», «greenfield #52», «fund nr.», «review-runde» o.l.
- Henvisninger til procesdokumenter, der slettes: alt under `docs/review/`, `docs/testing/`,
  `docs/brugerfund-der-skal-rettes.md`, `docs/dependency-update-*`. Erstat med selve begrundelsen (læs evt. det
  citerede afsnit – dokumenterne findes endnu – og skriv den varige regel kort i kommentaren).
- Datoer som proveniens («Brugerfund 2026-08-18», «Beslutning 2026-08-19», «rettet 2026-10-02», «siden 2026-…»).
- Historiefortælling: «tidligere var/lå/brugte …», «før omlægningen …», «blev indført efter …», «det kostede
  konkret …», «fandt ved indførelsen fem …», commit-hashes som forløb. Omskriv til nutid: hvad koden gør, og
  hvorfor den naive form ikke virker («ellers …»).
- Udviklerens/brugerens navn som kilde («udvikleren afgjorde …») → angiv reglen; evt. «bevidst valg» er nok.

## Hvad skal blive
- Begrundelser for ikke-indlysende kode (`AGENTS.md` §Konvergens: «hvilket problem den løser, og hvorfor den
  naive form ikke virker»). Formuler dem i nutid, uden forløb.
- Fraværsværn: kommentarer, der navngiver en slettet mekanisme for at forbyde den («`useXxx` er slettet og må
  ikke genindføres»). Behold navnet; fjern kun datoen.
- Henvisninger til `src/contracts/*.md`, `docs/architecture/*.md`, `docs/domain/**` (de bevares).
- Datoer, der er DATA eller domæneregler (skæringsdatoer, satsperioder, lovdatoer, testdata).
- Forklaring på en bevidst afvigelse, også når den nævner, at den er bevidst/afgjort.

## Testfiler
- Testtitler (`describe`/`it`/`test`-strenge) må renses for ID'er og datoer, men KUN hvis testfilen ikke har en
  tilhørende snapshot-fil (`__snapshots__/<fil>.snap`) og ikke bruger `toMatchSnapshot`/`toHaveScreenshot`.
- Ændr aldrig testdata, forventede værdier eller fixtures.

## Sikkerhed
- Før du fjerner en karakteristisk frase eller et ID, så `git grep -n "<frasen>" -- src/__tests__/quality scripts e2e/support`.
  Matcher et værn på teksten, så lad den stå og notér det.
- Dansk prosa; en-dash ` – ` som tankestreg, aldrig em-dash. Gør ikke kommentarer længere end nødvendigt. Kan
  en kommentar helt undværes, fordi koden er selvforklarende, og den kun bar historik, så slet den.
- Filer der omdøbes af en anden agent: rør ikke `src/__tests__/domain/data/td020*`, `src/__tests__/validators/td019*`
  eller filer med `brugerblik`/`td-` i navnet, medmindre du har fået dem tildelt.
- Rør ikke `src/contracts/`, `docs/`, `AGENTS.md`, `CLAUDE.md`.
- Commit ikke. Kør ingen fulde gates; til sidst `npm run typecheck` (kildekode) eller `npm run typecheck:test`
  (tests) eller `npm run typecheck:e2e` (e2e) som sikkerhedsnet for, at du ikke har brudt en kommentar ud i kode.

## Søgning efter kandidater
Start med `git grep -nE` på mønstre som:
`BB-[0-9]|BF-[0-9]|NY-[0-9]|\bM-[0-9]{2}|TD-?[0-9]{3}|td0[0-9]{2}|R[0-9]-F[0-9]|afklaringslog|[Bb]rugerfund|[Bb]rugerblik|greenfield #|docs/(review|testing)|brugerfund-der|20(25|26)-[01][0-9]-[0-3][0-9]|[Tt]idligere (lå|var|blev|brugte|fandtes|stod)|[Ff]ør (omlægningen|rettelsen|cutover)|indtil [0-9a-f]{7}|commit [0-9a-f]{7}|`[0-9a-f]{8}`|reviewet|review-?runde|gennemgangen fandt`
og vurder hvert træf i kontekst (mange datoer er data). Læs også kommentarblokke omkring træffene – historik
står ofte i nabosætningerne.

## Rapport
Dit svar: antal ændrede filer, eksempler på 2–3 typiske omskrivninger, og en liste over steder du bevidst lod
stå (værn-bundne tekster, tvivlstilfælde). Nævn også kontraktdrift eller forældede påstande i kommentarer, som
du ikke kunne afgøre.
