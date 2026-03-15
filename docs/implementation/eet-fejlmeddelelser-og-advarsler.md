# EET — Fejlmeddelelser og advarsler: kortlægning

Struktureret efter fejlmeddelelse. For hver meddelelse fremgår det på hvilke faner den kan vises, under hvilke betingelser, og om den blokerer beregningen.

Fane 1 har ingen fejlboks — fejl vises inline ved det relevante felt og er ikke medtaget her.

**Forkortelser i "Vises på"-kolonnen:** F2 = Løbende ydelser, F3 = Kapitalisering, F4 = EET efter EAL, F5 = Differencekrav.

---

## Terminologi

| Begreb | Forklaring |
|---|---|
| **Fejl** | Rød ikon. Blokerer beregning og download på den pågældende fane. |
| **Advarsel** | Orange ikon. Blokerer ikke beregning. |
| **Felt-fejl** | Produceret af Zod-validering, eksponeret via `useFormFieldErrors`. Vises både inline på fane 1 og i fejlboksen på beregningsfanerne. |
| **Beregningsfejl** | Produceret af `computeXxx`-funktionen. Vises kun i fejlboksen. |
| **Navigationslink** | Klikbart link i fejlboksen der fører til den sektion brugeren skal rette i. `—` betyder intet link vises. |

---

## Principper

- Fejlmeddelelser på F5 er positivt definerede — F5 aggregerer issues fra F2, F3 og F4 og filtrerer derefter eksplicit visse fra (`no-endelig-afgoerelser`, `warn-ingen-kap-input`).
- Alle fejl skal have et navigationslink til det felt der udløste fejlen, også når fejlen er en afledt beregningsfejl. Undtagelse: fejl der udelukkende skyldes manglende systemdata som brugeren ikke kan rette.
- `alder-unresolved` undertrykkes implicit hvis `fodselsdato-missing` eller `skadesdato-missing` allerede er aktiv — den afledte fejl er redundant når rodårsagen er synlig.
- `warn-eal-aarsloen-empty-for-2024-07-01` undertrykkes hvis `eal-aarsloen-missing` (eller `aarsloen-missing`) er aktiv på samme fane — advarslen er redundant når fejlen allerede vises for det samme tomme felt.
- `eet-pct-missing` undertrykkes på F5 hvis `asl-afgoerelser-empty` er aktiv — der er ingen afgørelsestabel at hente EET % fra.

---

## Fejl

### Stamdata-side

### "Skadesdato er ikke udfyldt."

| | |
|---|---|
| **issue-id** | `skadesdato-missing` |
| **Type** | Fejl |
| **Vises på** | F2, F3, F4, F5 |
| **Navigationslink** | Stamdata → Skadelidte |

**Betingelse:** `skadesdato` fra stamdata-siden er ikke udfyldt.

---

### Stamdata-sektion

### "Fødselsdato er ikke udfyldt."

| | |
|---|---|
| **issue-id** | `fodselsdato-missing` |
| **Type** | Fejl |
| **Vises på** | F2, F3, F4, F5 |
| **Navigationslink** | Stamdata → Skadelidte |

**Betingelse:** `fodselsdato` fra stamdata-sektionen er ikke udfyldt.

---

### "Alder på skadestidspunkt kan ikke beregnes."

| | |
|---|---|
| **issue-id** | `alder-unresolved` |
| **Type** | Fejl |
| **Vises på** | F4, F5 |
| **Navigationslink** | Stamdata → Skadelidte |

**Betingelse:** Afledt fejl — opstår kun hvis fødselsdato og skadesdato begge er udfyldt men alderen alligevel ikke kan beregnes (datoparse-fejl). Undertrykkes hvis `fodselsdato-missing` eller `skadesdato-missing` er aktiv.

**Bemærkning:** På F2 og F3 bruges alder ikke til beregning og fejlen emitteres ikke.

---

### "Beregningsdato er ikke udfyldt."

| | |
|---|---|
| **issue-id** | `beregningsdato-missing` |
| **Type** | Fejl |
| **Vises på** | F2, F4, F5 |
| **Navigationslink** | EET oplysninger → Grundlæggende oplysninger |

**Betingelse:** `!beregningsdato`. F3 bruger ikke beregningsdato.

---

### "Beregningsdato er ugyldig."

