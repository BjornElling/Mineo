# EET – Fejlkatalog

Denne fil er den autoritative kilde til alle fejl og advarsler i EET-beregningerne. Den erstatter fejlbeskrivelserne der tidligere var spredt på tværs af implementeringsfilerne.

**Forkortelser:** F2 = Løbende ydelser, F3 = Kapitalisering, F4 = EET efter EAL, F5 = Differencekrav.

---

## Del 1 – For dig

### Terminologi

| Begreb | Forklaring |
|---|---|
| **Fejl** | Rød ikon (`ErrorOutline`). Blokerer beregning og download på den pågældende fane. |
| **Advarsel** | Orange ikon (`WarningAmber`). Blokerer ikke beregning. |
| **Felt-fejl** | Afledt rent fra `InputReader`, feltdescriptors og domænevalidatorer (jf. `src/contracts/error-contract.md`). Vises både inline på fane 1 og i fejlboksen på beregningsfanerne. |
| **Beregningsfejl** | Produceret af `computeXxx`-funktionen. Vises kun i fejlboksen. |

### Principper

- Alle fejl og advarsler med ét entydigt årsagsfelt har et navigationslink til netop det felt. Regler med flere mulige årsagsfelter (fx flere afgørelsesrækker) bruger i stedet deres fælles sektion som ærligt anker. Begge mål blinkmarkeres efter navigationen. Fejl der udelukkende skyldes manglende systemdata (satser mv.), peger ikke på et brugerfelt.
- `alder-unresolved` undertrykkes hvis `skadelidte-fodselsdato-missing` eller `skadedato-missing` allerede er aktiv – den afledte fejl er redundant.
- `warn-eal-aarsloen-empty-for-2024-07-01` undertrykkes ikke af `aarsloen-missing` – de to kan vises samtidigt.
- `eet-pct-missing` undertrykkes på F5 hvis `asl-afgoerelser-empty` er aktiv.
- På F5 filtreres `no-endelig-afgoerelser` og `warn-ingen-kap-input` altid fra.

---

## Del 2 – Fejl

### Stamdata

#### `skadedato-missing` – "Skadedato er ikke udfyldt."
| Felt | Værdi |
|---|---|
| Type | Fejl |
| Vises på | F2, F3, F4, F5 |
| Navigationslink | Stamdata → Skadelidte |
| Betingelse | `skadedato` fra stamdata er ikke udfyldt |

#### `skadelidte-fodselsdato-missing` – "Fødselsdato er ikke udfyldt."
| Felt | Værdi |
|---|---|
| Type | Fejl |
| Vises på | F2, F3, F4, F5 |
| Navigationslink | Stamdata → Skadelidte |
| Betingelse | `fodselsdato` fra stamdata-sektionen er ikke udfyldt |

#### `alder-unresolved` – "Alder på skadestidspunkt kan ikke beregnes."
| Felt | Værdi |
|---|---|
| Type | Fejl |
| Vises på | F4, F5 |
| Navigationslink | Stamdata → Skadelidte |
| Betingelse | Afledt fejl: fødselsdato og skadedato begge udfyldt men alder kan alligevel ikke beregnes (datoparse-fejl). Undertrykkes hvis `skadelidte-fodselsdato-missing` eller `skadedato-missing` er aktiv. F2 og F3 bruger ikke alder og emitterer ikke denne fejl. |

#### `stamdata-date-order:skadedato` og `stamdata-date-order:skadelidteFodselsdato` – "Skadedato er før fødselsdato."
| Felt | Værdi |
|---|---|
| Type | Fejl |
| Vises på | F2, F3, F4, F5 |
| Navigationslink | Det konkrete felt på Stamdata → Skadelidte |
| Betingelse | Både skadedato og fødselsdato er udfyldt, men skadedatoen ligger før fødselsdatoen. Samme regel afspejles som afledt feltfejl på begge felter. |

---

### Grundlæggende oplysninger (fane 1)

