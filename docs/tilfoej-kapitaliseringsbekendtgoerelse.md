# Arbejdsværktøj: Udtræk af kapitaliseringsbekendtgørelser

Dette dokument er en intern arbejdsinstruks til konsekvent udtræk af kapitaliseringsdata fra tekst, så output altid kan bruges direkte i programmet uden manuel omstrukturering.

## Vurdering af fremgangsmåde

Fremgangsmåden er god og bør fastholdes:

- Én fil pr. bekendtgørelse/vejledning.
- Filnavn som `xxxx-yyyy.ts` (fx `10029-2024.ts`).
- Filer samlet i en dedikeret mappe under `src/data/kapitalisering/`.
- Samme datastruktur og feltnavne i alle filer.
- Tabellignende kodeopsætning med tydeligt visuelt overblik.

Anbefalet placering:

- `src/data/kapitalisering/kapitaliseringsTabeller/xxxx-yyyy.ts`

Dette matcher implementeringsretningen i:

- `docs/domain/eet/kapitaliseret-eet.md`
- `docs/domain/eet/loebende-eet.md`
- `src/data/kapitalisering/kapitaliseringsbekendtgoerelser.ts`

## Bindende principper ved udtræk

- **Ubrydelig 1:1-regel:** Tabelindhold skal altid indlægges 1-til-1 fra den konkrete kildevejledning/-bekendtgørelse.
- Der må aldrig indføjes, udfyldes, estimeres eller \"genbruges\" værdier fra andre kapitaliseringsbekendtgørelser.
- **Tidsafgrænsning:** Mineo understøtter kun sager med skadedato fra og med 1. januar 2005. For hver tabel skal anvendelsesområdet derfor fastslås eksplicit i PDF’en eller kildeteksten. Indlæs kun tabeller, der vedrører mindst én understøttet sag fra og med 1. januar 2005; tabeller, der udelukkende vedrører skader frem til og med 31. december 2004, må ikke indlæses. En tabel med blandet anvendelsesområde skal bevares, hvis kilden udtrykkeligt viser, at den også vedrører sager fra og med 1. januar 2005. Der må ikke gættes ved uklart anvendelsesområde.
- Hvis en værdi/tabellerække mangler i kilden, skal den forblive manglende i outputtet (ingen fallback-data).
- Ingen normalisering må ændre tabelindholdets faktiske værdier eller struktur; kun formatkonvertering er tilladt (fx komma -> punktum i decimaltal).
- For ældre kilder med kønsopdelte tabeller skal kønsopdelingen bevares fuldt 1:1 i separate exports (ingen sammensmeltning, gennemsnit eller afledte tabeller).
- Regel for kønsopdeling: frem til og med 28. februar 2015 anvendes kønsafhængige kapitaliseringssatser. Fra og med 1. marts 2015 bortfalder kønsopdelingen, og kapitalisering sker kønsneutralt med én fælles kapitaliseringsfaktor.
- Folkepensionsalder må ikke længere ligge i kapitaliseringstabelfilerne. Den centrale kilde er `src/data/folkepensionAlderRates.ts`, som slår folkepensionsalder op på fødselsdato og relevant opslagsdato.
- Bekendtgørelse og vejledning behandles ens i data: identifikation sker via `id` i format `nummer/år`.
- `gyldigFra/gyldigTil` er altid kapitaliseringsdato-gyldighed (omsætningstidspunkt) - aldrig fødselsdato-/tabelvalgsintervaller.
- Der må ikke gættes på uklare værdier. Ved tvivl stoppes udtræk, og uklarhed markeres eksplicit.
- Output skal være fail-closed: ingen tomme eller "næsten"-tolkede værdier i kritiske felter.
- Alle datoer skrives som ISO (`YYYY-MM-DD`).
- Undtagelse: `kapitaliseringsDatering` skrives i kildens officielle format `DD/MM/YYYY` (visningsmetadata), ikke ISO.
- Dateringsmønster: Det er sædvanligt og forventeligt, at bekendtgørelsens/vejledningens datering ligger nogle måneder før ikrafttrædelsen (fx udstedt 30/10/2020 og gældende for 2021).
- Flerårige perioder er også forventelige: en udstedt bekendtgørelse/vejledning kan dække både det umiddelbart efterfølgende år og senere år.
- Plausibilitetskontrol: Det er kun påfaldende, hvis datering ligger markant før ikrafttrædelse (fx udstedt i slutningen af år 1 men først gældende fra år 3). Som tommelfingerregel må udstedelse højst ligge ca. 6 måneder før første ikrafttrædelsesdato.
- Decimaltal skrives som JavaScript-tal med punktum (ikke komma), uden afrunding medmindre kilden entydigt kræver det.
- Tabellen skal være menneskeligt læsbar: én række pr. linje, stabil kolonnering, fast sortering.
- Sortering/ordning er en fast regel og skal altid være den samme:
  - tabeller i kildens tabelnavn-rækkefølge
  - aldersrækker stigende på `alder`
  - tabelvalg sorteret med nyeste `skadedatoFra` først, derefter nyeste `foedselsdatoFra` først
