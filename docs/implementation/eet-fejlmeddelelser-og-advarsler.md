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

## Fejl

### "Årsløn er ikke udfyldt."

| | |
|---|---|
| **issue-id** | `aarsloen-missing` |
| **Type** | Fejl |
| **Vises på** | F2, F3, F4, F5 |
| **Navigationslink** | EET oplysninger → Arbejdsskadesikringsloven |

**Betingelse per fane:**

- **F2, F3:** `aslAarsloen` er ikke et endeligt tal (tom eller ugyldig).
- **F4:** Hverken `ealAarsloen` eller `aslAarsloen` er udfyldt med en positiv værdi. Fane 4 tjekker begge felter og falder tilbage: EAL-årsløn bruges hvis den er udfyldt, ellers ASL-årsløn.
- **F5:** Arves fra F4-beregningen. Samme betingelse som F4.

---

### "Årsløn må ikke være 0 kr."

| | |
|---|---|
| **issue-id** | `aarsloen-zero` |
| **Type** | Fejl |
| **Vises på** | F2, F3, F4, F5 |
| **Navigationslink** | EET oplysninger → Arbejdsskadesikringsloven |

**Betingelse per fane:**

- **F2, F3:** `aslAarsloen === 0`.
- **F4:** `aslAarsloen === 0` (tjekkes specifikt for ASL-feltet).
- **F5:** Arves fra F3- og F4-beregningerne.

---

### "EAL-årsløn må ikke være 0 kr."

| | |
|---|---|
| **issue-id** | `eal-aarsloen-zero` |
| **Type** | Fejl |
| **Vises på** | F4, F5 |
| **Navigationslink** | EET oplysninger → Erstatningsansvarsloven |

**Betingelse:** `ealAarsloen === 0` (kun EAL-feltet; tjekkes inden ASL-fallback forsøges).

---

### "Fødselsdato er ikke udfyldt."

| | |
|---|---|
| **issue-id** | `fodselsdato-missing` |
| **Type** | Fejl |
| **Vises på** | F2, F3, F4, F5 |
| **Navigationslink** | Stamdata → Skadelidte |

**Betingelse:** `fodselsdato` fra stamdata-sektionen er ikke udfyldt. Gælder på alle faner der bruger fødselsdato i beregningen.

---

### "Skadesdato er ikke udfyldt."

| | |
|---|---|
| **issue-id** | `skadesdato-missing` |
| **Type** | Fejl |
| **Vises på** | F2, F3, F4, F5 |
| **Navigationslink** | Stamdata → Skadelidte |

**Betingelse:** `skadesdato` fra stamdata-sektionen er ikke udfyldt.

---

### "Beregningsdato er ikke udfyldt."

| | |
|---|---|
| **issue-id** | `beregningsdato-missing` |
| **Type** | Fejl |
| **Vises på** | F2, F4, F5 |
| **Navigationslink** | EET oplysninger → Stamdata |

**Betingelse:** `beregningsdato` er ikke udfyldt. Vises ikke på F3 (kapitalisering bruger ikke beregningsdato direkte).

**F5:** Hvis `beregningsdato` mangler kan F2-beregningen slet ikke køres (den kræver `beregningsdato - 1 dag`). I dette tilfælde emitteres `beregningsdato-missing` direkte fra F5's aggregeringslogik, ikke fra en underberegning.

---

### "Erhvervsevnetabsprocent er ikke udfyldt."

| | |
|---|---|
| **issue-id** | `eet-pct-missing` |
| **Type** | Fejl |
| **Vises på** | F4 |
| **Navigationslink** | EET oplysninger → Erstatningsansvarsloven |

**Betingelse:** Hverken `ealEetPct` (EAL-feltet) eller den valgte ASL-afgørelses EET % er udfyldt — og ingen andre EET-relaterede fejl er aktive. Vises altså kun som "rest-fejl" når `eal-eet-pct-invalid` og `asl-selected-eet-pct-invalid` ikke er udløst.

**F5:** Undertrykkes altid via `SUPPRESSED_ISSUE_IDS_FANE5`, fordi EAL-felterne er valgfrie på F5 og beregningen falder tilbage på ASL.

---

### "EET % skal være deleligt med 5." *(eller tilsvarende)*

| | |
|---|---|
| **issue-id** | `eal-eet-pct-invalid` |
| **Type** | Fejl |
| **Vises på** | F4, F5 |
| **Navigationslink** | EET oplysninger → Erstatningsansvarsloven |