#### `beregningsdato-missing` – "Beregningsdato er ikke udfyldt."
| Felt | Værdi |
|---|---|
| Type | Fejl |
| Vises på | F2, F4, F5 |
| Navigationslink | EET oplysninger → Grundlæggende oplysninger |
| Betingelse | `!beregningsdato`. F3 bruger ikke beregningsdato. Når F2-kernen bruges gennem EET-importportens eksplicitte `eo_import`-context, leveres TAF-slutdatoen som fallback-beregningsdato, så fejlen kun emitteres dér, hvis både beregningsdato og fallback-slutdato mangler. Se `eo-snapshot-contract.md` §13. |

#### `beregningsdato-invalid` – "Beregningsdato er ugyldig."
| Felt | Værdi |
|---|---|
| Type | Fejl |
| Vises på | F5 |
| Navigationslink | EET oplysninger → Grundlæggende oplysninger |
| Betingelse | Beregningsdato er udfyldt men kan ikke parses. Opstår på F5 som fallback når `dagFørBeregningsdato` ikke kan beregnes. |

---

### Arbejdsskadesikringsloven

#### `aarsloen-missing` – "Skadelidtes årsløn (efter ASL) er ikke udfyldt"
| Felt | Værdi |
|---|---|
| Type | Fejl |
| Vises på | F2, F3, F4, F5 |
| Navigationslink | EET oplysninger → Arbejdsskadesikringsloven |
| Betingelse F2, F3 | `!Number.isFinite(aslAarsloenRaw)` |
| Betingelse F4, F5 | `aarsloen.value === null` – hverken EAL-årsløn > 0 eller ASL-årsløn > 0 |

#### `aarsloen-zero` – "Skadelidtes årsløn (efter ASL) skal være større end 0 kr"
| Felt | Værdi |
|---|---|
| Type | Fejl |
| Vises på | F2, F3, F4, F5 |
| Navigationslink | EET oplysninger → Arbejdsskadesikringsloven |
| Betingelse F2, F3 | `aslAarsloenRaw === 0` |
| Betingelse F4, F5 | `ealAarsloenRaw === undefined` og `aslAarsloenRaw <= 0`. Hvis EAL-årslønnen er udfyldt med 0 eller negativ, emitteres i stedet `eal-aarsloen-zero`. |

#### `aarsloen-max-missing` – "Maksimum årsløn mangler for år {år}."
| Felt | Værdi |
|---|---|
| Type | Fejl |
| Vises på | F2, F3 |
| Navigationslink | – (systemfejl) |
| Betingelse | Maks. årsløn for skadesåret mangler i datakonstanterne |

#### `aarsloen-over-max` – "Skadelidtes årsløn (efter ASL) kan ikke overstige maks årslønnen i skadesåret ({beløb} kr.)"
| Felt | Værdi |
|---|---|
| Type | Fejl |
| Vises på | F2, F3 |
| Navigationslink | EET oplysninger → Arbejdsskadesikringsloven |
| Betingelse | En direkte beregningskaldssti modtager en ASL-årsløn over maksimum for skadesåret. Den normale reader-sti viser samme regel som en rød feltfejl, før motoren kaldes. |

#### `asl-afgoerelser-empty` – "Ingen ASL-afgørelser er indtastet."
| Felt | Værdi |
|---|---|
| Type | Fejl |
| Vises på | F2, F3, F5 |
| Navigationslink | EET oplysninger → Arbejdsskadesikringsloven |
| Betingelse | Alle rækker i afgørelsestabellen er tomme. På F5 undertrykker denne `eet-pct-missing`. |

#### `no-asl-afgoerelser-known-at-beregningsdato` – "Der er ingen ASL-afgørelser med virkningsdato på eller før beregningsdatoen."
| Felt | Værdi |
|---|---|
| Type | Fejl |
| Vises på | F5 |
| Navigationslink | EET oplysninger → Arbejdsskadesikringsloven |
| Betingelse | Alle ASL-afgørelser har virkningsdato efter beregningsdatoen. F5 kan derfor ikke fastlægge den relevante afgørelse på beregningsdatoen. |