- Udtræk kun tabeller for `erhvervsevnetab` og `forsørgertabserstatning`.
- Tabeller for `varige mén` og `behandlingsudgifter` må ikke medtages.
- Hvis tabeltype ikke kan afgøres entydigt fra kilden, stoppes udtrækket og brugeren skal spørges.

## Forbudt i tabelfiler

- **Folkepensionsalder** – brug ikke `folkepensionsalderAar`, `ophoersalderAarLabel` eller tilsvarende felter i tabelfiler. Folkepensionsalder er tværdomæne og håndteres udelukkende via `src/data/folkepensionAlderRates.ts` (`getFolkepensionAlder`, `getFolkepensionsdato`, `getDagenFoerFolkepensionsdato`). Filen ligger bevidst i `src/data/` og ikke under `src/data/kapitalisering/` – den er ikke kapitaliseringsspecifik.
- **Afledte aldersbegreber** – ophoersalder, pensionsdato og lign. må ikke udledes eller hardkodes i tabelfiler. Disse beregnes altid dynamisk via ovenstående centrale kilde.
- **Forsørgertabstabeller for restperioden** – tabellerne med efterladtes alder × resterende erstatningsperiode er en obligatorisk del af Forsørgertab-sidens kapitalisering og skal altid udtrækkes.
- **Legacy-tabeller for afløsningsbeløb** – særskilte tabeller med »Værdi af afløsningsbeløb ved det fyldte 65./67. år« er tillæg for bestemte afgørelser efter ældre arbejdsskadelove. De er ikke de tabeller, der omsætter den almindelige resterende ASL-ydelse. Mineo accepterer sager fra 1. januar 2005, mens disse tillæg vedrører ældre ordninger, og de indgår derfor ikke i programmets understøttede sagsflade. Dataene bevares i original-PDF'en, men udtrækkes ikke som ubrugte TypeScript-exports.

## Kendte undtagelser der skal dokumenteres i filerne

- Der findes kun én gyldig EET-kontrakt i programmet: `erhvervsevnetabTabelvalg`.
- Ældre bekendtgørelser registreres i samme kontrakt som nyere. Programmet skal kunne beregne bagud i tid.
- Hvis kilden arbejder med ophørsalder eller folkepensionsalder, må værdien ikke indlægges i tabelvalget. Kontrollér i stedet, at `src/data/folkepensionAlderRates.ts` dækker den relevante lovperiode og fødselskohorte.
- Hvis kilden ikke har fødselsdato-intervaller, får tabelvalget én åben årgang fra `1900-01-01`.
- Hvis kilden ingen tabel har for de ældste årgange (fx BEK 1156/2017 for født før 1. juli 1954), er det fordi de i hele kildens periode er højst 2 år fra folkepensionsalderen. Årgangen udelades; opslaget bruger da den ældste årgangs tabel som udgangspunkt for særfaktoren og fail-closer, hvis særfaktoren ikke gælder.
- En ændringsakt, der ændrer en faktor midt i perioden, får sin egen fil og post i oversigten fra ikrafttrædelsen og genbruger den ændrede kildes tabeller (fx `229-2014.ts`). En ændringsakt, der kun tilføjer eller erstatter tabeller fra kildens ikrafttræden, indlæses i kildens fil og angives i `supplerendeKildePdfFiler` (fx BEK 1339/2013 i `1202-2013.ts`).
- Gennemgå altid kildens «Senere ændringer til forskriften» på Retsinformation: en ændring kan tilføje tabeller (1202/2013 manglede forsørgertabstabellerne) eller rette en faktor (229/2014). En akt, der bortfaldt, før den fik virkning (fx VEJ 9738/2020, VEJ 9914/2024, BEK 1188/2015), registreres ikke.
- For VEJ `9921/2019` og `9870/2020` er 2020 bevidst opdelt: `9921/2019` dækker `2020-01-01`–`2020-12-30`, `9870/2020` kun `2020-12-31`.
- For VEJ `9820/2023` og `9376/2024` kan filernes `gyldig`-intervaller overlappe i anden halvdel af 2024; prioriteringen styres i `kapitaliseringsbekendtgoerelser.ts` med skæringsdato `2024-07-01`.

