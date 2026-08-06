// @vitest-environment jsdom
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link } from 'react-router-dom';
import App from '../App';
import { ALL_APP_PAGE_ROUTES, APP_ROUTES } from '../config/pageNavigation';
import { bootstrapProductionInputRuntime } from '../inputCore/react';
import { LOCAL_STORAGE_KEY, writeLocalStorage } from '../settings/appSettingsStorage';
import { DEFAULT_APP_SETTINGS } from '../settings/appSettingsSchema';

/**
 * Tæller hvor mange gange shellen er MOUNTET.
 *
 * Vigtig præcisering af hvad denne test beviser: den hævder at layoutet MONTERES ÉN GANG og
 * bevares på tværs af navigation. Det er en egenskab, der skal blive ved med at holde — men
 * den var også opfyldt før layout-routen, fordi React reconciler samme komponenttype på tværs
 * af søskende-routes. Testen er derfor et VÆRN mod en fremtidig ændring der bryder det (fx et
 * `key` på shell-elementet, en betinget wrapper eller en shell flyttet ind i den enkelte side)
 * — ikke dokumentation for en rettet remount-fejl.
 */
let shellMountCount = 0;

vi.mock('../components/layout/MainLayout', () => {
  const MockMainLayout = ({ children }: { children: React.ReactNode }) => {
    React.useEffect(() => {
      shellMountCount += 1;
    }, []);
    return (
      <div>
        <div>SHELL</div>
        {children}
      </div>
    );
  };
  return { default: MockMainLayout };
});

vi.mock('../components/errors/ErrorBoundary', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// En simpel side pr. route med et router-`Link` videre, så navigationen sker som en rigtig
// client-side route-ændring (et bart `<a href>` ville udløse et fuldt page-load i jsdom og
// dermed teste noget andet end shellens levetid).
const mockPage = (label: string, linkTo: string) => ({
  default: () => (
    <div>
      <div>{label}</div>
      <Link to={linkTo}>GÅ_VIDERE</Link>
    </div>
  ),
});

vi.mock('../components/pages/Stamdata', () => mockPage('MOCK_STAMDATA', '/satser'));
vi.mock('../components/pages/Satser', () => mockPage('MOCK_SATSER', '/stamdata'));
vi.mock('../components/pages/Erstatningsopgoerelse', () => ({ default: () => <div>MOCK_EO</div> }));
vi.mock('../components/pages/Erhvervsevnetab', () => ({ default: () => <div>MOCK_EET</div> }));
vi.mock('../components/pages/Renteberegning', () => ({ default: () => <div>MOCK_RENTE</div> }));
vi.mock('../components/pages/Aarsloen', () => ({ default: () => <div>MOCK_AARSLOEN</div> }));
vi.mock('../components/pages/VarigeMen', () => ({ default: () => <div>MOCK_VM</div> }));
vi.mock('../components/pages/Forsoergertab', () => ({ default: () => <div>MOCK_FT</div> }));
vi.mock('../components/pages/Indstillinger', () => ({ default: () => <div>MOCK_INDSTILLINGER</div> }));
vi.mock('../components/pages/Mineo', () => ({ default: () => <div>MOCK_Mineo</div> }));
vi.mock('../components/system/OpenEo', () => ({ default: () => <div>MOCK_OPEN</div> }));

describe('App-shell', () => {
  beforeEach(() => {
    shellMountCount = 0;
    window.history.pushState({}, '', '/stamdata');
    writeLocalStorage(LOCAL_STORAGE_KEY, JSON.stringify({
      ...DEFAULT_APP_SETTINGS,
      defaultStartsideErStamdata: true,
    }));
  });

  it('monterer shellen ÉN gang og bevarer den på tværs af navigation', async () => {
    render(<App inputRuntimeBinding={bootstrapProductionInputRuntime().binding} />);

    await waitFor(() => {
      expect(screen.getByText('MOCK_STAMDATA')).toBeInTheDocument();
    });
    expect(shellMountCount).toBe(1);

    // Naviger til en anden side gennem routeren.
    await userEvent.click(screen.getByText('GÅ_VIDERE'));

    await waitFor(() => {
      expect(screen.getByText('MOCK_SATSER')).toBeInTheDocument();
    });
    expect(screen.getByText('SHELL')).toBeInTheDocument();

    // Shellen er ikke remountet af navigationen.
    expect(shellMountCount).toBe(1);
  });

  it('bryder hvis shellen får en per-route identitet', () => {
    // Mutationsværn for testen ovenfor: dét der VILLE remounte layoutet er en skiftende
    // identitet pr. route (fx `key={pathname}`). Her bevises mekanismen isoleret, så
    // mount-tællingen ikke er grøn af tomhed.
    let mounts = 0;
    const Probe = () => {
      React.useEffect(() => { mounts += 1; }, []);
      return <div>PROBE</div>;
    };

    const { rerender } = render(<Probe key="/stamdata" />);
    expect(mounts).toBe(1);

    // Samme komponenttype, men ny key → React unmounter og monterer igen.
    rerender(<Probe key="/satser" />);
    expect(mounts).toBe(2);
  });

  it('renderer alle katalogets routes under shellen', async () => {
    // Værn mod at en route findes i kataloget uden at være wired i App (eller omvendt).
    // `App.tsx` har en import-tids-guard for netop det; her bevises den udefra på en
    // repræsentativ route, som ikke er startsiden.
    window.history.pushState({}, '', APP_ROUTES.erstatningsopgoerelse);

    render(<App inputRuntimeBinding={bootstrapProductionInputRuntime().binding} />);

    await waitFor(() => {
      expect(screen.getByText('MOCK_EO')).toBeInTheDocument();
    });
    expect(screen.getByText('SHELL')).toBeInTheDocument();
  });

  it('rute-inventaret dækker både sagssider og systemsider', () => {
    // 8 persisterede fagsider + 3 systemsider (/open, /indstillinger, /mineo).
    expect(ALL_APP_PAGE_ROUTES).toHaveLength(11);
    expect(ALL_APP_PAGE_ROUTES).toContain('/open');
    expect(ALL_APP_PAGE_ROUTES).toContain('/indstillinger');
    expect(ALL_APP_PAGE_ROUTES).toContain('/mineo');
    expect(ALL_APP_PAGE_ROUTES).toContain(APP_ROUTES.stamdata);
    // Ingen dubletter — to katalogkilder må ikke kunne producere samme route.
    expect(new Set(ALL_APP_PAGE_ROUTES).size).toBe(ALL_APP_PAGE_ROUTES.length);
  });
});
