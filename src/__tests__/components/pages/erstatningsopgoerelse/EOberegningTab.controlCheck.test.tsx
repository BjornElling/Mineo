import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';

import EOberegningTab from '../../../../components/pages/erstatningsopgoerelse/EOberegningTab';
import { AppSettingsProvider } from '../../../../contexts/AppSettingsContext';
import { FormPersistenceProvider } from '../../../../contexts/FormPersistenceContext';
import { buildControlMismatchInvariant } from '../../../../domain/erstatningsopgoerelse/eoSnapshotInvariants';
import { createErstatningsopgoerelseInitialValues } from '../../../../domain/erstatningsopgoerelse/erstatningsopgoerelseInitialValues';
import { computeEoSnapshot } from '../../../../domain/erstatningsopgoerelse/eoSnapshot';
import { STAMDATA_INITIAL_VALUES } from '../../../../domain/stamdata/stamdataInitialValues';
import type { EoSnapshot } from '../../../../domain/erstatningsopgoerelse/eoSnapshot';
import type { MoneyOre } from '../../../../domain/erstatningsopgoerelse/eoPdfModel';

const { collectAllDebugRowsMock } = vi.hoisted(() => ({
  collectAllDebugRowsMock: vi.fn(),
}));

vi.mock('../../../../hooks/useFormFieldErrors', () => ({
  useFieldErrorsBySourceForSection: () => ({}),
}));

vi.mock('../../../../domain/debug/eoDebugRowAggregator', () => ({
  collectAllDebugRows: collectAllDebugRowsMock,
}));

vi.mock('../../../../utils/scrollToSection', () => ({
  scrollToSection: vi.fn(),
}));

vi.mock('../../../../utils/logger', () => ({
  logError: vi.fn(),
  logWarning: vi.fn(),
  logInfo: vi.fn(),
}));

const renderTab = (props: React.ComponentProps<typeof EOberegningTab>) => {
  return render(
    <MemoryRouter>
      <AppSettingsProvider>
        <FormPersistenceProvider>
          <EOberegningTab {...props} />
        </FormPersistenceProvider>
      </AppSettingsProvider>
    </MemoryRouter>
  );
};