**Betingelse:** `ealEetPct` er udfyldt med en værdi der ikke er deleligt med 5. Fejlteksten produceres af `validatePercentDivisibleBy5FromValue`.

**F5:** Undertrykkes **ikke** — en ugyldig EAL EET % blokerer differencekravberegningen.

---

### "EET % skal være deleligt med 5." *(ASL-afgørelse)*

| | |
|---|---|
| **issue-id** | `asl-selected-eet-pct-invalid` |
| **Type** | Fejl |
| **Vises på** | F4, F5 |
| **Navigationslink** | EET oplysninger → Arbejdsskadesikringsloven |

**Betingelse:** Den udvalgte ASL-afgørelse (seneste afgørelsesdato, seneste virkningsdato, Endelig > Delvist endelig) har en EET % der ikke er deleligt med 5.

---

### "Der er angivet to identiske afgørelser…"

| | |
|---|---|
| **issue-id** | `asl-identical-endelig` |
| **Type** | Fejl |
| **Vises på** | F4, F5 |
| **Navigationslink** | EET oplysninger → Arbejdsskadesikringsloven |

**Betingelse:** To rækker har identisk afgørelsesdato og virkningsdato og er begge markeret som Endelig. Tie-breaking i EET-pct-udvælgelsen kan ikke afgøres.

---

### "Alder på skadestidspunkt kan ikke beregnes."

| | |
|---|---|
| **issue-id** | `alder-unresolved` |
| **Type** | Fejl |
| **Vises på** | F4, F5 |
| **Navigationslink** | — (intet link) |

**Betingelse:** Afledt fejl — opstår kun hvis fødselsdato og skadesdato begge er udfyldt men alderen alligevel ikke kan beregnes (datoparse-fejl). I praksis vil `fodselsdato-missing` eller `skadesdato-missing` typisk have fanget situationen forinden. Intet navigationslink vises, da der ingen brugerhandling er der retter denne fejl direkte.

---

### "Ingen afgørelser med erhvervsevnetabsprocent er udfyldt."

| | |
|---|---|
| **issue-id** | `asl-afgoerelser-empty` |
| **Type** | Fejl |
| **Vises på** | F2, F3, F5 |
| **Navigationslink** | EET oplysninger → Arbejdsskadesikringsloven |

**Betingelse:** Ingen rækker i afgørelsestabellen har både en gyldig EET % og en afgørelsesdato.

**F5:** Arves fra F2- og F3-beregningerne.

---

### "Ingen endelig eller delvist endelig afgørelser indtastet."

| | |
|---|---|
| **issue-id** | `no-endelig-afgoerelser` |
| **Type** | Fejl |
| **Vises på** | F3 |
| **Navigationslink** | EET oplysninger → Arbejdsskadesikringsloven |

**Betingelse:** Der er rækker med EET %, men ingen er af typen Endelig eller Delvist endelig. Kapitaliseringsberegningen kræver mindst én af disse.

**F5:** Undertrykkes altid — ikke relevant for differencekrav.

---

### "Der er en afgørelse uden afgørelsesdato."

| | |
|---|---|
| **issue-id** | `incomplete-row-missing-afgoerelsesdato` |
| **Type** | Fejl |
| **Vises på** | F2, F3, F5 |
| **Navigationslink** | EET oplysninger → Arbejdsskadesikringsloven |

**Betingelse:** Mindst én påbegyndt række mangler afgørelsesdato. Produceret af `collectIncompleteRowIssues`.

---

### "Der er en afgørelse uden EET %."

| | |
|---|---|
| **issue-id** | `incomplete-row-missing-eet-pct` |
| **Type** | Fejl |
| **Vises på** | F2, F3, F5 |
| **Navigationslink** | EET oplysninger → Arbejdsskadesikringsloven |

**Betingelse:** Mindst én påbegyndt række mangler EET %. Produceret af `collectIncompleteRowIssues`.

---

### "Der er en afgørelse uden afgørelsestype."

| | |
|---|---|
| **issue-id** | `incomplete-row-missing-afgoerelsestype` |
| **Type** | Fejl |
| **Vises på** | F2, F3, F5 |
| **Navigationslink** | EET oplysninger → Arbejdsskadesikringsloven |

**Betingelse:** Mindst én påbegyndt række mangler afgørelsestype. Produceret af `collectIncompleteRowIssues`.

---

### "Endelig afgørelse under 50 % mangler oplysninger om kapitalisering."