## Udtræksflow (hver gang)

1. Identificer metadata i kildeteksten:
- Type (`bkg`/`vejl`, hvor `vej` normaliseres til `vejl`).
- Nummer og år.
- Samlet `id` i format `nummer/år`.
- Gyldighedsinterval for kapitalisering (`gyldigFra/gyldigTil`) fra anvendelsesbestemmelsen.

2. Identificer og udtræk alle tabeller:
- Tabel-id (A, B, C, ...).
- Rækker med `alder` og `faktor`.
- Markér om tabellen er kønsneutral eller kønsopdelt (`mænd`, `kvinder`).
- Fastslå og dokumentér tabellens skadedato-/sagsperiode ud fra kilden, og frasortér tabeller, der kun vedrører skader frem til og med 31. december 2004.
- Bevar kildens numeriske præcision.
- Filtrér til tabeller for erhvervsevnetab/forsørgertabserstatning; udelad varige mén/behandlingsudgifter.
- Forsørgertabstabeller (`faktorerPraHeleAar`) kan have varierende antal kolonner pr. alder-række. Bevar præcis antal værdier fra kilden; aldrig pad/trunkér.

3. Identificer tabelvalg-oplysninger:
- `skadedatoFra`.
- `foedselsdatoFra`.
- Hvilken tabel (`A`, `B`, ...).

Folkepensionsalder ved tabelvalg:

- Tabelvalget må kun indeholde nøgler til tabelbogstavet: skadedato, fødselsdato og eventuel øvre fødselsdatogrænse.
- Folkepensionsalder, ophørsalder, labels og alder i måneder beregnes centralt i `src/data/folkepensionAlderRates.ts`.
- Hvis kilden viser fødselsdato-grupper, der svarer til folkepensionsalder, bruges grupperne fortsat som tabelvalgsnøgler, men alderen selv udelades fra tabelfilen.
- Hvis en ny kilde afslører en lovperiode eller fødselskohorte, der ikke dækkes centralt, skal `src/data/folkepensionAlderRates.ts` opdateres i samme ændring.

4. Identificer særfaktor ved under 2 år til folkepension.

5. Normaliser til den faste kodekontrakt (nedenfor).

6. Kør hurtig konsistenskontrol:
- Filnavn matcher `id` (slash -> bindestreg).
- Alle refererede tabeller findes.
- Tabelrækker er sorteret stigende på `alder`.
- Tabelvalg følger den bindende sorteringsregel defineret ovenfor.

## Når kilden er CSV som "Erhvervsevnetab 5.1.2026.csv"

Typisk struktur i denne type fil:

- Semikolon-separeret (`;`).
- Metadata øverst (fx `VEJ nr 10056 af 30/10/2025`).
- En blok med `Skadedato fra;Fødselsdato fra;Tabel`.
- En særlinje med `Kapitaliseringsfaktor ved <2 år til FP`.
- En bred matrix med flere tabeller side om side (`Tabel A`, `Tabel B`, ...), hvor hver tabel har kolonnerne `Alder;Faktor`.

Normalisering fra denne CSV-type:

