# WI-001: Afslut Fase 3 — resterende testdækning + fjern død fejlmodel-kode

- **Status:** `afsluttet` (2026-07-24), suppleret 2026-07-25.

  **Efterskrift (Codex sol/high-review, fund F2).** Dette WI reducerede Fase 3-restarbejdet til én manglende
  Varige mén-test. Reviewet påpegede, at trin 4–8's matrix ikke var dækket pr. slice, og at fire projektioner
  (Årsløn, Forsørgertab, EET, EO) adapterede tilbage til ældre snapshot-/fejlformer. Det er nu adresseret:
  Årsløn kalder motoren KUN i `ready`-grenen (`calculation: null` ved rød gate), ASL-årslønsreglen genberegnes
  ikke længere slice-lokalt, EO's `blocksSave`-flag er erstattet af `reason` + `eoIssueBlocksDependents`, og de
  karakteriseringstests, der låste den gamle adfærd, er erstattet af invariant-tests. Se
  `docs/reviews/codex-fase34-review.md`.
- **Oprettet:** 2026-07-24
- **Slice/scope:** Greenfield draft/commit, Fase 3 (domæneprojektioner og ren fejlmodel), de fire
  sidste slices: Renteberegning, Stamdata/fælles input, Varige mén, Forsørgertab.
- **Kilde:** Brugerønske ("færdiggør fase 3") + verificeret kortlægning af aktuel kodetilstand.
- **Risikoklasse:** **L** — additiv test + sletning af verificeret død kode (nul produktionscallsites,
  ingen guard-referencer). Ingen adfærds-/beregningsændring.
- **Baseline:** HEAD `12c894fd` på branch `greenfield`; working tree rent. Ingen fremmede ændringer.

## Scope

Kortlægningen (verificeret mod kode) viser, at domæne-, descriptor- og sidelaget for alle fire
"udestående" slices **allerede er migreret**: hver har en reader-projektion, hver side forbruger den,
ingen læser rå sektioner eller bruger legacy error-reporters. Det reelle restarbejde for Fase 3 er:

**Inde i scope:**
1. Skriv den manglende unit-test `src/__tests__/domain/varigemen/varigeMenReaderProjection.test.ts`
   (spejler rente-/forsørgertab-projektionstesten). Eneste ægte kodehul.
2. Slet den nu døde fejlmodel-kode (Fase 3-sletteliste-delmængde med nul produktionsforbrugere):
   - `src/hooks/useAslAarsloenRuleReporter.ts` (0 forbrugere, 0 test) — reglen er inlinet i
     `forsoergertabReaderProjection.ts:95-98` og `erhvervsevnetabReaderProjection.ts:228-231`.
   - `src/hooks/useForligAnsvarsgradValidation.ts` + `src/__tests__/hooks/useForligAnsvarsgradValidation.test.tsx`
     (0 produktionsforbrugere) — erstattet af `forlig`-arg i `erhvervsevnetabReaderProjection.ts`.
   - `src/components/tables/gridCore/useTableCellErrorTracker.ts` +
     `src/__tests__/components/tables/useTableCellErrorTracker.test.tsx` (0 produktionsforbrugere).
3. Opdatér design-dokumentets Fase 3-status til gennemført for de fire slices, og notér hvad der
   bevidst efterlades til Fase 4.

**Bevidst UDEN for scope (Fase 4, ikke Fase 3):**
- `src/types/fieldErrors.ts` og `src/hooks/useFormFieldErrors.ts` — stadig transitive dependencies for
  den levende legacy `Styled*Field`-inputvej (`useStyledFieldAdapter.ts`, `StyledTextField.tsx` via
  `useFieldInvalidDraftChannel`) og `FormPersistenceContext`/`inputRuntimeStore`. §2.6/§4.3: fysisk
  sletning venter til det sidste aktive ansvar flyttes i Fase 4.
- `src/config/cellInvalidDraftScopes.ts` og `src/hooks/tableInput/useReconcileInvalidDraftsToLiveRows.ts`
  — **IKKE død** (kortlægningen tog fejl her): begge har levende produktionsforbrugere via den aktive
  `invalidDrafts`-celle-kanal (`eoRowIssueCatalog.ts`, `useCellInvalidDraftChannel.ts`, `saveBlockedFocus.ts`,
  `CellInvalidDraftScopeContext.tsx`; sidstnævnte er også dækket af architecture-guards). Bliver.

## Autoritativt grundlag

