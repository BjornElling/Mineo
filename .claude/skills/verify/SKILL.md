---
name: verify
description: Runtime-verificér en greenfield-slice-migrering i Mineo (draft/commit-cutover)
---

# Verificér en migreret slice (greenfield draft/commit-cutover)

Læs først statusafsnittet og §5.1 i `docs/architecture/input-architecture.md`, og
kontrollér den beskrevne mellemtilstand mod den aktuelle kode. Memory er kun orientering.

**Aktuel kendt kontekst:** Under den ikke-deploybare cutover-tranche er **hovedappens shell bevidst brudt**:
`src/components/layout/MainLayout.tsx` bruger stadig legacy `useFormPersistence`, som ikke længere har en
provider. `npm run dev` starter, men `MainLayoutContent` kaster
`FormPersistenceContext ikke tilgængelig` og siden mounter ikke. **Det er den sanktionerede
mellemtilstand — ikke en regression.** Den fulde browser-GUI-flade er derfor IKKE reachable, før hele
tranchen er grøn. Acceptér kun dette konkrete crash, så længe både planen og koden fortsat beskriver
samme mellemtilstand; alle andre runtime-fejl er fund.

## Den reachable runtime-flade for en migreret side

Den ægte runtime-flade for en enkelt migreret slice er dens komponent kørt gennem den RIGTIGE
produktions-input-runtime — ikke pure-calc og ikke import-and-call. Mønstret ligger i
`*.greenfield.integration.test.tsx` (fx `src/__tests__/components/pages/Forsoergertab.greenfield.integration.test.tsx`,
`.../varigemen/MenberegningTab.greenfield.integration.test.tsx`):

- Renderer den migrerede komponent under `ProductionInputRuntimeProvider` + `createProductionInputRuntimeBinding()`
  med det ægte `getProductionInputCatalog()` og `slimInputStore.getState().hydrate(...)`.
- Driver med ægte `@testing-library/user-event` (tastning, tab, klik på download-knappen).
- Observerer ægte DOM (`aria-invalid`, knap disabled) + det ægte service-kald (mocket på servicegrænsen).

Kør fladen (ikke som CI-regressionssweep, men som drivning af den migrerede komponent):

```
npx vitest run <path-to-slice>.greenfield.integration.test.tsx --reporter=verbose
```

Bekræft desuden at dev-serveren stadig kun fejler i shell'et (ikke i din side):

```
npm run dev   # forvent FormPersistenceContext-fejl i MainLayoutContent = pre-eksisterende shell-brud
```

Hvis crashet er i `MainLayout`/shell og IKKE i din migrerede side, er det den kendte mellemtilstand.

## Fuld gate (før handoff eller et udtrykkeligt bestilt commit)

```
npm run typecheck && npm run typecheck:test && npm run lint && npm run verify:ledgers
npx vitest run
```

§5.4 er et hårdt stop: en slice-migrering må ikke ændre beregningstal. Bevis byte-identitet ved at køre
den uændrede engine/snapshot direkte og `toEqual` mod projektionens output i en projektionstest.