#### `missing-afgoerelsesdato` – "Der er en afgørelse uden afgørelsesdato."
| Felt | Værdi |
|---|---|
| Type | Fejl |
| Vises på | F2, F3, F5 |
| Navigationslink | EET oplysninger → Arbejdsskadesikringsloven |
| Betingelse | Mindst én påbegyndt række mangler afgørelsesdato |

#### `missing-eet-pct` – "Der er en afgørelse uden EET %."
| Felt | Værdi |
|---|---|
| Type | Fejl |
| Vises på | F2, F3, F5 |
| Navigationslink | EET oplysninger → Arbejdsskadesikringsloven |
| Betingelse | Mindst én påbegyndt række mangler EET % (tom eller 0) |

#### `missing-afgoerelseType` – "Der er en afgørelse uden afgørelsestype."
| Felt | Værdi |
|---|---|
| Type | Fejl |
| Vises på | F2, F3, F5 |
| Navigationslink | EET oplysninger → Arbejdsskadesikringsloven |
| Betingelse | Mindst én påbegyndt række mangler afgørelsestype |

#### `asl-identiske-afgoerelser` – "Der er angivet to identiske afgørelser med samme afgørelsesdato og virkningsdato."
| Felt | Værdi |
|---|---|
| Type | Fejl |
| Vises på | F2, F3, F5 |
| Navigationslink | EET oplysninger → Arbejdsskadesikringsloven |
| Betingelse F2, F3 | To rækker har identisk afgørelsesdato **og** virkningsdato. Afgørelsestype indgår ikke. |
| Betingelse F5 | Samme som F2/F3, men kun når `ealEetPct` ikke er udfyldt eller er 0, fordi EAL ellers ikke bruger afgørelsestabellen. |

#### `no-endelig-afgoerelser` – "Ingen endelig eller delvist endelig afgørelser indtastet."
| Felt | Værdi |
|---|---|
| Type | Fejl |
| Vises på | F3 (filtreres fra F5) |
| Navigationslink | EET oplysninger → Arbejdsskadesikringsloven |
| Betingelse | Rækker med EET % findes, men ingen er `Endelig` eller `Delvist endelig`. F5 filtrerer altid denne fejl fra – fane 5 kan opgøre rest-EET som fradrag 3 uafhængigt af om der tidligere er foretaget kapitalisering. |

#### `endelig-under-50-missing-kapitalisering` – "Endelig afgørelse under 50 % mangler oplysninger om kapitalisering."
| Felt | Værdi |
|---|---|
| Type | Fejl |
| Vises på | F2, F3, F5 |
| Navigationslink | EET oplysninger → Arbejdsskadesikringsloven |
| Betingelse | Mindst én Endelig afgørelse med EET % < 50 har hverken kap.dato eller kap.% udfyldt. Vises ikke hvis kun ét felt mangler – det fanges af `kap-dato-without-kap-pct` / `kap-pct-without-kap-dato`. |

#### `delvist-endelig-missing-kapitalisering` – "Der er angivet en delvist endelig afgørelse uden kapitalisering."
| Felt | Værdi |
|---|---|
| Type | Fejl |
| Vises på | F2, F3, F5 |
| Navigationslink | EET oplysninger → Arbejdsskadesikringsloven |
| Betingelse | Mindst én `Delvist endelig` afgørelse har hverken kap.dato eller kap.% udfyldt. |

#### `kap-dato-without-kap-pct` – "Der er indtastet kapitaliseringsdato men ikke -procent."
| Felt | Værdi |
|---|---|
| Type | Fejl |
| Vises på | F2, F3, F5 |
| Navigationslink | EET oplysninger → Arbejdsskadesikringsloven |
| Betingelse | Mindst én påbegyndt række (`Endelig` eller `Delvist endelig`) har kap.dato men ikke kap.%. Undertrykkes hvis `delvist-endelig-missing-kapitalisering` eller `endelig-under-50-missing-kapitalisering` er aktiv. |