- `docs/architecture/draft-commit-greenfield-design.md` §8 Fase 3 (arbejdstrin 1-10, sletteliste,
  exit-/verifikationskriterier), §5.4 (hårdt stop mod talændring), §1.6/§1.7/§1.10.
- Færdige mønster-orakler: `forsoergertabReaderProjection.test.ts`, `renteberegningReaderProjection.test.ts`.
- `varigeMenReaderProjection.ts`, `varigeMenDownloadGate.test.ts`, `varigeMenDescriptors.ts` (méngrad 1..120).

## Invarianter (må ikke brydes)

- **§5.4:** ingen ændring i beregningstal. Den nye test er ren karakterisering af eksisterende adfærd
  (`computeVarigeMenEngine` uændret). Golden-/paritetstests skal fortsat passere uændret.
- Sletning må kun ramme kode med bevist nul produktionscallsites og nul guard-/completeness-referencer.
- Ingen ny import af de slettede symboler.

## Parallel / duplikeret logik

- **Fund:** ASL-årsløns-reglen og forlig-ansvarsgrad-valideringen fandtes både som React-hook-reportere
  (`useAslAarsloenRuleReporter`, `useForligAnsvarsgradValidation`) og som slice-lokale rene funktioner i
  reader-projektionerne (forsørgertab/EET).
- **Beslutning:** behold de rene reader-projektionsvarianter (målarkitekturen, §3.4); slet hook-reporterne.
- **Begrundelse:** reporter-vejen er den afløste mekanisme (component-reported fejl, §3.4/§4.3-sletteliste);
  konsolideringen er allerede sket i projektionerne — hookene er ren rest.

## Acceptance criteria

- [ ] `varigeMenReaderProjection.test.ts` findes og dækker: byte-identisk engine-output (§5.4),
      méngrad-bounds blokerer, byttet stamdata-datoorden blokerer, tomt påkrævet felt → `missing`/blocked.
- [ ] De tre døde hooks (+ 2 tilhørende testfiler) er slettet; `npx tsc`/lint viser ingen dinglende import.
- [ ] Fuld relevant testsuite grøn for de berørte moduler; ingen beregningstal ændret.
- [ ] Design-dokumentets Fase 3-status opdateret.

## Godkendelsesgate

- **Påkrævet:** nej. Rent teknisk: additiv karakteriseringstest + sletning af død kode. Ingen synlig
  UI/UX-ændring og ingen ændring af beregningstal/-regler (§5.4 håndhæves).
- **Status og beslutning:** godkendelse ikke påkrævet → `klar`.

## Verifikation

- **Plan:** `npx vitest run` for varigemen-domænet + de berørte sletnings-naboer; `npm run typecheck`
  og `npm run lint` for at fange dinglende imports; Codex-review (L-kode, Terra/high) af diffen.
- **Resultat:**
  - In-scope domænetests (varigemen, forsørgertab, renteberegning, stamdata, erhvervsevnetab): **510/510 grønne** (35 filer).
  - `npx tsc -p tsconfig.json --noEmit` → exit 0; `npx tsc -p tsconfig.test.json --noEmit` → exit 0; `npm run lint` → exit 0.
  - Fuld suite har mange fejl, men de er den bevidst brudte mellemtilstand (§5.1): bevist pre-eksisterende ved
    `git stash` af WI-ændringerne → `fileSave.test.ts` + `eoRowAggregator.test.ts` fejler identisk (50 fejl) på ren HEAD.
    Ingen fejl refererer til de slettede symboler; ingen unresolved imports (grep bekræftet).
  - Codex-review (Terra/high, `codex review --uncommitted`): ingen handlingskrævende fund — "de slettede moduler har
    ingen aktive produktionsreferencer, den nye projektionstest består, typecheck/test-typecheck/lint er grønne".

## Review-fund (udfyldes i review-fasen)

| # | Fund og evidens | Alvor | Disposition | Status |
|---|---|---|---|---|
| 1 | Codex (Terra/high) rejste ingen fund; verificerede at slettede moduler er uden aktive produktionsreferencer | — | ingen fund | afsluttet |

Egen verifikation korrigerede desuden kortlægningens fejl om at `cellInvalidDraftScopes.ts` /
`useReconcileInvalidDraftsToLiveRows.ts` var døde — de har levende forbrugere og blev korrekt holdt uden for scope.

## Resterende / risici

- Fase 4 arver: `fieldErrors.ts`, `useFormFieldErrors.ts` og den øvrige `FormPersistenceContext`/
  legacy-`Styled*Field`-inputvej. Ikke denne WI's ansvar.