| | |
|---|---|
| **issue-id** | `incomplete-row-endelig-under-50-missing-kap` |
| **Type** | Fejl |
| **Vises på** | F2, F3 |
| **Navigationslink** | EET oplysninger → Arbejdsskadesikringsloven |

**Betingelse:** Mindst én Endelig afgørelse med EET % < 50 har hverken kap.dato eller kap.% udfyldt. Produceret af `collectIncompleteRowIssues`.

**F5:** Undertrykkes hvis der ingen kapitaliserede afgørelser er (`FANE2_ISSUES_HIDDEN_WITHOUT_KAPITALISERING`).

---

### "Der er indtastet kapitaliseringsdato men ikke -procent."

| | |
|---|---|
| **issue-id** | `incomplete-row-kap-dato-without-kap-pct` |
| **Type** | Fejl |
| **Vises på** | F2, F3, F5 |
| **Navigationslink** | EET oplysninger → Arbejdsskadesikringsloven |

**Betingelse:** Mindst én påbegyndt række har kap.dato udfyldt men ikke kap.%. Produceret af `collectIncompleteRowIssues`.

**Undertrykkes hvis** `delvist-endelig-missing-kapitalisering` eller `incomplete-row-endelig-under-50-missing-kap` er aktiv på samme fane — de mere specifikke fejl har forrang.

**F5:** Undertrykkes desuden hvis der ingen kapitaliserede afgørelser er.

---

### "Der er indtastet kapitaliseringsprocent men ikke -dato."

| | |
|---|---|
| **issue-id** | `incomplete-row-kap-pct-without-kap-dato` |
| **Type** | Fejl |
| **Vises på** | F2, F3, F5 |
| **Navigationslink** | EET oplysninger → Arbejdsskadesikringsloven |

**Betingelse:** Mindst én påbegyndt række har kap.% udfyldt men ikke kap.dato. Produceret af `collectIncompleteRowIssues`.

**Undertrykkes hvis** `delvist-endelig-missing-kapitalisering` eller `incomplete-row-endelig-under-50-missing-kap` er aktiv på samme fane.

**F5:** Undertrykkes desuden hvis der ingen kapitaliserede afgørelser er.

---

### "Der er angivet en delvist endelig afgørelse uden kapitalisering."

| | |
|---|---|
| **issue-id** | `delvist-endelig-missing-kapitalisering` |
| **Type** | Fejl |
| **Vises på** | F2, F3, F5 |
| **Navigationslink** | EET oplysninger → Arbejdsskadesikringsloven |

**Betingelse:** Mindst én Delvist endelig afgørelse har hverken kap.dato eller kap.% udfyldt. Vises ikke hvis kun ét af felterne mangler — det fanges i stedet af `incomplete-row-kap-dato-without-kap-pct` / `incomplete-row-kap-pct-without-kap-dato`.

**F5:** Undertrykkes **ikke**, selv uden kapitaliserede afgørelser — en delvist endelig afgørelse uden kapitalisering er altid en fejl der skal rettes.

---

### "Der mangler indtastning af kapitaliseringsdato."

| | |
|---|---|
| **issue-id** | `missing-kap-dato` |
| **Type** | Fejl |
| **Vises på** | F3, F5 |
| **Navigationslink** | EET oplysninger → Arbejdsskadesikringsloven |

**Betingelse:** Der er kapitaliserbare rækker (Endelig/Delvist endelig med EET % > 0), men ingen har kap.dato udfyldt — og ingen inkonsistens-fejl (`incomplete-row-kap-*`) er aktive. Produceret af `collectResolvedRows` i F3-beregningen.

**F5:** Undertrykkes hvis der ingen kapitaliserede afgørelser er.

---

### "Der mangler indtastning af kapitaliseringsprocent."

| | |
|---|---|
| **issue-id** | `missing-kap-pct` |
| **Type** | Fejl |
| **Vises på** | F3, F5 |
| **Navigationslink** | EET oplysninger → Arbejdsskadesikringsloven |

**Betingelse:** Som `missing-kap-dato` ovenfor, men for kap.%. De to emitteres altid sammen.

**F5:** Undertrykkes hvis der ingen kapitaliserede afgørelser er.

---

### "Ved kapitalisering før 1. marts 2015 skal køn angives."

| | |
|---|---|
| **issue-id** | `missing-koen` |
| **Type** | Fejl |
| **Vises på** | F3, F5 |
| **Navigationslink** | EET oplysninger → Arbejdsskadesikringsloven |