| | |
|---|---|
| **issue-id** | `beregningsdato-invalid` |
| **Type** | Fejl |
| **Vises på** | F5 |
| **Navigationslink** | EET oplysninger → Grundlæggende oplysninger |

**Betingelse:** Beregningsdato er udfyldt men kan ikke parses til en gyldig dato. Opstår kun på F5 som fallback når `dagFoerBeregningsdato` ikke kan beregnes.

---

### Arbejdsskadesikringsloven

### "Årsløn er ikke udfyldt."

| | |
|---|---|
| **issue-id** | `aarsloen-missing` |
| **Type** | Fejl |
| **Vises på** | F2, F3, F4, F5 |
| **Navigationslink** | EET oplysninger → Arbejdsskadesikringsloven |

**Betingelse F2, F3:** `!Number.isFinite(aslAarsloenRaw)` — dvs. årsløn er tom eller ikke-numerisk.

**Betingelse F4, F5:** `aarsloen.value === null` — dvs. hverken EAL-årsløn (> 0) eller ASL-årsløn (> 0) er udfyldt. EAL benytter ASL-årsløn som fallback.

---

### "Årsløn må ikke være 0 kr."

| | |
|---|---|
| **issue-id** | `aarsloen-zero` |
| **Type** | Fejl |
| **Vises på** | F2, F3, F4, F5 |
| **Navigationslink** | EET oplysninger → Arbejdsskadesikringsloven |

**Betingelse F2, F3:** `aslAarsloenRaw === 0`.

**Betingelse F4, F5:** `aslAarsloenRaw === 0` (og `ealAarsloenRaw !== 0`). Hvis `ealAarsloenRaw === 0` emitteres i stedet `eal-aarsloen-zero`.

---

### "EAL-årsløn må ikke være 0 kr."

| | |
|---|---|
| **issue-id** | `eal-aarsloen-zero` |
| **Type** | Fejl |
| **Vises på** | F4, F5 |
| **Navigationslink** | EET oplysninger → Erstatningsansvarsloven |

**Betingelse:** `ealAarsloenRaw === 0`. Har forrang over `aarsloen-zero`.

---

### "Ingen ASL-afgørelser er indtastet."

| | |
|---|---|
| **issue-id** | `asl-afgoerelser-empty` |
| **Type** | Fejl |
| **Vises på** | F2, F3, F5 |
| **Navigationslink** | EET oplysninger → Arbejdsskadesikringsloven |

**Betingelse:** Alle rækker i afgørelsestabellen er tomme (ingen begyndte rækker). På F5 undertrykker denne fejl `eet-pct-missing`.

---

### "Der er en afgørelse uden afgørelsesdato."

| | |
|---|---|
| **issue-id** | `missing-afgoerelsesdato` |
| **Type** | Fejl |
| **Vises på** | F2, F3, F5 |
| **Navigationslink** | EET oplysninger → Arbejdsskadesikringsloven |

**Betingelse:** Mindst én påbegyndt række mangler afgørelsesdato.

---

### "Der er en afgørelse uden EET %."

| | |
|---|---|
| **issue-id** | `missing-eet-pct` |
| **Type** | Fejl |
| **Vises på** | F2, F3, F5 |
| **Navigationslink** | EET oplysninger → Arbejdsskadesikringsloven |

**Betingelse:** Mindst én påbegyndt række mangler EET % (tom eller 0).

---

### "Der er en afgørelse uden afgørelsestype."

| | |
|---|---|
| **issue-id** | `missing-afgoerelseType` |
| **Type** | Fejl |
| **Vises på** | F2, F3, F5 |
| **Navigationslink** | EET oplysninger → Arbejdsskadesikringsloven |

**Betingelse:** Mindst én påbegyndt række mangler afgørelsestype.

---

### "Der er angivet to identiske afgørelser."

| | |
|---|---|
| **issue-id** | `asl-identiske-afgoerelser` |
| **Type** | Fejl |
| **Vises på** | F2, F3, F4, F5 |
| **Navigationslink** | EET oplysninger → Arbejdsskadesikringsloven |

**Betingelse:** To rækker har identisk afgørelsesdato, virkningsdato **og** afgørelsestype (triplet). Blokerer på alle faner fordi sammenfaldende afgørelser skaber tvivl om beregningsgrundlaget.

