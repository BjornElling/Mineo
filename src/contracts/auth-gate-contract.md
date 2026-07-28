# Auth-gate — Mineo

**Status:** Gældende arkitektur (normativ)
**Type:** Tværgående kontrakt
**Prioritet:** Selvstændig tværgående kontrakt. Underordner ikke andre kontrakter og er ikke underordnet `page-component-contract.md` (login-gaten ligger uden for sidekomponent-laget; den wrappes om hele `App` i app-shell-laget, før sider monteres). Berører ikke beregnings-, form- eller persistence-concerns og overlapper derfor ikke de øvrige tværgående kontrakter.
**Senest verificeret mod kode:** 2026-07-28

## 1. Scope

Login-gaten i klienten:
- `src/auth/auth.ts` (hash, verifikation, localStorage-flag)
- `src/auth/authConfig.ts` (storage-nøgle/-værdi, delte adgangskode-hashes, beslutningsnote)
- `src/auth/AuthGate.tsx` (gate-komponent der vælger `App` eller `LoginPage`)
- `src/auth/LoginPage.tsx` (adgangskode-formular)

Den informative uddybning (trusselsmodel, migrations-triggere) ligger i `docs/architecture/auth-gate-architecture.md`. Dette dokument ejer de bindende regler; arkitektur-doc'en er forklarende og må ikke modsige dem.

## 2. Normative Regler

1. **Auth-gaten er en permanent UX-barriere, ikke en sikkerhedsgrænse.** Den beskytter mod utilsigtet "klik-ind"-adgang på en delt enhed uden kendskab til den delte adgangskode. Den beskytter ikke mod DevTools, `localStorage`-manipulation eller reverse engineering — og må aldrig behandles eller beskrives som om den gør.
2. **Kommunikationsreglen (bindende):** Al kode, JSDoc og dokumentation skal omtale mekanismen som en *UX-gate* og **ikke** som sikkerhed, og **ikke** som midlertidig. Den svage styrke er et bevidst, permanent designvalg.
3. **100 % client-side (jf. `AGENTS.md`).** Auth-flowet må aldrig indføre serverkald, eksterne API'er, telemetri eller ekstern logging. Adgangskode-verifikation sker lokalt via Web Crypto (`crypto.subtle.digest('SHA-256', …)`) efter case-neutral normalisering til lower-case; kun hex-hashes sammenlignes, og kun mod de hardcodede `SHARED_PASSWORD_HASHES`. Klartekst-adgangskoder må aldrig persisteres eller logges af auth-laget. Det dedikerede browser-testpassword må stå i `AGENTS.md`, fordi det skal være tilgængeligt i nye agent-sessioner og ikke er en brugerhemmelighed.
4. **Hver aktiv adgangskode-hash skal have en beskrivende tekst i `src/auth/authConfig.ts`.** Beskrivelsen bruges kun til intern audit af, hvad/hvem hashen vedrører, og må ikke vises i login-UI'et eller anden brugervendt UI.
5. **Login-flaget er kun et bekvemmelighedsflag.** Den autentificerede tilstand persisteres som `localStorage[AUTH_STORAGE_KEY] === AUTH_STORAGE_VALUE`. Flaget må aldrig betragtes som troværdigt input til beregning, persistence eller anden tillidskritisk logik — dets eneste rolle er at vælge mellem `App` og `LoginPage`.
6. **Fail-safe og fail-closed.** Kan adgangskontrol ikke gennemføres (manglende `crypto.subtle`), kastes en deterministisk, brugervendt dansk fejl, og adgang gives ikke. Kan login-flaget ikke skrives (`localStorage` blokeret), kastes en deterministisk fejl frem for stille at fejle. Begge fejl vises i `LoginPage` som brugervendt besked.
7. **Isoleret fra forretningslogik.** Auth-laget må ikke importere domæne-, persistence- eller beregningsmoduler ud over det, der kræves for selve gaten. `.eo`-sagsdata og app-settings er fuldstændig adskilt fra auth-tilstanden; auth-flaget må aldrig gemmes i sessionStorage-manifestet eller `.eo`-filer.
8. **Browser-testadgang.** `AGENTS.md` er den autoritative klartekst-kilde til browser-agentens dedikerede testpassword; `src/auth/authConfig.ts` indeholder kun den tilsvarende hash og en auditbeskrivelse. Browser-tests logger ind gennem den synlige loginformular og må ikke afhænge af en tidligere browsersessions login-flag.

## 3. Autoritative Kilder

- Adgangskode-hashes, storage-nøgle og -værdi: `src/auth/authConfig.ts` (eneste sandhed; beslutningsnoten i filen er normativ).
- Klartekst til den dedikerede browser-testadgang: `AGENTS.md`.
- Hash-/verifikations-/flag-logik: `src/auth/auth.ts`.
- Gate-valg (App vs. LoginPage): `src/auth/AuthGate.tsx`.

## 4. Testkobling

- `src/__tests__/auth/auth.test.ts` (verifikation, persistens af flag, deterministisk fejl ved manglende `crypto.subtle` og ved skrivefejl).
- `src/__tests__/quality/authGateContractIsolation.test.ts` (auth-flaget holdes ude af sessionStorage-manifestet og `.eo`-save-schemaet; ingen klartekst-persistens i auth-laget).

## 5. Kendte Undtagelser

Ingen. Re-evaluering (migration til reel server-/infrastruktur-auth) udløses kun af de triggere, der er beskrevet i `docs/architecture/auth-gate-architecture.md` (krav om reel adgangskontrol pr. bruger/rolle, revisionsspor, central sessionstyring eller compliance). Ved en sådan migration flyttes auth-funktionen ud af klientens tillidsgrænse, og denne kontrakt revideres i samme ændring.
