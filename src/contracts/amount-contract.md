# Mineo - Beløbs- og numerisk kontrakt

**Status:** Gældende arkitektur (normativ)  
**Type:** Tværgående kontrakt  
**Prioritet:** Underordnet `form-contract.md` for draft/commit-semantik; overordnet arkitekturdokumenter ved konflikt.

Denne kontrakt samler de numeriske regler, som tidligere var spredt mellem form- og beregningsdokumentation.

---

## 1. Grundregel

1. Numeriske værdier, der indgår i beregning, skal komme fra schema-valideret committed state.
2. Featurekode må ikke indføre lokal afrunding, lokal valutaformatering eller lokal parsing.
3. Brug eksisterende canonical helpers for parsing, afrunding og dansk formattering.
4. Beregningslag skal arbejde på maskinvenlige talværdier, ikke locale-formaterede strings.

---

## 2. AmountValue

`AmountValue` er Mineos canonical type for beløbsfelter med brugerindtastet tal eller udtryk.

Regler:

1. `AmountValue.expression` er audit-/UI-repræsentation.
2. `AmountValue.value` er den autoritative committed beregningsværdi.
3. Nedstrøms domæneberegning skal bruge `AmountValue.value`, aldrig genberegne fra `expression`.
4. Operander i brugerens udtryk må ikke pre-afrundes eller pre-afskæres før evaluering.
5. Kun slutresultatet må afrundes ved commit.

---

## 3. Precision

`AmountValue` er absolut bundet til 2 decimaler.

Felter med anden precision må ikke bruge `AmountValue`. De kræver:

1. ny særskilt type eller schema-adapter,
2. eksplicit kontraktændring,
3. test der dokumenterer precision, commit-normalisering og load-normalisering.

Ad hoc-afrunding i featurekomponenter er arkitektonisk fejl.

---

## 4. Afrundingsregel

Standard for beløb er 2 decimaler med `half away from zero`, medmindre en mere specifik domænekontrakt definerer en anden regel.

Indlæste beløb skal normaliseres til samme committed semantik som almindelig commit. Load må ikke sende uafrundede beløb videre til beregningslaget.

---

## 5. Testkrav

Trust-kritiske numeriske ændringer skal have tests for:

1. commit-afrunding,
2. load-normalisering,
3. negative værdier hvor det er tilladt,
4. udtryk hvor operander ikke pre-afrundes,
5. domænespecifik afrunding, hvis den afviger fra standarden.