---

### "Ingen endelig eller delvist endelig afgørelser indtastet."

| | |
|---|---|
| **issue-id** | `no-endelig-afgoerelser` |
| **Type** | Fejl |
| **Vises på** | F3 |
| **Navigationslink** | EET oplysninger → Arbejdsskadesikringsloven |

**Betingelse:** Der er rækker med EET %, men ingen er af typen Endelig eller Delvist endelig. Kapitaliseringsberegningen kræver mindst én af disse. Vises kun på F3 — F5 filtrerer denne fejl eksplicit fra, da F5 proformakapitaliserer uafhængigt af om der tidligere er foretaget kapitalisering.

---

### "Endelig afgørelse under 50 % mangler oplysninger om kapitalisering."

| | |
|---|---|
| **issue-id** | `endelig-under-50-missing-kapitalisering` |
| **Type** | Fejl |
| **Vises på** | F2, F3, F5 |
| **Navigationslink** | EET oplysninger → Arbejdsskadesikringsloven |

**Betingelse:** Mindst én Endelig afgørelse med EET % < 50 har hverken kap.dato eller kap.% udfyldt. Vises ikke hvis kun ét af felterne mangler — det fanges i stedet af `kap-dato-without-kap-pct` / `kap-pct-without-kap-dato`.

---

### "Der er angivet en delvist endelig afgørelse uden kapitalisering."

| | |
|---|---|
| **issue-id** | `delvist-endelig-missing-kapitalisering` |
| **Type** | Fejl |
| **Vises på** | F2, F3, F5 |
| **Navigationslink** | EET oplysninger → Arbejdsskadesikringsloven |

**Betingelse:** Mindst én Delvist endelig afgørelse har hverken kap.dato eller kap.% udfyldt. Vises ikke hvis kun ét af felterne mangler — det fanges i stedet af `kap-dato-without-kap-pct` / `kap-pct-without-kap-dato`.

---

### "Ved kapitalisering før 1. marts 2015 skal køn angives."

| | |
|---|---|
| **issue-id** | `missing-koen` |
| **Type** | Fejl |
| **Vises på** | F3, F5 |
| **Navigationslink** | EET oplysninger → Arbejdsskadesikringsloven |

**Betingelse F3:** Mindst én afgørelses kap.dato er før 2015-03-01 og `koen` er ikke udfyldt.

**Betingelse F5 (proforma):** `koen` mangler og enten beregningsdato < 2015-03-01, eller kapitaliseringstabellen er kønsopdelt.

---

### "EET % skal være deleligt med 5." *(ASL-afgørelse)*

| | |
|---|---|
| **issue-id** | `asl-selected-eet-pct-invalid` |
| **Type** | Fejl |
| **Vises på** | F4, F5 |
| **Navigationslink** | EET oplysninger → Arbejdsskadesikringsloven |

**Betingelse:** Den seneste ASL-afgørelses EET % er udfyldt men ikke deleligt med 5 (eller ikke et heltal).

---

### "Der er indtastet kapitaliseringsdato men ikke -procent."

| | |
|---|---|
| **issue-id** | `kap-dato-without-kap-pct` |
| **Type** | Fejl |
| **Vises på** | F2, F3, F5 |
| **Navigationslink** | EET oplysninger → Arbejdsskadesikringsloven |

**Betingelse:** Mindst én påbegyndt række (Endelig eller Delvist endelig) har kap.dato udfyldt men ikke kap.%.

**Undertrykkes hvis** `delvist-endelig-missing-kapitalisering` eller `endelig-under-50-missing-kapitalisering` er aktiv på samme fane — de mere specifikke fejl har forrang.

---

### "Der er indtastet kapitaliseringsprocent men ikke -dato."

| | |
|---|---|
| **issue-id** | `kap-pct-without-kap-dato` |
| **Type** | Fejl |
| **Vises på** | F2, F3, F5 |
| **Navigationslink** | EET oplysninger → Arbejdsskadesikringsloven |

**Betingelse:** Mindst én påbegyndt række (Endelig eller Delvist endelig) har kap.% udfyldt men ikke kap.dato.

**Undertrykkes hvis** `delvist-endelig-missing-kapitalisering` eller `endelig-under-50-missing-kapitalisering` er aktiv på samme fane.

