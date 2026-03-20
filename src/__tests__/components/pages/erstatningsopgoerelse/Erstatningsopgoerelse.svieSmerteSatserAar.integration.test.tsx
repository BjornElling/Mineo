// @vitest-environment jsdom
import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import Erstatningsopgoerelse from '../../../../components/pages/Erstatningsopgoerelse';
import { AppSettingsProvider } from '../../../../contexts/AppSettingsContext';
import { FormPersistenceProvider } from '../../../../contexts/FormPersistenceContext';
import { useFormPersistence } from '../../../../contexts/useFormPersistence';
import { createErstatningsopgoerelseInitialValues } from '../../../../domain/erstatningsopgoerelse/erstatningsopgoerelseInitialValues';

describe('Erstatningsopgoerelse svie/smerte sats-aar integration', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('viser sats-aar advarslen i Beregning-fanen på den rigtige side', async () => {
    let ctx: ReturnType<typeof useFormPersistence> | null = null;

    const Probe = () => {
      const value = useFormPersistence();
      React.useEffect(() => {
        ctx = value;
      }, [value]);
      return null;
    };

    render(
      <MemoryRouter>
        <AppSettingsProvider>
          <FormPersistenceProvider>
            <Probe />
            <Erstatningsopgoerelse />
          </FormPersistenceProvider>
        </AppSettingsProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(ctx).not.toBeNull();
    });
    const persistence = ctx;
    expect(persistence).not.toBeNull();

    act(() => {
      persistence.replaceAllPersistedData({
        stamdata: undefined,
        erstatningsopgoerelse: {
          ...createErstatningsopgoerelseInitialValues(),
          opgørelseLavetDen: '2025-12-15',
          svieSmerteSatserAar: 2025,
          revideretOpgoerelse: 'Nej',
        },
        satser: undefined,
        aarsloen: undefined,
        faellesAarsloen: undefined,
        faellesPersondata: undefined,
        renteberegning: undefined,
        varigemen: undefined,
        forsoergertab: undefined,
        erhvervsevnetab: undefined,
      });
    });

    fireEvent.click(screen.getByRole('tab', { name: 'Beregning' }));

    await waitFor(() => {
      expect(screen.getByText('Svie/smerte satsen for 2026 kan anvendes.')).toBeInTheDocument();
    });
  });
});
