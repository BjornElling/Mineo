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

- **Folkepensionsalder** — brug ikke `folkepensionsalderAar`, `ophoersalderAarLabel` eller tilsvarende felter i tabelfiler. Folkepensionsalder er tværdomæne og håndteres udelukkende via `src/data/folkepensionAlderRates.ts` (`getFolkepensionAlder`, `getFolkepensionsdato`, `getDagenFoerFolkepensionsdato`). Filen ligger bevidst i `src/data/` og ikke under `src/data/kapitalisering/` — den er ikke kapitaliseringsspecifik.
- **Afledte aldersbegreber** — ophoersalder, pensionsdato og lign. må ikke udledes eller hardkodes i tabelfiler. Disse beregnes altid dynamisk via ovenstående centrale kilde.

## Kendte undtagelser der skal dokumenteres i filerne

- Der findes kun én gyldig EET-kontrakt i programmet: `erhvervsevnetabTabelvalg`.
- Ældre bekendtgørelser skal stadig registreres i samme kontrakt som nyere bekendtgørelser. Programmet skal kunne beregne bagud i tid, men bekendtgørelser må aldrig registreres som en særskilt type.
- Hvis kilden arbejder med ophørsalder eller folkepensionsalder, må værdien ikke indlægges i `erhvervsevnetabTabelvalg`. Kontrollér i stedet, at `src/data/folkepensionAlderRates.ts` dækker den relevante lovperiode og fødselskohorte.
- Hvis kilden ikke har fødselsdato-intervaller, bruges stadig `erhvervsevnetabTabelvalg` med et eksplicit bredt fødselsinterval i data i stedet for en særskilt alternativ export.
- For VEJ `9921/2019` og `9870/2020` er 2020 bevidst opdelt i to intervaller:
  - `9921/2019` dækker `2020-01-01` til `2020-12-30`.
  - `9870/2020` dækker kun `2020-12-31`.
- For VEJ `9921/2019` og `9870/2020` udfyldes ikke ekstra EET-tabelvalg for ældre ordninger, forsørgertab-tabelvalg eller særfaktor ved `<2 år`, når disse ikke fremgår eksplicit af kilden.
- For VEJ `9820/2023` og `9376/2024` kan filernes `gyldig`-intervaller overlappe i anden halvdel af 2024; deterministisk prioritering skal styres i `src/data/kapitalisering/kapitaliseringsbekendtgoerelser.ts` med skæringsdato `2024-07-01`.
- For VEJ `9741/2020`, `9864/2021`, `10141/2022` og `9820/2023` er tabelvalg bevidst begrænset til skadedatoer fra `2011-01-01`, når kilden kun angiver tabeller `A-H`.
- `forsoergertabAfloesningsTabeller = {}` betyder, at kilden ikke indeholder afløsningstabeller for den bekendtgørelse/vejledning.
- Hvis kilden kun angiver kønsopdelte afløsningstabeller, skal de bevares i `forsoergertabAfloesningsTabellerKoensopdelt` (ingen sammenfletning til kønsneutral tabel).
- Hvis kilden kun har én EET-tabel med formuleringer som `tilkendt til det 65. år, men uden omsætningsmulighed efter 63. år` eller `uden omsætningsmulighed fra det 63. år`, skal ophørsalderen stadig udtrækkes, og tabelvalget udtrykkes i `erhvervsevnetabTabelvalg`. I disse kilder kan fødselsintervallet være bredt, fordi fødselsdato ikke er en reel del af opslagsnøglen i kilden.

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

Alle filer skal have samme struktur og eksportnavne:

```ts
// Eksemplet nedenfor er et illustrativt udsnit af strukturen.
// I faktiske filer skal tabelindhold altid være 1:1 fra kilden (ingen udfyldning/genbrug).
import type { ISODateString } from '../../../types/branded';
import { toISODateString } from '../../../types/branded';
import type { AldersFaktorRaekke, AldersKoensopdeltFaktorRaekke, ForsoergertabMatrixRaekke } from '.';

export const kapitaliseringsId = '10029/2024' as const;
export const kapitaliseringsType = 'vejl' as const;
export const kapitaliseringsFuldeNavn =
  'Vejledning om omsætning af løbende erstatning til kapitalbeløb i 2025 i sager om arbejdsskader' as const;
export const kapitaliseringsDatering = '06/12/2024' as const; // eksempelværdi
export const gyldigFra = toISODateString('2025-01-01');
export const gyldigTil = toISODateString('2025-12-31');

const ERHVERVSEVNETAB_TABELVALG_DATA = [
  // skadedatoFra     foedselsdatoFra     tabel
  ['2021-01-01',     '1967-01-01',     'A'],
  ['2011-01-01',     '1967-01-01',     'F'],
] as const;

export const erhvervsevnetabTabelvalg = ERHVERVSEVNETAB_TABELVALG_DATA.map(
  ([skadedatoFra, foedselsdatoFra, tabel]) => ({
    skadedatoFra: toISODateString(skadedatoFra),
    foedselsdatoFra: toISODateString(foedselsdatoFra),
    tabel,
  })
);

const FORSOERGERTAB_TABELVALG_DATA = [
  // skadedatoFra     tabel
  ['2021-01-01',     'E'],
  ['2011-01-01',     'J'],
] as const;

export const forsoergertabTabelvalg = FORSOERGERTAB_TABELVALG_DATA.map(
  ([skadedatoFra, tabel]) => ({
    skadedatoFra: toISODateString(skadedatoFra),
    tabel,
  })
);

const SAERFAKTOR_UNDER_TO_AAR_DATA = [
  // skadedatoFra     faktor
  ['2021-01-01',     1.245],
  ['2011-01-01',     1.245],
] as const;

export const saerfaktorUnderToAarTilFpPerSkadesinterval: ReadonlyArray<{
  skadedatoFra: ISODateString;
  faktor: number;
}> = SAERFAKTOR_UNDER_TO_AAR_DATA.map(([skadedatoFra, faktor]) => ({
  skadedatoFra: toISODateString(skadedatoFra),
  faktor,
}));

export const erhvervsevnetabTabeller = {
  A: [
    { alder: 16, faktor: 15.123 },
    { alder: 17, faktor: 14.876 },
  ],
  B: [
    { alder: 16, faktor: 14.982 },
    { alder: 17, faktor: 14.740 },
  ],
} as const satisfies Record<string, readonly AldersFaktorRaekke[]>;

export const forsoergertabTabeller = {
  // Kolonne 1: Fyldt alder
  // Kolonne 2: Resterende erstatningsperiode, antal hele år
  E: [
    { alder: 18, faktorerPraHeleAar: [0.627, 1.262, 1.906] },
    { alder: 19, faktorerPraHeleAar: [0.627, 1.262, 1.906] },
  ],
} as const satisfies Record<string, readonly ForsoergertabMatrixRaekke[]>;

export const forsoergertabAfloesningsTabeller = {
  Æ: [
    { alder: 55, faktor: 1.39 },
    { alder: 56, faktor: 1.539 },
  ],
} as const satisfies Record<string, readonly AldersFaktorRaekke[]>;

// Filer med kønsopdeling skal desuden eksportere:
export const erhvervsevnetabKoensopdelteTabeller = {} as const satisfies Record<
  string,
  readonly AldersKoensopdeltFaktorRaekke[]
>;
export const forsoergertabTabellerMaend = {} as const satisfies Record<
  string,
  readonly ForsoergertabMatrixRaekke[]
>;
export const forsoergertabTabellerKvinder = {} as const satisfies Record<
  string,
  readonly ForsoergertabMatrixRaekke[]
>;
export const forsoergertabAfloesningsTabellerKoensopdelt = {} as const satisfies Record<
  string,
  readonly AldersKoensopdeltFaktorRaekke[]
>;
```

Præcisering for filer med ældre bekendtgørelser:

- Hvis kilden kun har kønsopdelte EET-tabeller, skal `erhvervsevnetabTabeller` være tom (`{}`), og kønsopdelte data skal ligge i `erhvervsevnetabKoensopdelteTabeller`.
- Hvis kilden kun har kønsopdelte forsørgertabstabeller, skal `forsoergertabTabeller` være tom (`{}`), og data skal ligge i `forsoergertabTabellerMaend` og/eller `forsoergertabTabellerKvinder`.
- Hvis kilden har både kønsneutrale og kønsopdelte tabeller, skal begge datatyper bevares i hver deres eksport uden transformation.
- Alle bekendtgørelser, også ældre, skal bruge `erhvervsevnetabTabelvalg`.
- Brug et eksplicit bredt fødselsinterval i `erhvervsevnetabTabelvalg`, når kilden ikke arbejder med fødselsdato som egentlig opslagsnøgle.

## Krav til tabellignende layout (læsbart i kode)

- Tabeller skrives som blokke med tydelig visuel struktur.
- Hver række er ét objekt på én linje.
- Kolonner holdes visuelt på linje når muligt.
- Ingen kompakt/minificeret arraysyntaks.
- Tabelvalg-data skal skrives som grid-arrays (`const ..._DATA`) med **fast 5 mellemrum** mellem kolonner.
- Grid-data skal have en header-kommentarlinje med kolonnenavne.
- Rækkefølge i filen er bindende:
1. metadata exports
2. `..._TABELVALG_DATA` + mapped exports
3. `...SAERFAKTOR..._DATA` + mapped export
4. selve tabel-exports (inkl. kønsopdelte exports når relevante)
- Tabeller fra kilden skal bevares, også hvis de ikke er refereret i det aktuelle tabelvalg. Tilføj en kort kommentar ved tabellerne om dette.
- Før første forsørgertabstabel i `forsoergertabTabeller` skal kolonneforklaringen stå:
  - `Kolonne 1: Fyldt alder`
  - `Kolonne 2: Resterende erstatningsperiode, antal hele år`

Eksempel:

```ts
const FORSOERGERTAB_TABELVALG_DATA = [
  // skadedatoFra     tabel
  ['2021-01-01',     'E'],
  ['2011-01-01',     'J'],
] as const;
```

## Integrationstrin efter ny fil

Når en ny fil er udtrukket:

1. Læg filen i `src/data/kapitalisering/kapitaliseringsTabeller/`.
2. Opdater `src/data/kapitalisering/kapitaliseringsbekendtgoerelser.ts` med korrekt `id` og relevante `kapitaliseringsdatoFra`-poster.
3. Verificer at den nye fil ikke indeholder folkepensionsalder/ophørsalder i sine EET-tabelvalg, og at `src/data/folkepensionAlderRates.ts` dækker opslagsperioden.
4. Verificer at udløbsreglen for seneste post stadig er opfyldt.
5. Kør `npm run typecheck`.

## Promptskabelon til fremtidige udtræk

Brug denne arbejdsprompt internt når du får ny tekst:

```md
Opgave: Udtræk kapitaliseringsdata fra vedlagte tekst og lever en compile-klar TypeScript-fil i formatet `xxxx-yyyy.ts`.

Krav:
- Brug præcis den faste kodekontrakt fra `docs/tilfoej-kapitaliseringsbekendtgoerelse.md`.
- Ingen antagelser ved tvivl; markér i stedet manglende/uklare felter.
- Folkepensionsalder/ophørsalder skal håndteres via `src/data/folkepensionAlderRates.ts`; kapitaliseringstabelfilen må kun indeholde tabelvalg og faktortabeller.
- Bevar numerisk præcision fra kilden.
- Output skal være tabellignende og menneskeligt læsbart.
- Brug `id` som `nummer/år` og filnavn som `nummer-år.ts`.
```

## Afgrænsning

Dette dokument beskriver udtræk og strukturering af tabelfiler pr. bekendtgørelse/vejledning. Det ændrer ikke de gældende beregningsregler for EET, som fortsat er defineret i implementeringsdokumenterne.