---

### "Ved genoptagelse af en tidligere afgørelse skal den oprindelige virkningsdato angives."

| | |
|---|---|
| **issue-id** | `virkningsdato-after-tidlkap-dato` |
| **Type** | Fejl |
| **Vises på** | F2, F3, F5 |
| **Navigationslink** | EET oplysninger → Arbejdsskadesikringsloven |

**Betingelse:** Mindst én påbegyndt række har `tidlKapDato` udfyldt og virkningsdato > tidlKapDato.

---

### "Ved genoptagne afgørelser skal den nye kapitaliseringsdato angives."

| | |
|---|---|
| **issue-id** | `kap-dato-not-after-tidlkap-dato` |
| **Type** | Fejl |
| **Vises på** | F2, F3, F5 |
| **Navigationslink** | EET oplysninger → Arbejdsskadesikringsloven |

**Betingelse:** Mindst én påbegyndt række har `tidlKapDato` udfyldt og kap.dato ≤ tidlKapDato.

---

### "Der mangler indtastning af kapitaliseringsdato." / "...kapitaliseringsprocent."

| | |
|---|---|
| **issue-id** | `missing-kap-dato` / `missing-kap-pct` |
| **Type** | Fejl |
| **Vises på** | F3, F5 |
| **Navigationslink** | EET oplysninger → Arbejdsskadesikringsloven |

**Betingelse:** Der er Endelig/Delvist endelig afgørelser og der er angivet noget kap.-input, men ingen af rækkerne resulterer i en komplet kapitalisering (kap.dato + kap.% > 0 begge udfyldt), og ingen af de mere specifikke fejl (`delvist-endelig-missing-kapitalisering`, `endelig-under-50-missing-kapitalisering`, `kap-dato-without-kap-pct`, `kap-pct-without-kap-dato`) er aktive.

---

### Erstatningsansvarsloven

### "Erhvervsevnetabsprocent er ikke udfyldt."

| | |
|---|---|
| **issue-id** | `eet-pct-missing` |
| **Type** | Fejl |
| **Vises på** | F4, F5 |
| **Navigationslink** | EET oplysninger → Erstatningsansvarsloven |

**Betingelse:** `ealEetPct` er ikke udfyldt, og den seneste ASL-afgørelses EET % er tom eller 0 — dvs. hverken EAL- eller ASL-kilden kan levere en EET %. Undertrykkes på F5 hvis `asl-afgoerelser-empty` er aktiv.

---

### "EET % skal være deleligt med 5." *(EAL-beregning)*

| | |
|---|---|
| **issue-id** | `eal-eet-pct-invalid` |
| **Type** | Fejl |
| **Vises på** | F4, F5 |
| **Navigationslink** | EET oplysninger → Erstatningsansvarsloven |

**Betingelse:** `ealEetPct` er udfyldt men ikke deleligt med 5 (eller ikke et heltal).

---

### Kapitalisering

### "Kapitaliseringsbekendtgørelse mangler for {dato}." *(kontroldato)*

| | |
|---|---|
| **issue-id** | `kapitaliseringsbekendtgoerelse-missing-control-date` |
| **Type** | Fejl |
| **Vises på** | F3, F5 |
| **Navigationslink** | EET oplysninger → Arbejdsskadesikringsloven |

**Betingelse:** Ingen kapitaliseringsbekendtgørelse dækker kombinationen af skadesdato og kontroldato (afgørelsesdato eller tidligere kap.dato). Udspringer af de af brugeren indtastede kapitaliseringsdatoer.

---

### "Kapitaliseringsbekendtgørelse mangler for {dato}." *(effektiv dato)*

| | |
|---|---|
| **issue-id** | `kapitaliseringsbekendtgoerelse-missing-effective-date` |
| **Type** | Fejl |
| **Vises på** | F3, F5 |
| **Navigationslink** | EET oplysninger → Arbejdsskadesikringsloven |

**Betingelse:** Som ovenfor, men for den effektive kapitaliseringsdato (kap.dato eller tidligere kap.dato).

---

### "Ingen kapitaliseringstabel i {id} matcher…" / "Ingen kapitaliseringsfaktorer indtastet…"

