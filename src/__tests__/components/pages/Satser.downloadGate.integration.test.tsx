// @vitest-environment jsdom
//
// Greenfield Satser-slice (§2.4 + Fase 3): Satser-sidens `aargang` er nu et `YearField` over den ene
// input-runtime. Denne integrationstest kører gennem den RIGTIGE migrerede side + den ægte produktions-runtime
// (`ProductionInputRuntimeProvider` mod `slimInputStore`/`criticalActionCoordinator`) — den beviser den
// virkelige sti felt → settle → reader-projektion → download-gate (§1.5/§1.6/§3.9), uden legacy
// `invalidDrafts`/`FormPersistenceProvider`.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Satser from '../../../components/pages/Satser';
import { AppSettingsProvider } from '../../../contexts/AppSettingsContext';
import { RoutePathnameProvider } from '../../../contexts/RoutePathnameProvider';
import { satserAngivAarYearBounds } from '../../../data/lovbestemteRates';
import { slimInputStore } from '../../../inputCore/runtime/slimInputStore';
import { getProductionInputCatalog } from '../../../inputCore/catalog/productionCatalog';
import {
  ProductionInputRuntimeProvider,
  createProductionInputRuntimeBinding,
} from '../../../inputCore/react/productionInputRuntime';

/**
 * Fase 5: testen måler nu på livscyklussens IRREVERSIBLE handling (`triggerDocumentDownload`) frem
 * for på et servicekald. Det er en strammere assertion: den beviser, at hele kæden — barriere,
 * frisk capture, token-lighed, gate, lazy-load, friskheds-recheck, rendering — faktisk kørte til
 * ende, ikke bare at en funktion blev kaldt.
 */
const mockTriggerDocumentDownload = vi.hoisted(() => vi.fn());

vi.mock('../../../document/downloadArtifact', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../../document/downloadArtifact')>(),
  triggerDocumentDownload: mockTriggerDocumentDownload,
}));

const catalog = getProductionInputCatalog();

// Hydrer produktions-runtime med en committed årgang (som en indlæst sag). `hydrate` skaber en ny revision, så
// den token-cachede evaluering i produktions-wiringen genberegnes rent pr. test.
const hydrateCommittedAargang = (aargang: number): void => {
  const input = catalog.validateSettledInput({
    sections: {
      stamdata: null, satser: { aargang }, aarsloen: null, faellesAarsloen: null, renteberegning: null,
      varigemen: null, forsoergertab: null, erstatningsopgoerelse: null, erhvervsevnetab: null,
    },
    rejectedInputs: {},
  });
  slimInputStore.hydrate(input);
};

const renderSatser = (committedAargang: number) => {
  hydrateCommittedAargang(committedAargang);
  return render(
    <MemoryRouter initialEntries={['/satser']}>
      <AppSettingsProvider>
        <RoutePathnameProvider>
          <ProductionInputRuntimeProvider binding={createProductionInputRuntimeBinding()}>
            <Satser />
          </ProductionInputRuntimeProvider>
        </RoutePathnameProvider>
      </AppSettingsProvider>
    </MemoryRouter>
  );
};

const getYearInput = () => screen.getByRole('textbox') as HTMLInputElement;
// Satser-siden har præcis én knap (download-knappen). Dens aria-label skifter til gate-årsagen når
// den er deaktiveret, så vi adresserer den strukturelt frem for på "download"-teksten.
const getDownloadButton = () => screen.getByRole('button');