- `VEJ` normaliseres til `kapitaliseringsType = 'vejl'`.
- Tal med komma i faktorfelt (fx `1,246`) konverteres til punktum (`1.246`).
- Tomme matrixceller ignoreres (de er layout, ikke data).
- `tabelvalg` udtrækkes fra den første blok (`Skadedato fra;Fødselsdato fra;Tabel`).

Vigtigt om folkepensionsalder:

- Folkepensionsalder/ophørsalder må ikke duplikeres i kapitaliseringstabelfilerne.
- `src/data/folkepensionAlderRates.ts` er single point of truth for alder i måneder, labels, folkepensionsdato og dagen før folkepensionsdato.
- Hvis folkepensionsalderen i kilden ikke stemmer med den centrale fil, stoppes udtrækket og markeres som afklaring nødvendig.

## Fast kodekontrakt for hver `xxxx-yyyy.ts`

Alle filer har samme struktur og eksportnavne. Datoer skrives som ISO-strenge; `index.ts` validerer og
brander dem ved indlæsning. Eksemplet er et illustrativt udsnit – tabelindhold er altid 1:1 fra kilden.

```ts
import type {
  AldersFaktorRaekke,
  AldersKoensopdeltFaktorRaekke,
  ForsoergertabMatrixRaekke,
  RaaErhvervsevnetabTabelvalg,
  RaaForsoergertabTabelvalg,
  RaaSaerfaktor,
  UdeladelsesGrund,
} from '.';

export const kapitaliseringsId = '10029/2024' as const;
export const kapitaliseringsType = 'vejl' as const;
export const kapitaliseringsFuldeNavn = 'Vejledning om omsætning af løbende erstatning til kapitalbeløb i 2025 …' as const;
export const kapitaliseringsDatering = '06/12/2024' as const;
export const gyldigFra = '2025-01-01';
export const gyldigTil = '2025-12-31';
export const supplerendeKildePdfFiler = [] as const;

// Kildens fulde tabelliste – hver tabel er indlæst ELLER står i udeladteKildetabeller.
export const kildetabeller = ['A', 'B', 'C', 'D', /* … */ 'W'] as const;

export const udeladteKildetabeller = {
  Q: 'skader-foer-2004', // lov om sikring mod følger af arbejdsskade (skader før 2004)
  T: 'afloesningsbeloeb',
  V: 'behandlingsudgifter',
  W: 'varigt-men',
} as const satisfies Readonly<Record<string, UdeladelsesGrund>>;

// Sammenhængende årgange pr. skadesinterval; kun den yngste er åben (foedselsdatoTil: null).
export const erhvervsevnetabTabelvalg = [
  { skadedatoFra: '2021-01-01', foedselsdatoFra: '1967-01-01', foedselsdatoTil: null, tabel: 'A' },
  { skadedatoFra: '2021-01-01', foedselsdatoFra: '1963-01-01', foedselsdatoTil: '1966-12-31', tabel: 'B' },
] as const satisfies readonly RaaErhvervsevnetabTabelvalg[];

// Ét afsnit pr. skadesinterval; kønsopdelte kilder angiver tabelMaend/tabelKvinder i stedet for tabel.
export const forsoergertabTabelvalg = [
  { skadedatoFra: '2021-01-01', tabel: 'D' },
] as const satisfies readonly RaaForsoergertabTabelvalg[];

// Præcis én pr. skadesinterval fra 1. juli 2007; ingen for ældre skadesintervaller.
export const saerfaktorUnderToAarTilFp = [
  { skadedatoFra: '2021-01-01', faktor: 1.245 },
] as const satisfies readonly RaaSaerfaktor[];

export const erhvervsevnetabTabeller = {
  A: [
    { alder: 5, faktor: 59.629 },
  ],
} as const satisfies Readonly<Record<string, readonly AldersFaktorRaekke[]>>;
export const erhvervsevnetabKoensopdelteTabeller = {} as const satisfies Readonly<Record<string, readonly AldersKoensopdeltFaktorRaekke[]>>;
export const forsoergertabTabeller = {
  D: [
    { alder: 18, faktorerPraHeleAar: [0.626, 1.26, 1.901, 2.55, 3.206, 3.871, 4.543, 5.223, 5.912, 6.609] },
  ],
} as const satisfies Readonly<Record<string, readonly ForsoergertabMatrixRaekke[]>>;
export const forsoergertabTabellerMaend = {} as const satisfies Readonly<Record<string, readonly ForsoergertabMatrixRaekke[]>>;
export const forsoergertabTabellerKvinder = {} as const satisfies Readonly<Record<string, readonly ForsoergertabMatrixRaekke[]>>;
```