| | |
|---|---|
| **issue-id** | `kapitaliseringstabel-missing` |
| **Type** | Fejl |
| **Vises på** | F3, F5 |
| **Navigationslink** | EET oplysninger → Arbejdsskadesikringsloven |

**Betingelse:** Bekendtgørelsen eksisterer, men ingen tabel i den matcher skadesdato og fødselsdato, eller den matchende tabel har ingen faktorer. Udspringer af kombinationen af de af brugeren indtastede kapitaliseringsdatoer med skadesdato og fødselsdato.

---

### "Ingen kapitaliseringsfaktor indtastet for alder ({alder}) — tabellen starter ved {min} år."

| | |
|---|---|
| **issue-id** | `kapitaliseringsalder-under-minimum` |
| **Type** | Fejl |
| **Vises på** | F3, F5 |
| **Navigationslink** | EET oplysninger → Arbejdsskadesikringsloven |

**Betingelse:** Skadelidtes alder ved kapitalisering er lavere end den mindste alder i tabellen. Udspringer af kombinationen af fødselsdato og kapitaliseringsdato.

---

### "Kapitaliseringsfaktor kan ikke beregnes…" *(varierende tekst)*

| | |
|---|---|
| **issue-id** | `kapitaliseringsfaktor-unresolved` |
| **Type** | Fejl |
| **Vises på** | F3, F5 |
| **Navigationslink** | EET oplysninger → Arbejdsskadesikringsloven |

**Betingelse:** Kapitaliseringsfaktoren kan ikke bestemmes af en af følgende grunde (fejlteksten varierer): alder kan ikke beregnes på kontroltidspunktet, alder kan ikke beregnes på kapitaliseringstidspunktet, særfaktor mangler, ingen faktor i tabellen for den givne alder, interpolation fejler.

---

### "Reguleringssats mangler for år {år}"

| | |
|---|---|
| **issue-id** | `reguleringssats-missing` (F3, F4), `reguleringssats-missing-2024` (F2) |
| **Type** | Fejl |
| **Vises på** | F2, F3, F4 |
| **Navigationslink** | — (systemfejl, ingen brugerhandling mulig) |

**Betingelse:** En påkrævet reguleringssats mangler i datakonstanterne. F2 bruger et separat issue-id (`reguleringssats-missing-2024`) fordi det altid handler om 2024-satsen specifikt. F4 angiver de manglende år i fejlteksten. Vises ikke på F5 — proformareguleringssats-fejl har eget issue-id.

---

### "Maksimum årsløn mangler for år {år}."

| | |
|---|---|
| **issue-id** | `aarsloen-max-missing` |
| **Type** | Fejl |
| **Vises på** | F2, F3 |
| **Navigationslink** | — (systemfejl, ingen brugerhandling mulig) |

**Betingelse:** Maks. årsløn for skadesåret mangler i datakonstanterne.

---

### "Maksimum for erhvervsevnetab mangler for år {år}"

| | |
|---|---|
| **issue-id** | `eet-max-missing` |
| **Type** | Fejl |
| **Vises på** | F4, F5 |
| **Navigationslink** | EET oplysninger → Grundlæggende oplysninger |

**Betingelse:** EET-maksimum for beregningsåret mangler i datakonstanterne. Udspringer af den af brugeren indtastede beregningsdato.

---

### Proforma-kapitaliseringsfejl (F5-specifikke)

Disse produceres kun af proformaberegningen internt i `computeEetDifferencekravCalculation` og vises derfor kun på F5. De udspringer alle af beregningsdatoen.

| issue-id | Meddelelse | Navigationslink |
|---|---|---|
| `proforma-kapitaliseringsbekendtgoerelse-missing` | "Der findes ingen gyldig kapitaliseringsbekendtgørelse for beregningsdatoen {dato}." / "Kapitaliseringsdata mangler for {id}." | EET oplysninger → Grundlæggende oplysninger |
| `proforma-kapitaliseringstabel-missing` | "Ingen kapitaliseringstabel matcher skadesdato og fødselsdato på beregningsdatoen." / "Ingen kapitaliseringsfaktorer for tabel {tabel}." | EET oplysninger → Grundlæggende oplysninger |
| `proforma-kapitaliseringsalder-under-minimum` | "Ingen kapitaliseringsfaktor for alder ({alder}) — tabellen starter ved {min} år." | EET oplysninger → Grundlæggende oplysninger |
| `proforma-kapitaliseringsfaktor-unresolved` | Varierer | EET oplysninger → Grundlæggende oplysninger |
| `proforma-reguleringssats-missing` | "Reguleringssats mangler for år 2024." | EET oplysninger → Grundlæggende oplysninger |
| `missing-koen` (proforma) | "Ved beregning før 1. marts 2015 skal køn angives." | EET oplysninger → Arbejdsskadesikringsloven |

