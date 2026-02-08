import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';

import EOberegningTab from '../../../../components/pages/erstatningsopgoerelse/EOberegningTab';
import { AppSettingsProvider } from '../../../../contexts/AppSettingsContext';
import { FormPersistenceProvider } from '../../../../contexts/FormPersistenceContext';
import { createErstatningsopgoerelseInitialValues } from '../../../../domain/erstatningsopgoerelse/erstatningsopgoerelseInitialValues';
import { STAMDATA_INITIAL_VALUES } from '../../../../domain/stamdata/stamdataInitialValues';

const { mockSections, generateErstatningsopgoerelsePdfMock, loadErstatningsopgoerelsePdfModuleMock } = vi.hoisted(() => {
  return {
    mockSections: {} as Record<string, unknown>,
    generateErstatningsopgoerelsePdfMock: vi.fn(),
    loadErstatningsopgoerelsePdfModuleMock: vi.fn(async () => ({
      generateErstatningsopgoerelsePdf: generateErstatningsopgoerelsePdfMock,
    })),
  };
});

vi.mock('../../../../hooks/usePersistedSection', () => ({
  usePersistedSection: (sectionKey: string) => mockSections[sectionKey] ?? null,
}));

vi.mock('../../../../hooks/useFormFieldErrors', () => ({
  useFieldErrorsBySourceForSection: () => ({}),
}));

vi.mock('../../../../domain/erstatningsopgoerelse/eoDebugRowAggregator', () => ({
  collectAllDebugRows: () => ({ errors: [], warnings: [], allRows: [], relevantRows: [] }),
}));

vi.mock('../../../../calculation/useErstatningsopgoerelseAggregation', () => ({
  useErstatningsopgoerelseAggregation: () => null,
}));

vi.mock('../../../../utils/scrollToSection', () => ({
  scrollToSection: vi.fn(),
}));

vi.mock('../../../../utils/pdf/pdfLoader', () => ({
  loadErstatningsopgoerelsePdfModule: loadErstatningsopgoerelsePdfModuleMock,
  loadTafFordeltPaaAarPdfModule: vi.fn(async () => ({ generateTafFordeltPaaAarPdf: vi.fn() })),
}));

describe('EOberegningTab PDF-afslutning', () => {
  beforeEach(() => {
    generateErstatningsopgoerelsePdfMock.mockReset();
    loadErstatningsopgoerelsePdfModuleMock.mockClear();

    const eoValues = createErstatningsopgoerelseInitialValues();
    eoValues.erstatningsopgoerelseAfsluttesMed = 'Underskrift-linje';

    mockSections.stamdata = structuredClone(STAMDATA_INITIAL_VALUES);
    mockSections.erstatningsopgoerelse = eoValues;
  });

  it('sender committed EO-værdi for afslutningstype til PDF-generator', async () => {
    render(
      <MemoryRouter>
        <AppSettingsProvider>
          <FormPersistenceProvider>
            <EOberegningTab
              activeTab="beregning"
              setActiveTab={vi.fn()}
              isActive={true}
              debugSnapshot={null}
              currentDebugRevision="rev-1"
            />
          </FormPersistenceProvider>
        </AppSettingsProvider>
      </MemoryRouter>
    );

    fireEvent.click(screen.getAllByTestId('DownloadIcon')[0]);

    await waitFor(() => expect(generateErstatningsopgoerelsePdfMock).toHaveBeenCalledTimes(1));

    const options = generateErstatningsopgoerelsePdfMock.mock.calls[0]?.[3];
    expect(options.erstatningsopgoerelseAfsluttesMed).toBe('Underskrift-linje');
  });
});