#### `kap-pct-without-kap-dato` – "Der er indtastet kapitaliseringsprocent men ikke -dato."
| Felt | Værdi |
|---|---|
| Type | Fejl |
| Vises på | F2, F3, F5 |
| Navigationslink | EET oplysninger → Arbejdsskadesikringsloven |
| Betingelse | Mindst én påbegyndt række (`Endelig` eller `Delvist endelig`) har kap.% men ikke kap.dato. Undertrykkes som ovenfor. |

#### `missing-kap-dato` / `missing-kap-pct` – "Der mangler indtastning af kapitaliseringsdato." / "...kapitaliseringsprocent."
| Felt | Værdi |
|---|---|
| Type | Fejl |
| Vises på | F3, F5 |
| Navigationslink | EET oplysninger → Arbejdsskadesikringsloven |
| Betingelse | Der er `Endelig`/`Delvist endelig` afgørelser og noget kap.-input, men ingen rækker resulterer i en komplet kapitalisering, og ingen af de mere specifikke fejl er aktive. |

#### `missing-koen` – "Ved kapitalisering før 1. marts 2015 skal køn angives." (F3) / "Ved beregning før 1. marts 2015 skal køn angives." (F5)
| Felt | Værdi |
|---|---|
| Type | Fejl |
| Vises på | F3, F5 |
| Navigationslink | EET oplysninger → Arbejdsskadesikringsloven |
| Betingelse F3 | Mindst én afgørelses kap.dato er < 2015-03-01 og `koen` er ikke udfyldt |
| Betingelse F5 | `koen` mangler og `beregningsdato < '2015-03-01'` (proformaberegning) |
| Bemærkning | Samme issue-ID, forskellig beskedtekst på de to faner. |

#### `virkningsdato-after-tidlkap-dato` – "Ved genoptagelse af en tidligere afgørelse skal den oprindelige virkningsdato angives."
| Felt | Værdi |
|---|---|
| Type | Fejl |
| Vises på | F2, F3, F5 |
| Navigationslink | EET oplysninger → Arbejdsskadesikringsloven |
| Betingelse | Mindst én påbegyndt række har `tidlKapDato` udfyldt og `virkningsdato > tidlKapDato` |

#### `kap-dato-not-after-tidlkap-dato` – "Ved genoptagne afgørelser skal den nye kapitaliseringsdato angives."
| Felt | Værdi |
|---|---|
| Type | Fejl |
| Vises på | F2, F3, F5 |
| Navigationslink | EET oplysninger → Arbejdsskadesikringsloven |
| Betingelse | Mindst én påbegyndt række har `tidlKapDato` udfyldt og `kap.dato ≤ tidlKapDato` |

---

### Regulering og satser

#### `reguleringssats-missing` – "Reguleringssats mangler for år {år}" (F3, F4, F5) / `reguleringssats-missing-{år}` (F2, F5)
| Felt | Værdi |
|---|---|
| Type | Fejl |
| Vises på | F2, F3, F4, F5 |
| Navigationslink | – (systemfejl) |
| Betingelse | En påkrævet ASL-reguleringssats mangler. F2 og F5's restydelsesvariant bruger per-år-ID (fx `reguleringssats-missing-2024`), mens F3, F4 og F5's proformavariant bruger det generiske ID. |

#### `eet-max-missing` – "Maksimum for erhvervsevnetab mangler for år {år}."
| Felt | Værdi |
|---|---|
| Type | Fejl |
| Vises på | F4, F5 |
| Navigationslink | EET oplysninger → Grundlæggende oplysninger |
| Betingelse | `erhvervsevnetabMax` for beregningsåret mangler i datakonstanterne |

---

### Kapitalisering

#### `kapitaliseringsbekendtgoerelse-missing-control-date` – "Kapitaliseringsbekendtgørelse mangler for {dato}." (kontroldato)
| Felt | Værdi |
|---|---|
| Type | Fejl |
| Vises på | F3, F5 |
| Navigationslink | EET oplysninger → Arbejdsskadesikringsloven |
| Betingelse | Ingen bekendtgørelse dækker kombinationen skadedato × kontroldato (afgørelsesdato eller tidligere kap.dato) |