**Bemærkning:** `missing-koen` kan emitteres af både F3-beregningen og proforma-beregningen i F5, men med forskellig beskedtekst og navigationslink.

---

### Felt-fejl (fra Zod-validering)

Disse produceres af `useFormFieldErrors` og løftes ind i fejlboksen af fanekomponenten. De vises foruden inline ved feltet på fane 1.

| issue-id | Felt | Vises på | Navigationslink |
|---|---|---|---|
| `field-fodselsdato` | Fødselsdato | F2, F3, F4, F5 | Stamdata → Skadelidte |
| `field-skadesdato` | Skadesdato | F2, F3, F4, F5 | Stamdata → Skadelidte |
| `field-beregningsdato` | Beregningsdato | F2, F4, F5 | EET oplysninger → Grundlæggende oplysninger |
| `field-aarsloen-asl` | ASL årsløn | F2, F3, F5 | EET oplysninger → Arbejdsskadesikringsloven |
| `field-asl-afgoerelser` | Afgørelsestabel | F2, F3, F5 | EET oplysninger → Arbejdsskadesikringsloven |
| `field-aarsloen-eal` | EAL årsløn | F4 | EET oplysninger → Erstatningsansvarsloven |
| `field-eal-eet-pct` | EET % (EAL) | F4 | EET oplysninger → Erstatningsansvarsloven |

---

## Advarsler

### "Der er indtastet en afgørelse med < 15 % erhvervsevnetab."

| | |
|---|---|
| **issue-id** | `warn-asl-eet-under-15` |
| **Type** | Advarsel |
| **Vises på** | F2, F3, F4, F5 |
| **Navigationslink** | EET oplysninger → Arbejdsskadesikringsloven |

**Betingelse F2, F3, F5:** Mindst én afgørelse i tabellen (med EET % > 0) har EET % < 15.

**Betingelse F4:** `ealEetPct` er ikke udfyldt (eller 0), og den seneste ASL-afgørelse har EET % < 15. Hvis `ealEetPct` er udfyldt bruges i stedet `warn-eal-eet-under-15`.

---

### "Der er angivet et EET efter EAL på mindre end 15 %."

| | |
|---|---|
| **issue-id** | `warn-eal-eet-under-15` |
| **Type** | Advarsel |
| **Vises på** | F4, F5 |
| **Navigationslink** | EET oplysninger → Erstatningsansvarsloven |

**Betingelse:** `ealEetPct` er udfyldt med en værdi > 0 og < 15.

---

### "Der er indtastet en ugyldig EET-procent ({x} %) for skader fra 1. juli 2024."

| | |
|---|---|
| **issue-id** | `warn-invalid-eet-pct-after-2024-07-01` |
| **Type** | Advarsel |
| **Vises på** | F2, F3, F5 |
| **Navigationslink** | EET oplysninger → Arbejdsskadesikringsloven |

**Betingelse:** Skadesdato ≥ 2024-07-01, og mindst én afgørelse har EET % > 15 der ikke er deleligt med 10. Første fundne afgørelse nævnes i fejlteksten. Advarsel (ikke fejl) fordi 'hvad nu hvis'-beregninger kan have behov for det.

---

### "Der er angivet en midlertidig eller delvist endelig afgørelse efter en endelig afgørelse."

| | |
|---|---|
| **issue-id** | `warn-non-endelig-after-endelig` |
| **Type** | Advarsel |
| **Vises på** | F2, F3, F5 |
| **Navigationslink** | EET oplysninger → Arbejdsskadesikringsloven |

**Betingelse:** Mindst én Midlertidig eller Delvist endelig afgørelse har afgørelsesdato efter den tidligste Endelig afgørelses dato.

---

### "Der er angivet en afgørelsesdato efter beregningsdatoen."