Integritetskontrollen i `index.ts` afviser ved indlæsning: en kildetabel, der hverken er indlæst eller
begrundet udeladt; en indlæst tabel, intet tabelvalg peger på; et tabelvalg uden tabel; huller eller
overlap i EET-årgangene; forsørgertabsvalg, der ikke følger kildens kønsopdeling eller dækker andre
skadesintervaller end EET-valget; og en særfaktor, der mangler eller er overtallig. Kataloget kontrollerer
desuden, at hver kilde har sit eget afsnit for det skadesinterval, oversigten knytter den til.

Kønsopdelingen følger kildens gyldighed: kilder, der gælder før 1. marts 2015, er kønsopdelte (EET og
forsørgertab), senere kilder kønsneutrale.

## Krav til tabellignende layout (læsbart i kode)

- Tabeller skrives som blokke med tydelig visuel struktur.
- Hver række er ét objekt på én linje.
- Kolonner holdes visuelt på linje når muligt.
- Ingen kompakt/minificeret arraysyntaks.
- Tabelvalg skrives som ét objekt pr. linje (se kodekontrakten).
- Rækkefølge i filen er bindende:
1. metadata exports
2. `kildetabeller` og `udeladteKildetabeller`
3. `erhvervsevnetabTabelvalg`, `forsoergertabTabelvalg` og `saerfaktorUnderToAarTilFp`
4. selve tabel-exports (alle fem, også de tomme)
- Hver indlæst tabel skal kunne vælges af et tabelvalg; alle øvrige kildetabeller står i `udeladteKildetabeller` med begrundelse.

## Integrationstrin efter ny fil

1. Læg kilde-PDF'en i `src/data/kapitalisering/kapitaliseringOriginalPdf/` og filen i `kapitaliseringsTabeller/`.
2. Importér modulet i `kapitaliseringsTabeller/index.ts` (`MODULER`).
3. Opdater `kapitaliseringsbekendtgoerelser.ts` med korrekt `id` og `kapitaliseringsdatoFra` i hvert relevant skadesinterval.
4. Kontrollér, at `src/data/folkepensionAlderRates.ts` dækker opslagsperioden og årgangene.
5. Opdater katalogets golden-fingerprints i `calculationDataCatalog.test.ts` med en begrundelse.
6. Kør `npm run check:types` og data-/domænetestene.

## Promptskabelon til fremtidige udtræk

Brug denne arbejdsprompt internt når du får ny tekst:

```md
Opgave: Udtræk kapitaliseringsdata fra vedlagte tekst og lever en compile-klar TypeScript-fil i formatet `xxxx-yyyy.ts`.

Krav:
- Brug præcis den faste kodekontrakt fra `docs/tilfoej-kapitaliseringsbekendtgoerelse.md`.
- Indlæs kun tabeller, der ifølge kilden vedrører sager fra og med 1. januar 2005; udelad tabeller, der kun vedrører skader frem til og med 31. december 2004.
- Ingen antagelser ved tvivl; markér i stedet manglende/uklare felter.
- Folkepensionsalder/ophørsalder skal håndteres via `src/data/folkepensionAlderRates.ts`; kapitaliseringstabelfilen må kun indeholde tabelvalg og faktortabeller.
- Bevar numerisk præcision fra kilden.
- Output skal være tabellignende og menneskeligt læsbart.
- Brug `id` som `nummer/år` og filnavn som `nummer-år.ts`.
```

## Afgrænsning

Dette dokument beskriver udtræk og strukturering af tabelfiler pr. bekendtgørelse/vejledning. Det ændrer ikke de gældende beregningsregler for EET, som fortsat er defineret i implementeringsdokumenterne.
