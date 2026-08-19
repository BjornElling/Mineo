// @vitest-environment jsdom
//
// BB-057: 404-siden var en hvid blindgyde uden menu og uden vej tilbage – to linjer sort tekst i
// øverste venstre hjørne, renderet uden for shellen. Sagen lå uskadt i fanens hukommelse, men skærmen
// så ud, som om programmet var væk.
//
// Brugeren accepterede en dedikeret 404-side på TO betingelser, og de er det, denne fil måler:
//
//   1. Siden må ikke blive en genvej ind bag login-siden.
//   2. Mobilen skal fortsat kun have sin egen enkelte «Desværre»-side.
//
// Begge er strukturelle forhold, ikke tekstforhold, så de måles på strukturen: hvor `*`-routen
// ligger i rutetræet, og hvor mobil-gaten returnerer i opstarten. En tekstprøve på selve siden ville
// ikke kunne se nogen af dem.
import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import PageNotFound from '../../../components/system/PageNotFound';

const readSource = (relativePath: string): string =>
  readFileSync(resolve(process.cwd(), relativePath), 'utf-8');

describe('PageNotFound', () => {
  it('oplyser, at sagen er uændret – den ene ting skærmen ikke selv kan vise', async () => {
    render(
      <MemoryRouter initialEntries={['/stamdaat']}>
        <PageNotFound />
      </MemoryRouter>
    );

    expect(screen.getByText('Siden findes ikke')).toBeInTheDocument();
    expect(screen.getByText(/Din sag er uændret/)).toBeInTheDocument();
    // Vejen videre er menuen, så teksten skal pege på den frem for at efterlade brugeren uden næste
    // skridt (den gamle side nævnte hverken tilbage-knappen eller adressefeltet).
    expect(screen.getByText(/vælg en side i menuen/i)).toBeInTheDocument();
  });

  it('navngiver den fejlede adresse tilgængeligt uden at vise den som indhold', () => {
    render(
      <MemoryRouter initialEntries={['/stamdaat']}>
        <PageNotFound />
      </MemoryRouter>
    );

    // Adressen hører i tilgængelighedsnavnet (skærmlæser + fejlrapport), ikke i brødteksten: den er
    // brugerens eget input gengivet uden at kunne bruges til noget, og den står allerede i browserens
    // adressefelt.
    expect(screen.getByRole('region', { name: 'Siden findes ikke: /stamdaat' })).toBeInTheDocument();
    expect(screen.queryByText('/stamdaat')).toBeNull();
  });
});

describe('PageNotFound – brugerens to betingelser (BB-057)', () => {
  it('ligger INDE i shell-routen, så sidemenuen er med og er vejen videre', () => {
    const appSource = readSource('src/App.tsx');

    // `*`-routen skal stå mellem `<Route element={<AppShell />}>` og dens afsluttende tag. Lå den
    // uden for, ville 404 igen være en side uden menu – præcis den blindgyde, fundet handler om.
    const shellBlock = /<Route element=\{<AppShell \/>\}>([\s\S]*?)<\/Route>/.exec(appSource);
    expect(shellBlock).not.toBeNull();
    expect(shellBlock![1]).toContain('path="*"');
    expect(shellBlock![1]).toContain('<PageNotFound />');
  });

  it('kan ikke nås uden om login, fordi ALLE routes ligger inde i den gatede App', () => {
    // `AuthGate` monterer `App` – og dermed hele rutetræet inkl. catch-all'en – først når
    // login-flaget er sat. En ukendt adresse rammer altså login-siden, præcis som en kendt gør.
    const authGateSource = readSource('src/auth/AuthGate.tsx');

    expect(authGateSource).toMatch(/if\s*\(authenticated\)\s*\{\s*return\s*<App/);
    expect(authGateSource).toMatch(/return <LoginPage/);
    // Rutetræet må ikke findes uden for `App`: står der et `<Routes>` i gaten selv, kan en route
    // være monteret før flaget er tjekket.
    expect(authGateSource).not.toContain('<Routes');
    expect(authGateSource).not.toContain('path=');
  });

  it('findes ikke på mobil, fordi opstarten returnerer FØR rutetræet monteres', () => {
    // Mobilen skal fortsat kun have sin egen «Desværre»-side. Gaten er en tidlig `return` i
    // opstarten: renderes `UnsupportedDevicePage`, kaldes `renderApp` (og dermed React Router)
    // aldrig, så ingen adresse på en telefon kan nå 404-siden.
    const bootstrapSource = readSource('src/apps/shared/bootstrapClientApp.tsx');

    const unsupportedBranch = /if \(unsupportedDevice\) \{([\s\S]*?)\n {2}\}/.exec(bootstrapSource);
    expect(unsupportedBranch).not.toBeNull();
    expect(unsupportedBranch![1]).toContain('UnsupportedDevicePage');
    expect(unsupportedBranch![1]).toContain('return;');

    // Og `renderApp` må først kaldes EFTER den gren – ellers ville rækkefølgen ikke holde.
    expect(bootstrapSource.indexOf('if (unsupportedDevice) {'))
      .toBeLessThan(bootstrapSource.indexOf('await options.renderApp()'));
  });
});