#### `kapitaliseringsbekendtgoerelse-missing-effective-date` – "Kapitaliseringsbekendtgørelse mangler for {dato}." (effektiv dato)
| Felt | Værdi |
|---|---|
| Type | Fejl |
| Vises på | F3, F5 |
| Navigationslink | EET oplysninger → Arbejdsskadesikringsloven |
| Betingelse | Som ovenfor, men for den effektive kapitaliseringsdato |

#### `kapitaliseringstabel-missing` – "Ingen kapitaliseringstabel i {id} matcher…"
| Felt | Værdi |
|---|---|
| Type | Fejl |
| Vises på | F3, F5 |
| Navigationslink | EET oplysninger → Arbejdsskadesikringsloven |
| Betingelse | Bekendtgørelsen eksisterer, men ingen tabel matcher skadedato × fødselsdato, eller tabellen har ingen faktorer |

#### `kapitaliseringsalder-under-minimum` – "Ingen kapitaliseringsfaktor indtastet for alder ({alder}) – tabellen starter ved {min} år."
| Felt | Værdi |
|---|---|
| Type | Fejl |
| Vises på | F3, F5 |
| Navigationslink | EET oplysninger → Arbejdsskadesikringsloven |
| Betingelse | Skadelidtes alder er lavere end tabellens mindste alder |

#### `kapitaliseringsfaktor-unresolved` – "Kapitaliseringsfaktor kan ikke beregnes…" (varierende tekst)
| Felt | Værdi |
|---|---|
| Type | Fejl |
| Vises på | F3, F5 |
| Navigationslink | EET oplysninger → Arbejdsskadesikringsloven |
| Betingelse | Faktoren kan ikke bestemmes: alder kan ikke beregnes, særfaktor mangler, ingen faktor i tabellen, interpolation fejler |

---

### Erstatningsansvarsloven

#### `eet-pct-missing` – "Erhvervsevnetabsprocent er ikke udfyldt."
| Felt | Værdi |
|---|---|
| Type | Fejl |
| Vises på | F4, F5 |
| Navigationslink | EET oplysninger → Erstatningsansvarsloven |
| Betingelse | `ealEetPct` ikke udfyldt, og seneste ASL-afgørelses EET % er tom eller 0. Undertrykkes på F5 hvis `asl-afgoerelser-empty` er aktiv. |

#### `eal-aarsloen-zero` – "EAL-årsløn må ikke være 0 kr."
| Felt | Værdi |
|---|---|
| Type | Fejl |
| Vises på | F4, F5 |
| Navigationslink | EET oplysninger → Erstatningsansvarsloven |
| Betingelse | `ealAarsloenRaw === 0`. Har forrang over `aarsloen-zero`. |

#### `eal-eet-pct-invalid` – "EET % skal være deleligt med 5." (EAL)
| Felt | Værdi |
|---|---|
| Type | Fejl |
| Vises på | F4, F5 |
| Navigationslink | EET oplysninger → Erstatningsansvarsloven |
| Betingelse | `ealEetPct` udfyldt men ikke deleligt med 5 (eller ikke heltal) |

#### `asl-selected-eet-pct-invalid` – "EET % skal være deleligt med 5." (ASL-afgørelse)
| Felt | Værdi |
|---|---|
| Type | Fejl |
| Vises på | F4, F5 |
| Navigationslink | EET oplysninger → Arbejdsskadesikringsloven |
| Betingelse | Den valgte ASL-fallback-afgørelses EET % er ikke deleligt med 5 |

#### `invalid-eet-pct` – "EET % er ugyldig."
| Felt | Værdi |
|---|---|
| Type | Fejl |
| Vises på | F2, F3, F5 |
| Navigationslink | EET oplysninger → Arbejdsskadesikringsloven |
| Betingelse | En påbegyndt ASL-afgørelsesrække har en EET-procent uden for 0–100, med decimaler eller uden delelighed med 5. |

