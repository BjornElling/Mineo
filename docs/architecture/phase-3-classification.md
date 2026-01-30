# Fase 3 — Klassificering af beregningsdomæner (2026-01-27)

Dette dokument låser klassificering af beregningsdomæner for Fase 3.
Ingen kode ændres på baggrund af dette dokument alene.

## 1) Renter
- **Inputkilder (SoT + read‑only)**
  - SoT: `renteberegning` persisted section
  - Read‑only: rentesatser (reference‑data fra `src/data/interestRates.ts`)
- **Output**
  - Per‑krav/per‑periode renteopgørelse + samlet rente
  - Struktur egnet til visning/rapport (ikke PDF)
- **Karakter**
  - Tværgående beregnings‑engine
- **Placering**
  - Separat engine (ikke Zustand, ikke selectors, ikke React)
  - Selectors må kun forme output til UI‑struktur
- **Ikke tilladt**
  - Beregning i UI eller selectors
  - Persisting af beregningsoutput

## 2) Erstatningsopgørelse (samlet)
- **Inputkilder (SoT + read‑only)**
  - SoT: `erstatningsopgoerelse` persisted section
  - Read‑only: outputs fra andre domæner (renter, varigt mén, erhvervsevnetab, tabt arbejdsfortjeneste, års-/lønindkomst)
- **Output**
  - Aggregerede delbeløb, afrunding og samlet totalsum
  - Struktur egnet til visning/rapport (ikke PDF)
- **Karakter**
  - Tværgående aggregerende engine (ikke beregningsmotor for underdomæner)
- **Placering**
  - Separat engine (ikke Zustand)
  - Selectors må kun forme output til UI‑struktur
- **Ikke tilladt**
  - At eje eller udløse delberegninger
  - Persisting af totalsummer
  - Beregning i selectors/UI

## 3) Kapitalisering
- **Status**
  - Reference‑data only (ikke beregningsdomæne)
- **Placering**
  - `satser` / `src/data/regulationRates.ts`
- **Normativ regel**
  - Må ikke indgå i beregningsflows uden ny arkitekturbeslutning

## 4) Årsindkomst / lønindkomst
- **Inputkilder (SoT + read‑only)**
  - SoT: `aarsloen` persisted section
  - Read‑only: reference‑data (overenskomst/statistik‑satser), evt. `stamdata` datoer til afgrænsning
- **Output**
  - Normaliseret/annualiseret indkomstgrundlag pr. ansættelse
  - Struktur til visning/rapport (ikke PDF)
- **Karakter**
  - Afledt state (én section, med reference‑data)
- **Placering**
  - Calculation‑layer (section‑lokalt)
  - Selectors må kun vælge/forme output
- **Ikke tilladt**
  - Cross‑section selectors som beregningsmotor
  - Persisting af beregningsoutput
  - Års-/lønindkomst må ikke ejes af `erstatningsopgoerelse` eller EET

## 5) Tabt arbejdsfortjeneste (TAF)
- **Inputkilder (SoT + read‑only)**
  - SoT: `erstatningsopgoerelse` persisted section (TAF‑perioder mv.)
  - Read‑only: reference‑satser/kalenderregler
- **Output**
  - Periode‑ og sum‑beregninger for tabt arbejdsfortjeneste
  - Struktur til visning/rapport (ikke PDF)
- **Karakter**
  - Tværgående beregnings‑engine
- **Placering**
  - Separat engine (ikke Zustand)
- **Ikke tilladt**
  - Cross‑section selectors
  - At implementere TAF som selector eller section‑lokal calculation
  - Persisting af beregningsoutput

## 6) Varigt mén
- **Inputkilder (SoT + read‑only)**
  - SoT: `varigemen` persisted section
  - Read‑only: satser (`varigeMenPrGrad` i `src/data/regulationRates.ts`)
- **Output**
  - Mén‑godtgørelse og delresultater
  - Struktur til visning/rapport (ikke PDF)
- **Karakter**
  - Afledt state (én section)
- **Placering**
  - Calculation‑layer (section‑lokalt)
- **Ikke tilladt**
  - Cross‑section selectors
  - Persisting af beregningsoutput

## 7) Erhvervsevnetab
- **Inputkilder (SoT + read‑only)**
  - SoT: `erstatningsopgoerelse` persisted section (EET‑felter/datoer)
  - Read‑only: indkomstgrundlag (års-/lønindkomst output), satser/regulering
- **Output**
  - Erhvervsevnetab‑beregninger og delresultater
  - Struktur til visning/rapport (ikke PDF)
- **Karakter**
  - Tværgående beregnings‑engine
- **Placering**
  - Separat engine (ikke Zustand, ikke selectors)
- **Ikke tilladt**
  - Beregning i selectors/UI
  - Persisting af beregningsoutput

## 8) Periode‑opdeling (støttedomæne)
- **Inputkilder**
  - Periode‑rækker fra `erstatningsopgoerelse` (TAF, svie/smerte, ferie)
- **Output**
  - Normaliserede perioder, overlap‑detektion, sammenfletning
- **Karakter**
  - Beregnings‑utility (shared)
- **Placering**
  - Calculation‑layer helpers (ikke UI, ikke selectors)
- **Ikke tilladt**
  - UI‑implementeret periode‑logik

## 9) Afrunding og præcision (støttedomæne)
- **Inputkilder**
  - Tal fra beregnings‑engines
- **Output**
  - Konsekvent afrundede værdier efter domæneregler
- **Karakter**
  - Cross‑cutting regel‑utility
- **Placering**
  - Dedikeret utility (calculation‑layer), ikke UI
- **Ikke tilladt**
  - Afrunding i UI

## 10) Output‑struktur (rapport‑klar)
- **Inputkilder**
  - Engine‑output (renter, TAF, varigt mén, EET, års-/lønindkomst)
- **Output**
  - Struktureret, visningsklar data (ikke PDF)
- **Karakter**
  - Output‑shaping layer
- **Placering**
  - Separat output‑model (ikke engine, ikke selectors)
- **Ikke tilladt**
  - Persisting af output
  - At output‑laget udfører beregning