describe('EOberegningTab kontroltjek', () => {
  const baseStamdataValues = structuredClone(STAMDATA_INITIAL_VALUES);
  const baseEoValues = createErstatningsopgoerelseInitialValues();
  const baseSetEoValues = vi.fn();

  beforeEach(() => {
    baseSetEoValues.mockReset();
    collectAllDebugRowsMock.mockReset();
    collectAllDebugRowsMock.mockReturnValue({ errors: [], warnings: [], allRows: [], relevantRows: [] });
  });

  it('samler kontroluoverensstemmelse i én contentbox for fejl og advarsler', () => {
    const snapshot: EoSnapshot = {
      revision: 'rev-1',
      status: 'error',
      invariants: [
        buildControlMismatchInvariant([
          'Ansættelsesforhold: beregnet=100, tabel=90',
        ]),
      ],
      data: null,
      input: {
        stamdata: baseStamdataValues,
        erstatningsopgoerelse: baseEoValues,
      },
    };

    renderTab({
      activeTab: 'beregning',
      setActiveTab: vi.fn(),
      isActive: true,
      eoSnapshot: snapshot,
      stamdataValues: baseStamdataValues,
      eoValues: baseEoValues,
      setEOValues: baseSetEoValues,
    });

    expect(screen.getByText('Fejl og advarsler')).toBeInTheDocument();
    expect(screen.getByText('Der er konstateret kontroluoverensstemmelser i EO-beregningen.')).toBeInTheDocument();
    expect(screen.queryByText('Download-kontroller')).not.toBeInTheDocument();
    expect(screen.queryByText('Systemfejl')).not.toBeInTheDocument();
    expect(screen.queryByText('Beregning blokeret')).not.toBeInTheDocument();
  });

  it('samler projektion-blokering i fejl og advarsler når dokumentmodel divergerer fra snapshot', () => {
    const eoValues = createErstatningsopgoerelseInitialValues();
    eoValues.vedroererPeriodeFra = '2024-01-01';
    eoValues.vedroererPeriodeTil = '2024-01-31';
    eoValues.beregnesSvieSmerteGodtgoerelse = 'Nej';
    eoValues.beregnesTabtArbejdsfortjeneste = 'Nej';
    eoValues.oevrigeKravPerioder = [
      {
        id: 'krav-1',
        dato: '2024-01-15',
        udgiftTil: 'Transport',
        beloeb: { kind: 'number', value: 1200 },
      },
    ];

    const computedSnapshot = computeEoSnapshot({
      revision: 'rev-mismatch',
      stamdataValues: baseStamdataValues,
      eoValues,
    });
    expect(computedSnapshot.data).not.toBeNull();

    const mismatchSnapshot: EoSnapshot = {
      ...computedSnapshot,
      data: computedSnapshot.data && {
        ...computedSnapshot.data,
        totals: {
          ...computedSnapshot.data.totals,
          samletTotalOre: 999999 as MoneyOre,
        },
      },
    };

    renderTab({
      activeTab: 'beregning',
      setActiveTab: vi.fn(),
      isActive: true,
      eoSnapshot: mismatchSnapshot,
      stamdataValues: baseStamdataValues,
      eoValues,
      setEOValues: baseSetEoValues,
    });

    expect(screen.getByText('Fejl og advarsler')).toBeInTheDocument();
    expect(screen.getByText('Dokumentmodellen matcher ikke snapshot-totalerne.')).toBeInTheDocument();
    expect(screen.queryByText('Download-kontroller')).not.toBeInTheDocument();
  });

  it('viser brugerens manglende indtastning som navigerbar fejl og ikke som systemfejl', () => {
    collectAllDebugRowsMock.mockReturnValue({
      errors: [{
        id: 'loenindkomst.af1.regulering.valgtRegulering',
        label: 'Valgt regulering',
        displayValue: 'Fejl (Lønudvikling beregnes ud fra mangler)',
        status: 'error',
        message: 'Lønudvikling beregnes ud fra mangler',
        summaryDisplay: 'default',
        navigation: {
          kind: 'erstatningsopgoerelse-tab',
          tabId: 'loenindkomst',
          tabName: 'Lønindkomst',
          sectionTitle: 'Lønindkomst',
        },
      }],
      warnings: [],
      allRows: [],
      relevantRows: [],
    });

    const snapshot: EoSnapshot = {
      revision: 'rev-2',
      status: 'error',
      invariants: [{
        id: 'taf_per_year:missing_loenudvikling',
        passed: false,
        severity: 'error',
        message: 'TAF fordelt på år kan ikke genereres, fordi lønudvikling ikke kunne beregnes autoritativt.',
        blocksOutputs: ['taf_per_year_pdf'],
      }],
      data: null,
      input: {
        stamdata: baseStamdataValues,
        erstatningsopgoerelse: baseEoValues,
      },
    };

    renderTab({
      activeTab: 'beregning',
      setActiveTab: vi.fn(),
      isActive: true,
      eoSnapshot: snapshot,
      stamdataValues: baseStamdataValues,
      eoValues: baseEoValues,
      setEOValues: baseSetEoValues,
    });

    expect(screen.getByText('Fejl og advarsler')).toBeInTheDocument();
    expect(screen.getByText("Der mangler at blive angivet lønregulering, evt. 'Ingen'")).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lønindkomst' })).toBeInTheDocument();
    expect(screen.queryByText('Send fejloplysninger')).not.toBeInTheDocument();
    expect(screen.queryByText('Systemfejl')).not.toBeInTheDocument();
    expect(screen.queryByText('TAF fordelt på år kan ikke genereres, fordi lønudvikling ikke kunne beregnes autoritativt.')).not.toBeInTheDocument();
  });

  it('viser ikke TAF afrunding over 1 kr. som systemfejl i fejlsektionen', () => {
    const snapshot: EoSnapshot = {
      revision: 'rev-3',
      status: 'error',
      invariants: [{
        id: 'taf_per_year:afrunding_over_100',
        passed: false,
        severity: 'error',
        message: 'TAF fordelt på år kan ikke afstemmes inden for 1 kr.',
        blocksOutputs: ['taf_per_year_pdf'],
      }],
      data: null,
      input: {
        stamdata: baseStamdataValues,
        erstatningsopgoerelse: baseEoValues,
      },
    };

    renderTab({
      activeTab: 'beregning',
      setActiveTab: vi.fn(),
      isActive: true,
      eoSnapshot: snapshot,
      stamdataValues: baseStamdataValues,
      eoValues: baseEoValues,
      setEOValues: baseSetEoValues,
    });

    expect(screen.queryByText('Fejl og advarsler')).not.toBeInTheDocument();
    expect(screen.queryByText('TAF fordelt på år kan ikke afstemmes inden for 1 kr.')).not.toBeInTheDocument();
  });
});
