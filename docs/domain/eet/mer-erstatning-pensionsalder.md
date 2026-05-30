# Mer-erstatning ved forhøjet folkepensionsalder (fane 5)

Denne fil beskriver beregningslogikken for mer-erstatning ved forhøjet folkepensionsalder.
Beregningen er et fradrag (fradrag 4) i differencekravet på fane 5.

Se også:
- [differencekrav.md](./differencekrav.md) — fane 5, hovedberegning
- [kapitaliseret-eet.md](./kapitaliseret-eet.md) — fane 3, den kapitaliseringslogik der genbruges her
- [under-to-aar-til-fp.md](./under-to-aar-til-fp.md) — særregel for ≤ 2 år til folkepensionsalderen
- [fejlkatalog.md](./fejlkatalog.md) — alle fejl og advarsler

---

## Del 1 — For dig

### Hvad er mer-erstatning ved forhøjet folkepensionsalder?

Når et erhvervsevnetab kapitaliseres, beregnes kapitalbeløbet ud fra den folkepensionsalder, der
gælder på kapitaliseringstidspunktet. Kapitalbeløbet dækker den løbende ydelse frem til den
folkepensionsalder.

Hæver lovgiver senere folkepensionsalderen, dækker det allerede udbetalte kapitalbeløb en for kort
periode. Skadelidte har derfor krav på en mer-erstatning svarende til den ekstra periode mellem den
gamle og den nye folkepensionsalder.

Mer-erstatningen indregnes som et fradrag i differencekravet, fordi den udgør en ydelse skadelidte
har modtaget (eller har krav på at modtage) i ASL-sporet, og som derfor skal modregnes i det
EAL-baserede differencekrav.

Indregningen styres af valgmuligheden **"Indregn mer-erstatning ved forhøjet pensionsalder"** på
differencekrav-fanen (sektion "Valgmuligheder"). Valget er sagsdata på erhvervsevnetab-sektionen,
gemmes i `.eo` og følger med sagen. Default for nye sager er `true`; ældre `.eo`-filer uden feltet
får `true` ved load.

### Hvornår udløses mer-erstatning?

For hver kapitaliseret EET-afgørelse vurderes hver kendt folkepensionsalder-forhøjelse. En forhøjelse
udløser mer-erstatning for den pågældende kapitalisering, når **alle** følgende er opfyldt:

1. Forhøjelsesdatoen ligger **efter** kapitaliseringsdatoen (datosammenligning — også hvis det er
   samme kalenderår).
2. Forhøjelsesdatoen ligger **på eller før** beregningsdatoen.
3. Forhøjelsen hæver den folkepensionsalder, kapitaliseringstabellerne regner med (den gamle
   kapitalværdi er lavere end den nye).

Er valgmuligheden slået fra, beregnes og vises ingen mer-erstatning.

### Hvordan beregnes beløbet?

Mer-erstatningen for én forhøjelse er forskellen mellem to kapitalværdier af den **samme**
løbende ydelse — én opgjort til den nye (forhøjede) folkepensionsalder og én til den hidtidige:

```
mer-erstatning = kapitalværdi(ny folkepensionsalder) − kapitalværdi(hidtidig folkepensionsalder)
```

Begge kapitalværdier beregnes:
- på forhøjelsens **forhøjelsesdato**,
- med **samme kapitaliseringsprocent** som den faktiske kapitalisering (fra fane 3),
- med **samme løbende ydelse** (årsydelse). Kun kapitaliseringsfaktoren — og dermed
  kapitalværdien — er forskellig, fordi den nye og den gamle bekendtgørelse henfører skadelidte
  til hver sin tabel med hver sin folkepensionsalder.

Den løbende ydelse (årsydelsen) reguleres til satsåret, der er **kalenderåret 1 måned efter
forhøjelsesdatoen**. For forhøjelsen pr. 29-12-2015 er satsåret derfor 2016 (29-01-2016).

Rammer flere forhøjelser den samme kapitalisering (fordi der er gået flere forhøjelser mellem
kapitalisering og beregningsdato), beregnes hver forhøjelse for sig, og beløbene summeres.

### Folkepensionsalder-forhøjelser i modellen

| Forhøjelse | Forhøjelsesdato | Hidtidig | Forhøjet | Bekendtgørelse (gammel → ny) |
|---|---|---|---|---|
| 67 → 68 | 29-12-2015 | 67 år | 68 år | Bkg. 198/2015 → Bkg. 1700/2015 |
| 68 → 69 | 31-12-2020 | 68 år | 69 år | bekendtgørelse pr. 30-12-2020 → 31-12-2020 |
| 69 → 70 | 31-12-2025 | 69 år | 70 år | Vejl. 10029/2024 → Vejl. 10183/2025 |

Indfasningen fra 65 til 67 år (L 485/2009, virkning 1. juli 2009) udløser **ikke** mer-erstatning
efter denne model: de dagældende kapitaliseringstabeller afspejlede ikke en forhøjet
folkepensionsalder, og betingelse 3 er derfor ikke opfyldt.

#### Bemærkning om 69 → 70

Loven hævede folkepensionsalderen pr. 31-12-2025. Vejl. 10183/2025 gælder specifikt for
kapitalisering den 31-12-2025 og indeholder tabeller til det 70. år for de berørte årgange. Den
gamle og den nye bekendtgørelse parres derfor i datakilden (se `forhoejetPensionsalderEvents.ts`),
så den gamle kapitalværdi opslås i Vejl. 10029/2024 (kun til 69 år, opslagsdato 30-12-2025) og den
nye i Vejl. 10183/2025 (til 70 år, opslagsdato 31-12-2025). Selve beregningen sker på
forhøjelsesdatoen 31-12-2025 (satsår 2026).