#### `invalid-kap-pct` – "Kapitaliseringsprocenten er ugyldig."
| Felt | Værdi |
|---|---|
| Type | Fejl |
| Vises på | F2, F3, F5 |
| Navigationslink | EET oplysninger → Arbejdsskadesikringsloven |
| Betingelse | En ASL-afgørelsesrække har en kapitaliseringsprocent uden for 0–100, med decimaler eller uden delelighed med 5. |

#### `invalid-afgoerelse-type` – "En afgørelse har en ukendt afgørelsestype og kan derfor ikke beregnes sikkert."
| Felt | Værdi |
|---|---|
| Type | Fejl |
| Vises på | F2 |
| Navigationslink | EET oplysninger → Arbejdsskadesikringsloven |
| Betingelse | En direkte domænekaldssti modtager en afgørelsestype uden for det tilladte schema. Normal formularvalidering afviser værdien tidligere. |

---

### Fradrag 3-fejl (F5-specifikke)

Produceres af fradrag 3-beregningen i `computeEetDifferencekravCalculation`. Proforma-fejlene nedenfor opstår kun når rest-EET proformakapitaliseres, dvs. når beregningsdatoen ligger mere end 2 år før folkepension.

| Issue-ID | Meddelelse | Navigationslink |
|---|---|---|
| `proforma-kapitaliseringsbekendtgoerelse-missing` | "Der findes ingen gyldig kapitaliseringsbekendtgørelse for beregningsdatoen {dato}." / "Kapitaliseringsdata mangler for {id}." | EET oplysninger → Grundlæggende oplysninger |
| `proforma-kapitaliseringstabel-missing` | "Ingen kapitaliseringstabel matcher skadedato og fødselsdato på beregningsdatoen." / "Ingen kapitaliseringsfaktorer for tabel {tabel}." | EET oplysninger → Grundlæggende oplysninger |
| `proforma-kapitaliseringsalder-under-minimum` | "Ingen kapitaliseringsfaktor for alder ({alder}) – tabellen starter ved {min} år." | EET oplysninger → Grundlæggende oplysninger |
| `proforma-kapitaliseringsfaktor-unresolved` | Varierer | EET oplysninger → Grundlæggende oplysninger |

---

### Felt-fejl (afledt fra inputprojektionen)

Afledes af den fælles issueprojektion og vises foruden inline ved feltet på fane 1.

| Issue-ID | Felt | Vises på | Navigationslink |
|---|---|---|---|
| `field-skadelidte-fodselsdato` | Fødselsdato | F2, F3, F4, F5 | Stamdata → Skadelidte |
| `field-skadedato` | Skadedato | F2, F3, F4, F5 | Stamdata → Skadelidte |
| `field-beregningsdato` | Beregningsdato | F2, F4, F5 | EET oplysninger → Grundlæggende oplysninger |
| `field-aarsloen-asl` | ASL årsløn | F2, F3, F5 | EET oplysninger → Arbejdsskadesikringsloven |
| `field-asl-afgoerelser` | Afgørelsestabel | F2, F3, F5 | EET oplysninger → Arbejdsskadesikringsloven |
| `field-aarsloen-eal` | EAL årsløn | F4 | EET oplysninger → Erstatningsansvarsloven |
| `field-eal-eet-pct` | EET % (EAL) | F4 | EET oplysninger → Erstatningsansvarsloven |

---

## Del 3 – Advarsler

#### `warn-beregningsdato-foer-skadedato` – "Beregningsdatoen ligger før skadedatoen. Kravet opreguleres ikke – kontrollér datoerne."
| Felt | Værdi |
|---|---|
| Type | Advarsel |
| Vises på | F4, F5 |
| Navigationslink | EET oplysninger → Grundlæggende oplysninger |
| Betingelse | `beregningsdato < skadedato`. Beregningen fortsætter uden opregulering. |