describe('Satser download-gate — afsluttet ugyldigt årstal blokerer download', () => {
  beforeEach(() => {
    sessionStorage.clear();
    mockTriggerDocumentDownload.mockClear();
  });

  it('download er aktiv for en gyldig committed årgang', () => {
    renderSatser(satserAngivAarYearBounds.maxYear);
    expect(getDownloadButton()).toBeEnabled();
    expect(screen.getByText(`Arbejdsskadesatser ${satserAngivAarYearBounds.maxYear}`)).toBeInTheDocument();
  });

  it('en afsluttet ugyldig årgang oven på en gyldig committed årgang blokerer download (§1.5)', async () => {
    const user = userEvent.setup();
    renderSatser(satserAngivAarYearBounds.maxYear);
    const input = getYearInput();

    // Download er aktiv på den gyldige committede årgang.
    expect(getDownloadButton()).toBeEnabled();

    // Erstat med et uparseligt årstal og afslut redigeringen (blur).
    await user.dblClick(input);
    await user.clear(input);
    await user.type(input, '123');
    await user.tab();

    // Den rå ugyldige streng er nu afsluttet input (rejected), og gaten blokerer download — den tidligere gyldige
    // canonical årgang er FJERNET fra current state (§1.5) og når hverken visning eller gate.
    expect(input).toHaveValue('123');
    expect(getDownloadButton()).toBeDisabled();
    expect(screen.getByText('Arbejdsskadesatser')).toBeInTheDocument();
    expect(screen.getByText('Vælg et gyldigt år for at se satserne.')).toBeInTheDocument();
    expect(screen.queryByText(`Arbejdsskadesatser ${satserAngivAarYearBounds.maxYear}`)).not.toBeInTheDocument();
  });

  it('en åben ugyldig draft ændrer intet afsluttet; et downloadklik settler først og når ikke servicen (§1.2/§1.4)', async () => {
    const user = userEvent.setup();
    renderSatser(satserAngivAarYearBounds.maxYear);
    const input = getYearInput();

    await user.dblClick(input);
    await user.clear(input);
    await user.type(input, '123');

    // Åben draft er ikke afsluttet input (§1.2): visning og gate bruger fortsat den senest afsluttede årgang.
    expect(input).toHaveValue('123');
    expect(getDownloadButton()).toBeEnabled();
    expect(screen.getByText(`Arbejdsskadesatser ${satserAngivAarYearBounds.maxYear}`)).toBeInTheDocument();

    // Downloadklik settler den åbne editor først (§1.4). Settle gør årgangen rejected → gaten blokerer, og
    // dokumentservicen nås aldrig.
    await user.click(getDownloadButton());

    expect(getDownloadButton()).toBeDisabled();
    expect(mockTriggerDocumentDownload).not.toHaveBeenCalled();
  });

  it('at rette den ugyldige årgang tilbage til en gyldig værdi åbner download igen', async () => {
    const user = userEvent.setup();
    renderSatser(satserAngivAarYearBounds.maxYear);
    const input = getYearInput();

    await user.click(input);
    await user.keyboard('{Control>}a{/Control}{Delete}');
    await user.type(input, '123');
    await user.tab();
    expect(getDownloadButton()).toBeDisabled();

    // Ret til en gyldig årgang: den rejected råtekst ryddes, gaten åbner igen.
    await user.click(input);
    await user.keyboard('{Control>}a{/Control}{Delete}');
    await user.type(input, String(satserAngivAarYearBounds.maxYear));
    await user.tab();

    expect(getDownloadButton()).toBeEnabled();
    expect(screen.getByText(`Arbejdsskadesatser ${satserAngivAarYearBounds.maxYear}`)).toBeInTheDocument();
  });

  it('download af en gyldig årgang gennemfører hele livscyklussen og leverer et dokument', async () => {
    const user = userEvent.setup();
    renderSatser(satserAngivAarYearBounds.maxYear);

    await user.click(getDownloadButton());

    // Hele kæden kørte: barriere → frisk capture → token-lighed → gate → generator-load →
    // writer-load → rendering → friskheds-recheck → fil-I/O.
    await vi.waitFor(() => expect(mockTriggerDocumentDownload).toHaveBeenCalledTimes(1));
    const artifact = mockTriggerDocumentDownload.mock.calls[0]?.[0] as { filename: string };
    expect(artifact.filename).toContain(String(satserAngivAarYearBounds.maxYear));
  });
});