**Betingelse F3:** Mindst én afgørelses kap.dato er før 2015-03-01 og `koen` er ikke udfyldt.

**Betingelse F5 (proforma):** `koen` mangler og enten beregningsdato < 2015-03-01 eller kapitaliseringstabellen kræver kønsopsplitning. Fejlteksten kan variere: "Ved beregning før 1. marts 2015 skal køn angives." eller "Ved kapitalisering før 1. marts 2015 skal køn angives."

---

### "Kapitaliseringsbekendtgørelse mangler for {dato}." / "Kapitaliseringsdata mangler for {id}."

| | |
|---|---|
| **issue-id** | `kapitaliseringsbekendtgoerelse-missing-control-date` |
| **Type** | Fejl |
| **Vises på** | F3, F5 |
| **Navigationslink** | EET oplysninger → Arbejdsskadesikringsloven *(se kendte problemer)* |

**Betingelse:** Ingen kapitaliseringsbekendtgørelse dækker kombinationen af skadesdato og kontroldato (afgørelsesdato eller tidligere kap.dato). Opstår ved manglende systemdata, ikke brugerinput.

**F5:** Undertrykkes hvis der ingen kapitaliserede afgørelser er.

---

### "Kapitaliseringsbekendtgørelse mangler for {dato}." *(effektiv dato)*

| | |
|---|---|
| **issue-id** | `kapitaliseringsbekendtgoerelse-missing-effective-date` |
| **Type** | Fejl |
| **Vises på** | F3, F5 |
| **Navigationslink** | EET oplysninger → Arbejdsskadesikringsloven *(se kendte problemer)* |

**Betingelse:** Som ovenfor, men for den effektive kapitaliseringsdato (kap.dato eller tidligere kap.dato).

**F5:** Undertrykkes hvis der ingen kapitaliserede afgørelser er.

---

### "Ingen kapitaliseringstabel i {id} matcher…" / "Ingen kapitaliseringsfaktorer indtastet…"

| | |
|---|---|
| **issue-id** | `kapitaliseringstabel-missing` |
| **Type** | Fejl |
| **Vises på** | F3, F5 |
| **Navigationslink** | EET oplysninger → Arbejdsskadesikringsloven *(se kendte problemer)* |

**Betingelse:** Bekendtgørelsen eksisterer, men ingen tabel i den matcher skadesdato og fødselsdato, eller den matchende tabel har ingen faktorer.

**F5:** Undertrykkes hvis der ingen kapitaliserede afgørelser er.

---

### "Ingen kapitaliseringsfaktor indtastet for alder ({alder}) — tabellen starter ved {min} år."

| | |
|---|---|
| **issue-id** | `kapitaliseringsalder-under-minimum` |
| **Type** | Fejl |
| **Vises på** | F3, F5 |
| **Navigationslink** | EET oplysninger → Arbejdsskadesikringsloven *(se kendte problemer)* |

**Betingelse:** Skadelidtes alder ved kapitalisering er lavere end den mindste alder i tabellen.

**F5:** Undertrykkes hvis der ingen kapitaliserede afgørelser er.

---

### "Kapitaliseringsfaktor kan ikke beregnes…" *(varierende tekst)*

| | |
|---|---|
| **issue-id** | `kapitaliseringsfaktor-unresolved` |
| **Type** | Fejl |
| **Vises på** | F3, F5 |
| **Navigationslink** | EET oplysninger → Arbejdsskadesikringsloven *(se kendte problemer)* |

**Betingelse:** Kapitaliseringsfaktoren kan ikke bestemmes af en af følgende grunde (fejlteksten varierer): alder kan ikke beregnes på kontroltidspunktet, alder kan ikke beregnes på kapitaliseringstidspunktet, særfaktor mangler, ingen faktor i tabellen for den givne alder, interpolation fejler.

**F5:** Undertrykkes hvis der ingen kapitaliserede afgørelser er.

---

### "Reguleringssats mangler for år {år}"

| | |
|---|---|
| **issue-id** | `reguleringssats-missing` (F3, F4), `reguleringssats-missing-2024` (F2) |
| **Type** | Fejl |
| **Vises på** | F2, F3, F4, F5 |
| **Navigationslink** | — (systemfejl, ingen brugerhandling) |

**Betingelse:** En påkrævet reguleringssats mangler i datakonstanterne. F2 bruger et separat issue-id (`reguleringssats-missing-2024`) fordi det altid handler om 2024-satsen specifikt. F4 angiver de manglende år i fejlteksten.

