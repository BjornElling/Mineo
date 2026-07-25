# WI-009: Ét neutralt source-settings-snapshot (rodårsag bag WI-008's C4)

- **Status:** `ikke-startet`
- **Oprettet:** 2026-07-26
- **Kilde:** codex sol/high-review af Fase 5's første halvdel, fund C4. Udskilt fra WI-008, fordi
  roden ligger i input-runtime/settings-arkitekturen, ikke i dokumentlaget.
- **Risikoklasse:** **H** — friskhedskæden (`EvaluationSourceToken`) afhænger af den. En manglende
  nøgle betyder, at en download godkendt under den gamle regel kan overleve et regelskift.

## Problemet

Der findes ikke ÉN værdi, der definerer "hvad gør et optaget `EvaluationSourceToken` stale". I stedet
findes tre uafhængige steder, som skal holdes i sync i hånden:

1. `evaluationSettingsFingerprint` (`src/inputCore/react/productionInputRuntime.tsx`) — afgør
   settingsrevisionen og dermed hvornår et token bliver stale.
2. Det, evalueringen FAKTISK læser gennem `createInputEvaluation(..., settings)` og de
   descriptor-/consumer-validatorer, den kalder.
3. Dokumentcapture, som læser sin egen form.

WI-008's pass 0 lukkede halvdelen af hullet: `DocumentSourceSettings` +
`SOURCE_RELEVANT_SETTINGS_KEYS` med compile-time completeness gør nu, at fingerprintet UDLEDES af en
eksplicit erklæret nøgleliste, og at listen ikke kan komme fra typen (mutationstestet). Det der
mangler, er punkt 2: **intet håndhæver, at evalueringen kun læser nøgler INDEN FOR sættet.** En ny
`settings`-læsning i en validator eller row-builder vil derfor stadig kunne indføre en
source-afhængighed, der ikke gør et token stale — og fejlklassen er tavs.

## Foreslået løsning (fra reviewet, ikke besluttet)

- Én exhaustiv projector fra `AppSettings` → source-settings-snapshot. Præcis DEN værdi skal drive
  evaluering, settingsrevision/fingerprint OG dokumentcapture, så de tre ikke kan divergere.
- Et AST-/type-værn, der beviser, at ingen evalueringsafhængig kodesti læser en settings-nøgle uden
  for sættet. **Mutationstest værnet** (jf. guard-selvtest-princippet i AGENTS.md): kan det fejle?
- Overvej at gøre `AppSettings` utilgængelig for evalueringen ad typevejen, så kun snapshottet kan
  nås — det gør fejlklassen urepræsenterbar frem for blot opdaget.

## Bemærk

Der er **ingen kendt live fejl i dag**: de nøgler, evalueringen faktisk læser, ER med i sættet
(enumereret i WI-008's B2). Dette er et manglende værn, ikke en aktiv defekt. Roden hører i Fase 6's
håndhævelsesarbejde.

## Relateret

- `work-items/WI-008-fase5-dokumentoutputs.md` — B2 (den oprindelige, delvist forkerte begrundelse),
  C4 (reviewets fund) og `documentSourceSettings.ts` (den halve lukning).
- `work-items/WI-005-ansvarsbaserede-arkitekturvaern.md` — samme familie af håndhævelsesarbejde.