### Autoritativt eksempel

| Trin | Værdi |
|---|---|
| Skadedato | Mellem 01-01-2004 og 30-06-2007 → erstatningsniveau 80 %, intet AM-bidrag |
| Forhøjelse | 67 → 68 pr. 29-12-2015 (Bkg. 198/2015 → Bkg. 1700/2015) |
| Alder pr. 29-12-2015 | 41 år, 10 måneder |
| Grundløn | 251.580 kr. |
| Kapitaliseret | 25 % |
| Løbende ydelse i 2016 (satsår) | 251.580 × 25 % × 80 % × 137,60 % = **69.234,82 kr.** |
| Kapitalværdi til 67 år (Bkg. 198/2015, Tabel G, faktor 9,388) | 69.234,82 × 9,388 = **649.976,49 kr.** |
| Kapitalværdi til 68 år (Bkg. 1700/2015, Tabel H, faktor 9,452) | 69.234,82 × 9,452 = **654.407,52 kr.** |
| **Mer-erstatning** | 654.407,52 − 649.976,49 = **4.431 kr.** |

Dette eksempel er normativt. Afviger beregningsmodellen fra dette resultat, er beregningsmodellen
forkert.

### Afrunding

- Den løbende årsydelse afrundes til 2 decimaler (som fane 3).
- Hver kapitalværdi beregnes som `round2(årsydelse × kapitaliseringsfaktor)` — altså med 2
  decimaler, **ikke** `ceil0` til hel krone som ved et almindeligt kapitalbeløb i fane 3. Det er
  her differencen, der er kravet, og eksemplet viser kapitalværdierne med 2 decimaler.
- Mer-erstatningen pr. forhøjelse afrundes til hel krone: `round0(ny − gammel)`.

---

## Del 2 — AI-agent: teknisk reference

### Primære filer

| Fil | Ansvar |
|---|---|
| `src/data/kapitalisering/forhoejetPensionsalderEvents.ts` | Eksplicit datatabel over forhøjelser: forhøjelsesdato, opslagsdato for gammel/ny bekendtgørelse, alderslabels. |
| `src/domain/erhvervsevnetab/eetMerErstatningPensionsalderCalculation.ts` | `computeMerErstatningPensionsalder()` — beregner mer-erstatningen pr. kapitalisering pr. forhøjelse. |
| `src/domain/erhvervsevnetab/eetDifferencekravCalculation.ts` | Kører fradrag 4 og trækker `samletMerErstatning` fra differencekravet. |
| `src/pdf/domains/differencekrav/differencekravPdf.ts` | Hoved-side-fradragslinje og valgfrit bilag. |
| `src/components/pages/erhvervsevnetab/EetDifferencekravTab.tsx` | Specifikationssektion, bilagsvalg og detaljeret visningsboks. |

### Internt flow

1. `computeEetDifferencekravCalculation` kører fane 3 (kapitalisering) og samler de faktisk
   kapitaliserede afgørelser med kapitaliseringsdato ≤ beregningsdato.
2. Hvis valgmuligheden er slået til, kaldes `computeMerErstatningPensionsalder` med disse
   kapitaliseringer (rowId, afgørelsesdato, kapitaliseringsdato, kapitaliseringspct, grundløn,
   erstatningsniveau, AM-bidrag — alle hentet fra fane 3's computation).
3. For hver kapitalisering × hver forhøjelse:
   - betingelse 1 (forhøjelsesdato > kapitaliseringsdato) og 2 (≤ beregningsdato) tjekkes,
   - kapitaliseringsfaktoren opslås for både `opslagsdatoGammel` og `opslagsdatoNy` via
     `resolveFaktorForBekendtgoerelse` (genbruger fane 3's faktor-regler: tabelvalg,
     interpolation, ekstrapolation mod særfaktor, direkte særfaktor ≤ 2 år til FP),
   - betingelse 3 (ny faktor > gammel faktor) tjekkes,
   - årsydelsen beregnes via `resolveKapitaliseringAarsydelseBreakdown` med satsår = året
     1 måned efter forhøjelsesdatoen,
   - kapitalværdier og mer-erstatning beregnes og lægges i `events`.
4. `samletMerErstatning` trækkes fra differencekravet sammen med de øvrige fradrag.

### Robusthed

Mer-erstatningen genbruger allerede validerede stamdata. Skulle et faktoropslag alligevel fejle,
udelades den pågældende forhøjelse, så et forkert (for lavt) fradrag aldrig anvendes. Beregningen
nulstiller ikke hele differencekravet.

### Implementeringsstatus

Dokumentationen beskriver den implementerede forretningslogik. Hvis dokumentation og kode afviger,
er denne fil den normative beskrivelse af forretningslogikken.

### Tests

`src/__tests__/domain/erhvervsevnetab/eetMerErstatningPensionsalderCalculation.test.ts`

Dækker det autoritative 4.431 kr.-eksempel (inkl. delresultaterne 69.234,82 / 649.976,49 /
654.407,52 og faktorerne 9,388 / 9,452) samt betingelserne for hvornår en forhøjelse medtages.

---

## Kendte udeståender

Dokumentationen afspejler den fastlagte forretningslogik. Fremtidige folkepensionsalder-forhøjelser
tilføjes som nye poster i `forhoejetPensionsalderEvents.ts`.
