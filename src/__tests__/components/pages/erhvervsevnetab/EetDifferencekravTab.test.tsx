import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import EetDifferencekravTab from '../../../../components/pages/erhvervsevnetab/EetDifferencekravTab';
import { toISODateString } from '../../../../types/branded';

vi.mock('../../../../contexts/useAppSettings', () => ({
  useAppSettings: () => ({
    settings: {},
  }),
}));

vi.mock('../../../../pdf/infrastructure/pdfService', () => ({
  downloadDifferencekravPdf: vi.fn(),
}));

vi.mock('../../../../hooks/useShakeFlag', () => ({
  useEetShakeFlag: () => ({
    shake: false,
    triggerShake: vi.fn(),
  }),
}));

describe('EetDifferencekravTab', () => {
  it('udelader overflødig tekst for midlertidig afgørelse når skaden er sket den 16. juni 2011 eller senere', () => {
    render(
      <MemoryRouter>
        <EetDifferencekravTab
          values={{
            koen: 'Kvinde',
            eetDifferencekravBilagSelection: {
              loebendeYdelser: false,
              kapitalisering: false,
              eetEfterEal: false,
              proformaKapitalisering: false,
    merErstatningPensionsalder: false,
              visUdvidetSpecifikationLoebendeYdelserBilag: false,
            },
          } as never}
          setValues={vi.fn()}
          onGoToEetOplysninger={vi.fn()}
          stamdata={null}
          snapshot={{
            issues: [],
            hasBlockingErrors: false,
            computation: {
              beregningsdato: toISODateString('2026-03-17'),
              fradragGaelderForFoer2011: false,
              ealEetPct: 15,
              ealKrav: 100000,
              afgoerelser: [{
                rowId: 'a1',
                afgoerelsesdato: toISODateString('2020-01-01'),
                virkningsdato: toISODateString('2020-02-01'),
                afgoerelseType: 'Midlertidig',
                eetPct: 15,
                beloeb: 0,
                fradragForetages: false,
                fradragesTil: null,
              }],
              kapitaliseringerAfgoerelser: [],
              proformaKapitalisering: null,
              differencekrav: 100000,
            },
          } as never}
        />
      </MemoryRouter>
    );

    expect(screen.getByText('Midlertidig afgørelse')).toBeInTheDocument();
    expect(screen.queryByText('Løbende ydelser derfor ikke relevante.')).not.toBeInTheDocument();
  });
});
