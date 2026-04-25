import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import App from '../App';
import { LOCAL_STORAGE_KEY, writeLocalStorage } from '../settings/appSettingsStorage';
import { DEFAULT_APP_SETTINGS } from '../settings/appSettingsSchema';

vi.mock('../contexts/FormPersistenceContext', () => ({
  FormPersistenceProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('../components/layout/MainLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('../components/errors/ErrorBoundary', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../components/pages/Stamdata', () => ({
  default: () => <div>MOCK_STAMDATA</div>,
}));

vi.mock('../components/pages/Erstatningsopgoerelse', () => ({
  default: () => <div>MOCK_EO</div>,
}));

vi.mock('../components/pages/Erhvervsevnetab', () => ({
  default: () => <div>MOCK_EET</div>,
}));

vi.mock('../components/pages/Satser', () => ({
  default: () => <div>MOCK_SATSER</div>,
}));

vi.mock('../components/pages/Renteberegning', () => ({
  default: () => <div>MOCK_RENTE</div>,
}));

vi.mock('../components/pages/Aarsloen', () => ({
  default: () => <div>MOCK_AARSLOEN</div>,
}));

vi.mock('../components/pages/VarigeMen', () => ({
  default: () => <div>MOCK_VM</div>,
}));

vi.mock('../components/pages/Forsoergertab', () => ({
  default: () => <div>MOCK_FT</div>,
}));

vi.mock('../components/pages/Indstillinger', () => ({
  default: () => <div>MOCK_INDSTILLINGER</div>,
}));

vi.mock('../components/pages/Mineo', () => ({
  default: () => <div>MOCK_Mineo</div>,
}));

vi.mock('../components/pages/OpenEo', () => ({
  default: () => <div>MOCK_OPEN</div>,
}));

describe('App default landing route', () => {
  beforeEach(() => {
    window.history.pushState({}, '', '/');
    writeLocalStorage(LOCAL_STORAGE_KEY, '');
  });

  it('lander på Mineo når standard-startside-setting er false', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('MOCK_Mineo')).toBeInTheDocument();
    });
    expect(window.location.pathname).toBe('/mineo');
  });

  it('lander på Stamdata når standard-startside-setting er true', async () => {
    writeLocalStorage(LOCAL_STORAGE_KEY, JSON.stringify({
      ...DEFAULT_APP_SETTINGS,
      defaultStartsideErStamdata: true,
    }));

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('MOCK_STAMDATA')).toBeInTheDocument();
    });
    expect(window.location.pathname).toBe('/stamdata');
  });
});
