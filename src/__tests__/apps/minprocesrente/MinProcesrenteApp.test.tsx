// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { bootstrapProductionInputRuntime } from '../../../inputCore/react';

// Greenfield-migreret standalone (§2.4 trin 4): MinProcesrente kører nu på den ENE greenfield input-runtime, ikke
// legacy FormPersistence. Denne test dækker den standalone-specifikke shell-adfærd (mobil-scroll-fix + mount).
// Commit/undo-adfærden dækkes af de rene runtime-/reducer-tests og Renteberegning-integrationstesten, ikke her.

vi.mock('../../../components/pages/renteberegning/RenteberegningTab', () => ({
  __esModule: true,
  default: () => <section aria-label="Procesrente beregner" />,
}));

import MinProcesrenteApp from '../../../apps/minprocesrente/MinProcesrenteApp';

const renderStandalone = () => {
  const { binding } = bootstrapProductionInputRuntime();
  return render(<MinProcesrenteApp inputRuntimeBinding={binding} />);
};

describe('MinProcesrenteApp', () => {
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    window.history.replaceState(null, '', '/');
    sessionStorage.clear();
    window.matchMedia = originalMatchMedia;
    document.documentElement.style.backgroundColor = '';
    document.body.innerHTML = '<div id="root"></div>';
    document.body.style.backgroundColor = '';
    document.body.style.overflow = '';
    document.body.style.overflowX = '';
    document.body.style.overflowY = '';
    document.body.style.height = '';
    document.body.style.width = '';
    document.body.style.maxWidth = '';
    document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => meta.remove());
    const themeColorMeta = document.createElement('meta');
    themeColorMeta.name = 'theme-color';
    themeColorMeta.content = '#e9ecef';
    document.head.appendChild(themeColorMeta);
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it('monterer standalone-beregneren på den greenfield input-runtime', () => {
    renderStandalone();
    expect(screen.getByRole('heading', { name: 'minProcesrente.dk' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Procesrente beregner' })).toBeInTheDocument();
  });

  it('sætter mobilens browser-chrome til samme baggrund som siden på touch-enheder', () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query === '(pointer: coarse)',
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    const { unmount } = renderStandalone();

    expect(document.documentElement.style.backgroundColor).toBe('rgb(248, 249, 250)');
    expect(document.body.style.backgroundColor).toBe('rgb(248, 249, 250)');
    expect(document.body.style.overflowX).toBe('hidden');
    expect(document.body.style.overflowY).toBe('auto');
    expect(document.body.style.width).toBe('100%');
    expect(document.body.style.maxWidth).toBe('100%');
    expect(document.getElementById('root')?.style.backgroundColor).toBe('rgb(248, 249, 250)');
    expect(document.getElementById('root')?.style.overflowX).toBe('hidden');
    expect(document.getElementById('root')?.style.overflowY).toBe('auto');
    expect(document.getElementById('root')?.style.width).toBe('100%');
    expect(document.getElementById('root')?.style.maxWidth).toBe('100%');
    expect(document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.content).toBe('#f8f9fa');

    unmount();

    expect(document.documentElement.style.backgroundColor).toBe('');
    expect(document.body.style.backgroundColor).toBe('');
    expect(document.body.style.overflowX).toBe('');
    expect(document.body.style.overflowY).toBe('');
    expect(document.body.style.width).toBe('');
    expect(document.body.style.maxWidth).toBe('');
    expect(document.getElementById('root')?.style.backgroundColor).toBe('');
    expect(document.getElementById('root')?.style.overflowX).toBe('');
    expect(document.getElementById('root')?.style.overflowY).toBe('');
    expect(document.getElementById('root')?.style.width).toBe('');
    expect(document.getElementById('root')?.style.maxWidth).toBe('');
    expect(document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.content).toBe('#e9ecef');
  });
});