---

### "Maksimum årsløn mangler for år {år}."

| | |
|---|---|
| **issue-id** | `aarsloen-max-missing` |
| **Type** | Fejl |
| **Vises på** | F2, F3 |
| **Navigationslink** | EET oplysninger → Arbejdsskadesikringsloven |

**Betingelse:** Maks. årsløn for skadesåret mangler i datakonstanterne. Systemfejl.

---

### "Maksimum for erhvervsevnetab mangler for år {år}"

| | |
|---|---|
| **issue-id** | `eet-max-missing` |
| **Type** | Fejl |
| **Vises på** | F4, F5 |
| **Navigationslink** | — (systemfejl, ingen brugerhandling) |

**Betingelse:** EET-maksimum for beregningsåret mangler i datakonstanterne.

---

### Proforma-kapitaliseringsfejl (F5-specifikke)

Disse produceres kun af proformaberegningen internt i `computeEetDifferencekravCalculation` og vises derfor kun på F5.

| issue-id | Meddelelse | Betingelse | Navigationslink |
|---|---|---|---|
| `proforma-kapitaliseringsbekendtgoerelse-missing` | "Der findes ingen gyldig kapitaliseringsbekendtgørelse for beregningsdatoen {dato}." | Ingen bekendtgørelse dækker beregningsdatoen | — |
| `proforma-kapitaliseringstabel-missing` | "Ingen kapitaliseringstabel matcher skadesdato og fødselsdato på beregningsdatoen." | | — |
| `proforma-kapitaliseringsalder-under-minimum` | "Ingen kapitaliseringsfaktor for alder ({alder}) — tabellen starter ved {min} år." | | — |
| `proforma-kapitaliseringsfaktor-unresolved` | Varierer | Faktor kan ikke beregnes | — |
| `proforma-reguleringssats-missing-2024` | "Reguleringssats mangler for år 2024." | Systemfejl | — |

---

### Felt-fejl (fra Zod-validering)

Disse produceres af `useFormFieldErrors` og løftes ind i fejlboksen af fanekomponenten. De vises foruden inline ved feltet på fane 1.

| issue-id | Felt | Vises på | Navigationslink |
|---|---|---|---|
| `field-fodselsdato` | Fødselsdato | F2, F3, F4, F5 | Stamdata → Skadelidte |
| `field-skadesdato` | Skadesdato | F2, F3, F4, F5 | Stamdata → Skadelidte |
| `field-beregningsdato` | Beregningsdato | F2, F4, F5 | EET oplysninger → Stamdata |
| `field-aarsloen-asl` | ASL årsløn | F2, F3 | EET oplysninger → Arbejdsskadesikringsloven |
| `field-asl-afgoerelser` | Afgørelsestabel | F2, F3 | EET oplysninger → Arbejdsskadesikringsloven |
| `field-aarsloen-eal` | EAL årsløn | F4 | EET oplysninger → Erstatningsansvarsloven |
| `field-eal-eet-pct` | EET % (EAL) | F4 | EET oplysninger → Erstatningsansvarsloven |

**F5:** `field-eal-eet-pct` og `field-aarsloen-eal` undertrykkes altid (`SUPPRESSED_ISSUE_IDS_FANE5`). De øvrige felt-fejl vises som på de øvrige faner.

---

## Advarsler

### "Der er indtastet en afgørelse med < 15 % erhvervsevnetab."

| | |
|---|---|
| **issue-id** | `warn-asl-eet-under-15` |
| **Type** | Advarsel |
| **Vises på** | F2, F4, F5 |
| **Navigationslink** | EET oplysninger → Arbejdsskadesikringsloven |

**Betingelse F2:** Mindst én afgørelse i tabellen har EET % < 15.

**Betingelse F4:** `ealEetPct` er ikke udfyldt, og den udvalgte ASL-afgørelses EET % < 15. Hvis `ealEetPct` er udfyldt bruges i stedet `warn-eal-eet-under-15`.

**F5:** Arves fra F2- og F4-beregningerne.

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
| **Vises på** | F2, F5 |
| **Navigationslink** | EET oplysninger → Arbejdsskadesikringsloven |

**Betingelse:** Skadesdato ≥ 2024-07-01, og mindst én afgørelse har EET % > 15 der ikke er deleligt med 10. Første fundne afgørelse nævnes i fejlteksten.

---

### "Der er angivet en midlertidig eller delvist endelig afgørelse efter en endelig afgørelse."

