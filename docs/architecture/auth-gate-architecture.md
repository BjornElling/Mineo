# Auth-gate arkitektur (normativ afklaring)

**Status:** Gældende
**Scope:** Login-gate i klienten (`src/auth/*`, `src/components/AuthGate.tsx`, `src/components/pages/LoginPage.tsx`)

## Formål

Auth-gaten i Mineo er en **UX-barriere** mod utilsigtet adgang på en lokal enhed.

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

Alle docs/kodekommentarer skal beskrive mekanismen som **UX-gate** og ikke som sikkerhed.