| | |
|---|---|
| **issue-id** | `warn-afgoerelsesdato-after-beregningsdato` |
| **Type** | Advarsel |
| **Vises på** | F2, F3, F5 |
| **Navigationslink** | EET oplysninger → Arbejdsskadesikringsloven |

**Betingelse:** Mindst én afgørelses afgørelsesdato er efter beregningsdato.

---

### "Der er angivet en virkningsdato efter beregningsdatoen."

| | |
|---|---|
| **issue-id** | `warn-virkningsdato-after-beregningsdato` |
| **Type** | Advarsel |
| **Vises på** | F2, F3, F5 |
| **Navigationslink** | EET oplysninger → Arbejdsskadesikringsloven |

**Betingelse:** Mindst én afgørelses virkningsdato er efter beregningsdato.

---

### "Der er angivet en kapitaliseringsdato efter beregningsdatoen."

| | |
|---|---|
| **issue-id** | `warn-kap-dato-after-beregningsdato` |
| **Type** | Advarsel |
| **Vises på** | F3, F5 |
| **Navigationslink** | EET oplysninger → Arbejdsskadesikringsloven |

**Betingelse:** Mindst én afgørelses kap.dato er udfyldt og er efter beregningsdato.

---

### "Der er ikke angivet kapitaliseringsdato eller -procent for nogen afgørelse."

| | |
|---|---|
| **issue-id** | `warn-ingen-kap-input` |
| **Type** | Advarsel |
| **Vises på** | F3 |
| **Navigationslink** | EET oplysninger → Arbejdsskadesikringsloven |

**Betingelse:** Der er påbegyndte rækker, men ingen af dem har kap.dato eller kap.% udfyldt. Advarslen filtreres eksplicit fra på F5 — F5 håndterer manglende kapitalisering via proformaberegningen.

---

### "Der er angivet kapitalisering med mindre end 15 %."

| | |
|---|---|
| **issue-id** | `warn-kap-pct-under-15` |
| **Type** | Advarsel |
| **Vises på** | F3, F5 |
| **Navigationslink** | EET oplysninger → Arbejdsskadesikringsloven |

**Betingelse:** Mindst én kapitaliseret afgørelse har kap.% > 0 og < 15.

---

### "For skader fra 1. juli 2024 og frem beregnes årsløn forskelligt efter EAL og ASL."

| | |
|---|---|
| **issue-id** | `warn-eal-aarsloen-empty-for-2024-07-01` |
| **Type** | Advarsel |
| **Vises på** | F4, F5 |
| **Navigationslink** | EET oplysninger → Erstatningsansvarsloven |

**Betingelse:** Skadesdato ≥ 2024-07-01 og `ealAarsloen` er ikke udfyldt (tom eller ikke-numerisk). Påminder om at EAL-årsløn skal angives særskilt for nyere skader. Undertrykkes ikke eksplicit af `aarsloen-missing` i koden — de kan vises samtidigt.

---

### "Skadelidtes fulde årsløn skal indtastes for EAL — ikke maks. årslønnen efter ASL."

| | |
|---|---|
| **issue-id** | `warn-eal-aarsloen-is-max` |
| **Type** | Advarsel |
| **Vises på** | F4, F5 |
| **Navigationslink** | EET oplysninger → Erstatningsansvarsloven |

**Betingelse:** `ealAarsloen` er udfyldt og er præcis lig maks. årsløn for skadesåret.

---

### "Skadelidtes fulde årsløn skal indtastes for EAL — ikke maks. årslønnen efter ASL." *(ASL-fallback)*

| | |
|---|---|
| **issue-id** | `warn-asl-aarsloen-is-max` |
| **Type** | Advarsel |
| **Vises på** | F2, F4, F5 |
| **Navigationslink** | EET oplysninger → Erstatningsansvarsloven |

**Betingelse F2:** `ealAarsloen` er ikke udfyldt og `aslAarsloen` er præcis lig maks. årsløn for skadesåret.

**Betingelse F4, F5:** `ealAarsloen` er ikke udfyldt (EAL-beregningen falder tilbage på ASL-årsløn), og `aslAarsloen` er præcis lig maks. årsløn for skadesåret. Påminder om at den faktiske EAL-årsløn sandsynligvis er højere end ASL-maksimum og skal angives særskilt.