| | |
|---|---|
| **issue-id** | `warn-non-endelig-after-endelig` |
| **Type** | Advarsel |
| **Vises på** | F2, F5 |
| **Navigationslink** | EET oplysninger → Arbejdsskadesikringsloven |

**Betingelse:** Mindst én Midlertidig eller Delvist endelig afgørelse har afgørelsesdato efter den tidligste Endelig afgørelses dato.

---

### "Der er angivet en afgørelsesdato efter beregningsdatoen."

| | |
|---|---|
| **issue-id** | `warn-afgoerelsesdato-after-beregningsdato` |
| **Type** | Advarsel |
| **Vises på** | F2, F5 |
| **Navigationslink** | EET oplysninger → Arbejdsskadesikringsloven |

**Betingelse:** Mindst én afgørelses afgørelsesdato er efter beregningsdato.

---

### "Der er angivet en virkningsdato efter beregningsdatoen."

| | |
|---|---|
| **issue-id** | `warn-virkningsdato-after-beregningsdato` |
| **Type** | Advarsel |
| **Vises på** | F2, F5 |
| **Navigationslink** | EET oplysninger → Arbejdsskadesikringsloven |

**Betingelse:** Mindst én afgørelses virkningsdato er efter beregningsdato.

---

### "Der er angivet en kapitaliseringsdato efter beregningsdatoen."

| | |
|---|---|
| **issue-id** | `warn-kap-dato-after-beregningsdato` |
| **Type** | Advarsel |
| **Vises på** | F2, F5 |
| **Navigationslink** | EET oplysninger → Arbejdsskadesikringsloven |

**Betingelse:** Mindst én afgørelses kap.dato er udfyldt og er efter beregningsdato.

---

### "For skader fra 1. juli 2024 og frem beregnes årsløn forskelligt efter EAL og ASL."

| | |
|---|---|
| **issue-id** | `warn-eal-aarsloen-empty-for-2024-07-01` |
| **Type** | Advarsel |
| **Vises på** | F4, F5 |
| **Navigationslink** | EET oplysninger → Erstatningsansvarsloven |

**Betingelse:** Skadesdato ≥ 2024-07-01 og `ealAarsloen` er ikke udfyldt. Påminder om at EAL-årsløn skal angives særskilt for nyere skader.

---

### "Skadelidtes fulde årsløn skal indtastes for EAL — ikke maks. årslønnen efter ASL."

| | |
|---|---|
| **issue-id** | `warn-eal-aarsloen-is-max` |
| **Type** | Advarsel |
| **Vises på** | F4, F5 |
| **Navigationslink** | EET oplysninger → Erstatningsansvarsloven |

**Betingelse:** `ealAarsloen` er præcis lig maks. årsløn for skadesåret.

---

## Kendte problemer og inkonsistenser

1. **Kapitaliseringsspecifikke fejl på F3 navigerer forkert til ASL.** Issues som `kapitaliseringsbekendtgoerelse-missing-*`, `kapitaliseringstabel-missing`, `kapitaliseringsfaktor-unresolved` mv. opstår fordi systemets kapitaliseringsdata ikke dækker situationen — der er intet brugeren kan rette i ASL-sektionen. Disse bør returnere `null` (intet navigationslink), som fane 4 gør for `alder-unresolved`. Løsningen er at følge fane 4's mønster: eksplicit håndtering per issue-id med `return null` som fallback.

2. **`warn-asl-aarsloen-is-max` er defineret i F4's `resolveIssueNavigation` men produceres ikke af F4's beregning.** Sandsynligvis et issue-id der er tiltænkt F5 eller et fremtidigt scenarie.

3. **Duplikeret issue-infrastruktur:** Hver fane (F2, F3, F4, F5) definerer sin egen `ErrorNavigation`-type, `toFieldIssue`-funktion, `resolveIssueNavigation`-funktion, `NAVIGATION_SORT_ORDER` og `navigationSortKey` — identisk logik gentaget fire gange.

4. **Fejlboks-render-pattern er duplikeret:** JSX-blokken der renderer "Fejl og advarsler" med navigation og ikoner er kopieret i alle fire beregningsfaner.

5. **F5 blander to lag filtrering:** Noget filtrering sker i domæneberegningen (`FANE3/FANE2_ISSUES_HIDDEN_WITHOUT_KAPITALISERING`), noget i komponenten (`SUPPRESSED_ISSUE_IDS_FANE5`). Ansvarsfordelingen er uklar.