#### `warn-asl-eet-under-15` – "Der er indtastet en afgørelse med < 15 % erhvervsevnetab."
| Felt | Værdi |
|---|---|
| Type | Advarsel |
| Vises på | F2, F3, F4, F5 |
| Navigationslink | EET oplysninger → Arbejdsskadesikringsloven |
| Betingelse F2, F3, F5 | Mindst én afgørelse med EET % > 0 har EET % < 15 |
| Betingelse F4 | `ealEetPct` ikke udfyldt og seneste ASL-afgørelse har EET % < 15. Hvis `ealEetPct` er udfyldt bruges `warn-eal-eet-under-15` i stedet. |

#### `warn-eal-eet-under-15` – "Der kan ikke tilkendes erhvervsevnetab under 15 %."
| Felt | Værdi |
|---|---|
| Type | Advarsel |
| Vises på | F4, F5 |
| Navigationslink | EET oplysninger → Erstatningsansvarsloven |
| Betingelse | `ealEetPct` udfyldt med værdi > 0 og < 15 |

#### `warn-invalid-eet-pct-after-2024-07-01` – "Der er indtastet en ugyldig EET-procent ({x} %) for skader fra 1. juli 2024."
| Felt | Værdi |
|---|---|
| Type | Advarsel |
| Vises på | F2, F3, F5 |
| Navigationslink | EET oplysninger → Arbejdsskadesikringsloven |
| Betingelse | `skadedato ≥ 2024-07-01` og mindst én afgørelse har EET % > 15 der ikke er deleligt med 10. Advarsel (ikke fejl) – 'hvad nu hvis'-beregninger kan have behov for det. |

#### `warn-non-endelig-after-endelig` – "Der er angivet en midlertidig eller delvist endelig afgørelse efter en endelig afgørelse."
| Felt | Værdi |
|---|---|
| Type | Advarsel |
| Vises på | F2, F3, F5 |
| Navigationslink | EET oplysninger → Arbejdsskadesikringsloven |
| Betingelse | Mindst én `Midlertidig` eller `Delvist endelig` afgørelse har afgørelsesdato efter den tidligste `Endelig` afgørelses dato |

#### `warn-afgoerelsesdato-after-beregningsdato` – "Der er angivet en afgørelsesdato efter beregningsdatoen."
| Felt | Værdi |
|---|---|
| Type | Advarsel |
| Vises på | F2, F3, F5 |
| Navigationslink | EET oplysninger → Arbejdsskadesikringsloven |
| Betingelse | Mindst én afgørelses afgørelsesdato er efter beregningsdato. Undertrykkes i erstatningsopgørelsens midlertidigt EET-import (beregningsdato = TAF-slutdato dér) – se `eo-snapshot-contract.md` §13. |

#### `warn-virkningsdato-after-beregningsdato` – "Der er angivet en virkningsdato efter beregningsdatoen."
| Felt | Værdi |
|---|---|
| Type | Advarsel |
| Vises på | F2, F3, F5 |
| Navigationslink | EET oplysninger → Arbejdsskadesikringsloven |
| Betingelse | Mindst én afgørelses virkningsdato er efter beregningsdato. Undertrykkes i erstatningsopgørelsens midlertidigt EET-import (beregningsdato = TAF-slutdato dér) – se `eo-snapshot-contract.md` §13. |

#### `warn-kap-dato-after-beregningsdato` – "Der er angivet en kapitaliseringsdato efter beregningsdatoen."
| Felt | Værdi |
|---|---|
| Type | Advarsel |
| Vises på | F3, F5 |
| Navigationslink | EET oplysninger → Arbejdsskadesikringsloven |
| Betingelse | Mindst én afgørelses kap.dato er udfyldt og er efter beregningsdato. Undertrykkes i erstatningsopgørelsens midlertidigt EET-import (beregningsdato = TAF-slutdato dér) – se `eo-snapshot-contract.md` §13. |

