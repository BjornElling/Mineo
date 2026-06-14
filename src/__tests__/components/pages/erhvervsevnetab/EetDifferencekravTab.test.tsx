import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import EetDifferencekravTab from '../../../../components/pages/erhvervsevnetab/EetDifferencekravTab';
import { FormPersistenceProvider } from '../../../../contexts/FormPersistenceContext';
import { toISODateString, type ISODateString } from '../../../../types/branded';

vi.mock('../../../../contexts/useAppSettings', () => ({
  useAppSettings: () => ({
    settings: {},
  }),
}));

vi.mock('../../../../pdf/infrastructure/pdfService', () => ({
  downloadDifferencekravDokument: vi.fn(),
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
        <FormPersistenceProvider>
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
            forligValues={{ forligAnsvarsgradProcent: undefined, forligAnsvarsgradBroek: undefined, forligDato: undefined }}
            setForligValues={vi.fn()}
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
                differencekravFoerForlig: 100000,
                forligFactor: null,
                forligLabel: null,
                differencekrav: 100000,
              },
            } as never}
          />
        </FormPersistenceProvider>
      </MemoryRouter>
    );

    expect(screen.getByText('Midlertidig afgørelse')).toBeInTheDocument();
    expect(screen.queryByText('Løbende ydelser derfor ikke relevante.')).not.toBeInTheDocument();
  });

  const renderTab = (overrides: {
    forligValues?: { forligAnsvarsgradProcent: number | undefined; forligAnsvarsgradBroek: string | undefined; forligDato: ISODateString | undefined };
    computation: Record<string, unknown>;
    hasBlockingErrors?: boolean;
    issues?: ReadonlyArray<{ id: string; severity: string; message: string }>;
  }) =>
    render(
      <MemoryRouter>
        <FormPersistenceProvider>
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
            forligValues={overrides.forligValues ?? { forligAnsvarsgradProcent: undefined, forligAnsvarsgradBroek: undefined, forligDato: undefined }}
            setForligValues={vi.fn()}
            onGoToEetOplysninger={vi.fn()}
            stamdata={null}
            snapshot={{
              issues: overrides.issues ?? [],
              hasBlockingErrors: overrides.hasBlockingErrors ?? false,
              computation: overrides.hasBlockingErrors ? null : (overrides.computation as never),
            } as never}
          />
        </FormPersistenceProvider>
      </MemoryRouter>
    );

  const baseComputation = (extra: Record<string, unknown>) => ({
    beregningsdato: toISODateString('2026-03-17'),
    fradragGaelderForFoer2011: false,
    ealEetPct: 15,
    ealKrav: 100000,
    afgoerelser: [],
    kapitaliseringerAfgoerelser: [],
    proformaKapitalisering: null,
    forligFactor: null,
    forligLabel: null,
    forligDato: null,
    ...extra,
  });

  it('viser forlig om ansvarsgrad-rækken i Valgmuligheder', () => {
    renderTab({
      computation: baseComputation({ differencekravFoerForlig: 100000, forligFactor: null, forligLabel: null, differencekrav: 100000 }),
    });

    expect(screen.getByText('Forlig om ansvarsgrad')).toBeInTheDocument();
    expect(screen.getByText('eller brøk')).toBeInTheDocument();
    expect(screen.getByText('Evt. dato for forlig')).toBeInTheDocument();
  });

  it('viser plain differencekrav-label uden forlig', () => {
    renderTab({
      computation: baseComputation({ differencekravFoerForlig: 100000, forligFactor: null, forligLabel: null, differencekrav: 100000 }),
    });

    expect(screen.getByText('Beregnet differencekrav')).toBeInTheDocument();
  });

  it('viser forlig-reduceret differencekrav-label med fuldt krav i parentes + prosa-sætning', () => {
    renderTab({
      forligValues: { forligAnsvarsgradProcent: undefined, forligAnsvarsgradBroek: '2/3', forligDato: undefined },
      computation: baseComputation({
        differencekravFoerForlig: 1095121,
        forligFactor: 2 / 3,
        forligLabel: '2/3',
        forligDato: null,
        differencekrav: 730081,
      }),
    });

    expect(screen.getByText('Der er indgået forlig i sagen på betaling af 2/3.')).toBeInTheDocument();
    expect(screen.getByText('Beregnet differencekrav (2/3 af 1.095.121 kr.)')).toBeInTheDocument();
    expect(screen.getByText('730.081 kr.')).toBeInTheDocument();
    expect(screen.queryByText('Beregnet differencekrav')).not.toBeInTheDocument();
  });

  it('inkluderer forligsdatoen i prosa-sætningen når den er angivet', () => {
    renderTab({
      forligValues: { forligAnsvarsgradProcent: undefined, forligAnsvarsgradBroek: '2/3', forligDato: undefined },
      computation: baseComputation({
        differencekravFoerForlig: 1095121,
        forligFactor: 2 / 3,
        forligLabel: '2/3',
        forligDato: toISODateString('2024-05-17'),
        differencekrav: 730081,
      }),
    });

    expect(screen.getByText('Der er den 17. maj 2024 indgået forlig i sagen på betaling af 2/3.')).toBeInTheDocument();
  });

  it('undertrykker hele beregningsoutputtet men beholder forligs-rækken ved blokerende forligs-fejl', () => {
    renderTab({
      forligValues: { forligAnsvarsgradProcent: 50, forligAnsvarsgradBroek: '1/3', forligDato: undefined },
      hasBlockingErrors: true,
      issues: [{ id: 'forlig-ansvarsgrad-invalid', severity: 'error', message: 'Forlig om ansvarsgrad: Angiv enten procent eller brøk – ikke begge.' }],
      computation: {},
    });

    // Forligs-rækken (i Valgmuligheder) er altid synlig, så fejlen kan rettes.
    expect(screen.getByText('Forlig om ansvarsgrad')).toBeInTheDocument();
    // Differencekrav-resultatet er undertrykt.
    expect(screen.queryByText(/Beregnet differencekrav/)).not.toBeInTheDocument();
  });
});
