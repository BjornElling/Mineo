# Auth-gate arkitektur (informativ uddybning)

**Status:** Informativ
**Sidst opdateret:** 2026-07-28
**Scope:** Login-gate i klienten (`src/auth/*`, inkl. `src/auth/LoginPage.tsx`)

> De **bindende** regler for auth-gaten ejes af `src/contracts/auth-gate-contract.md`. Dette dokument er forklarende (trusselsmodel, afgrænsninger, migrations-triggere) og må ikke modsige kontrakten.

## Formål

Auth-gaten i Mineo er en **permanent UX-barriere** mod utilsigtet adgang. Den er et bevidst designvalg og ikke en midlertidig løsning.

Den er **ikke** en sikkerhedsgrænse.

## Trusselsmodel

Auth-gaten beskytter mod:
- utilsigtet åbning af appen af en almindelig bruger på samme enhed
- simpel "klik-ind" adgang uden kendskab til delt kodeord

Auth-gaten beskytter ikke mod:
- teknisk bruger med DevTools-adgang
- manipulation af `localStorage`
- reverse engineering af klientkode
- målrettet adgangskontrolkrav (identitet, roller, revision, sporbarhed)

## Teknisk afgrænsning

Implementationen er klient-side og bruger browser-lokal tilstand (`localStorage`) som bekvemmelighedsflag.

Konsekvens:
- login-status kan forfalskes/ændres udenfor appens UI
- mekanismen må ikke beskrives eller behandles som egentlig sikkerhed

Den svage styrke er et bevidst designvalg: gaten er tilstrækkelig til formålet og matcher appens klient-side-only arkitektur.

Browser-agenten har et dedikeret testpassword, hvis klartekst står i `AGENTS.md`, mens klientkoden kun
indeholder den tilsvarende hash. Det gør nye browser-tests uafhængige af tidligere login-status og
lader dem verificere den almindelige loginoplevelse.

## Trigger for migration til reel auth

Følgende krav udløser migration til server-/infrastruktur-auth:
- krav om reel adgangskontrol pr. bruger eller rolle
- krav om revisionsspor for login/adgangshændelser
- krav om central sessionstyring eller tvungen logout
- krav om compliance, hvor lokal UX-gate ikke er tilstrækkelig

Ved migration skal auth-funktionen flyttes ud af klientens tillidsgrænse.

## Ikke i scope

Dette dokument introducerer ikke:
- server-login
- token/session-infrastruktur
- kryptering eller hemmelighedshåndtering

## Konsekvens for kommunikation

Kommunikationsreglen – beskriv mekanismen som **UX-gate**, ikke som sikkerhed, og ikke som midlertidig – er bindende og ejes af `src/contracts/auth-gate-contract.md §2`.