#### `warn-ingen-kap-input` – "Der er ikke angivet kapitaliseringsdato eller -procent for nogen afgørelse."
| Felt | Værdi |
|---|---|
| Type | Advarsel |
| Vises på | F3 (filtreres altid fra F5) |
| Navigationslink | EET oplysninger → Arbejdsskadesikringsloven |
| Betingelse | Der er påbegyndte rækker, men ingen har kap.dato eller kap.% udfyldt. ID: `WARN_NO_KAP_INPUT_ID` exporteret fra `eetKapitaliseringCalculation.ts`. |

#### `warn-kap-pct-under-15` – "Der er angivet kapitalisering med mindre end 15 %."
| Felt | Værdi |
|---|---|
| Type | Advarsel |
| Vises på | F3, F5 |
| Navigationslink | EET oplysninger → Arbejdsskadesikringsloven |
| Betingelse | Mindst én kapitaliseret afgørelse har kap.% > 0 og < 15 |

#### `warn-eal-aarsloen-empty-for-2024-07-01` – "For skader fra 1. juli 2024 og frem beregnes årsløn forskelligt efter EAL og ASL."
| Felt | Værdi |
|---|---|
| Type | Advarsel |
| Vises på | F4, F5 |
| Navigationslink | EET oplysninger → Erstatningsansvarsloven |
| Betingelse | `skadedato ≥ 2024-07-01` og `ealAarsloen` ikke udfyldt. Undertrykkes ikke af `aarsloen-missing`. |

#### `warn-eal-aarsloen-is-max` – "Skadelidtes årsløn efter EAL (hvis forskellig fra ASL) skal udfyldes med den fulde årsløn – ikke maks. årslønnen efter ASL"
| Felt | Værdi |
|---|---|
| Type | Advarsel |
| Vises på | F4, F5 |
| Navigationslink | EET oplysninger → Erstatningsansvarsloven |
| Betingelse | `ealAarsloen` er udfyldt og er præcis lig maks. årsløn for skadesåret |

#### `warn-asl-aarsloen-is-max` – "Skadelidtes årsløn efter EAL (hvis forskellig fra ASL) skal udfyldes med den fulde årsløn – ikke maks. årslønnen efter ASL" (ASL-fallback)
| Felt | Værdi |
|---|---|
| Type | Advarsel |
| Vises på | F4, F5 |
| Navigationslink | EET oplysninger → Erstatningsansvarsloven |
| Betingelse | `ealAarsloen` ikke udfyldt og `aslAarsloen` er præcis lig maks. årsløn for skadesåret |

---

## Del 4 – AI-agent: teknisk reference

### Deduplication

Issues deduplikeres på `severity + message` via `dedupeIssuesBySeverityAndMessage()` fra `src/utils/issueUtils.ts`. To issues med samme tekst men forskellig severity bevares begge.

### `EetIssue`-typen

```typescript
// src/domain/erhvervsevnetab/eetTypes.ts – Zod-udledt, ikke håndskrevet
export const eetIssueSchema = z.object({
  id: z.string().min(1),
  severity: z.enum(['error', 'warning']),
  message: z.string().min(1),
}).strict().readonly();

export type EetIssue = z.infer<typeof eetIssueSchema>;
```

### Produktion af issues

Alle `toIssue()` og `toWarning()` helper-funktioner er defineret lokalt i de respektive calculation-filer (ikke en delt helper) – de er identiske i struktur men ikke importeret fra en fælles kilde.

### Navigation

Navigation fra fejl-linje styres centralt af `resolveEetIssueNavigation(issueId)` i
`src/domain/erhvervsevnetab/eetFormatUtils.ts`. Den returnerer route, sektion og – når issuet har ét
ansvarligt input – `focusFieldAddress`, den kanoniske feltadresse. `EetIssuesBox` venter derefter på det
synlige felt og blinkmarkerer det; uden en entydig adresse blinkmarkeres det fælles sektionsanker i stedet.

### Tests

`src/__tests__/domain/erhvervsevnetab/eetAslAfgoerelser.test.ts` dækker felt-validering og row-niveau-validering.

---

## Status

*Filen er synkroniseret med koden.*
