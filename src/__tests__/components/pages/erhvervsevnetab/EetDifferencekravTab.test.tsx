// @vitest-environment jsdom
import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import EetDifferencekravTab from '../../../../components/pages/erhvervsevnetab/EetDifferencekravTab';
import { FormPersistenceProvider, initializePersistenceRuntime } from '../../../../contexts/FormPersistenceContext';
import { toISODateString, type ISODateString } from '../../../../types/branded';
import { fromKroner } from '../../../../domain/money/money';
import { formPersistenceStore } from '../../../../stores/formPersistenceStore';
import { undoRedoStore } from '../../../../stores/undoRedoStore';
import { clearResolvedFieldErrorsCache } from '../../../../hooks/useFormPersistenceSelectors';
import { getResolvedFieldErrorsSnapshot } from '../../../../stores/formPersistenceReadModel';
import { PERSISTED_DATA_VERSION } from '../../../../config/persistenceVersion';
import {
  FORLIG_BEGGE_UDFYLDT_FEJL,
  FORLIG_DATO_KRAEVER_ANSVARSGRAD_FEJL,
} from '../../../../domain/erstatningsopgoerelse/validation/forligAnsvarsgradRules';

vi.mock('../../../../contexts/useAppSettings', () => ({
  useAppSettings: () => ({
    settings: {},
  }),
}));

vi.mock('../../../../document/service/documentService', () => ({
  downloadDifferencekravDokument: vi.fn(),
}));

vi.mock('../../../../hooks/useShakeFlag', () => ({
  useShakeFlag: () => ({
    shake: false,
    triggerShake: vi.fn(),
  }),
}));

describe('EetDifferencekravTab', () => {
  it('udelader overflødig tekst for midlertidig afgørelse når skaden er sket den 16. juni 2011 eller senere', () => {
    render(
      <MemoryRouter>
        <FormPersistenceProvider runtime={initializePersistenceRuntime()}>
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
                ealKravOre: fromKroner(100000),
                afgoerelser: [{
                  rowId: 'a1',
                  afgoerelsesdato: toISODateString('2020-01-01'),
                  virkningsdato: toISODateString('2020-02-01'),
                  afgoerelseType: 'Midlertidig',
                  eetPct: 15,
                  beloebOre: fromKroner(0),
                  fradragForetages: false,
                  fradragesTil: null,
                }],
                kapitaliseringerAfgoerelser: [],
                proformaKapitalisering: null,
                differencekravFoerForligOre: fromKroner(100000),
                forligFactor: null,
                forligLabel: null,
                differencekravOre: fromKroner(100000),
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
        <FormPersistenceProvider runtime={initializePersistenceRuntime()}>
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
    ealKravOre: fromKroner(100000),
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
      computation: baseComputation({ differencekravFoerForligOre: fromKroner(100000), forligFactor: null, forligLabel: null, differencekravOre: fromKroner(100000) }),
    });

    expect(screen.getByText('Forlig om ansvarsgrad')).toBeInTheDocument();
    expect(screen.getByText('eller brøk')).toBeInTheDocument();
    expect(screen.getByText('Evt. dato for forlig')).toBeInTheDocument();
  });

  it('viser plain differencekrav-label uden forlig', () => {
    renderTab({
      computation: baseComputation({ differencekravFoerForligOre: fromKroner(100000), forligFactor: null, forligLabel: null, differencekravOre: fromKroner(100000) }),
    });

    expect(screen.getByText('Beregnet differencekrav')).toBeInTheDocument();
  });

  it('viser forlig-reduceret differencekrav-label med fuldt krav i parentes + prosa-sætning', () => {
    renderTab({
      forligValues: { forligAnsvarsgradProcent: undefined, forligAnsvarsgradBroek: '2/3', forligDato: undefined },
      computation: baseComputation({
        differencekravFoerForligOre: fromKroner(1095121),
        forligFactor: 2 / 3,
        forligLabel: '2/3',
        forligDato: null,
        differencekravOre: fromKroner(730081),
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
        differencekravFoerForligOre: fromKroner(1095121),
        forligFactor: 2 / 3,
        forligLabel: '2/3',
        forligDato: toISODateString('2024-05-17'),
        differencekravOre: fromKroner(730081),
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

// Korrekthedsinvariant (Group B): Differencekrav-fanen rapporterer nu de samme blokerende forligs-regler
// til den centrale fejl-model under pageKey `erstatningsopgoerelse` som EOOplysningerTab — så Gem blokeres
// også fra denne fane.
describe('EetDifferencekravTab forligs-håndhævelse (delt central fejl-model)', () => {
  beforeEach(() => {
    sessionStorage.clear();
    clearResolvedFieldErrorsCache();
    formPersistenceStore.getState().clearAll({
      hydrated: true,
      persistedDataVersion: PERSISTED_DATA_VERSION,
      lastCommittedAt: Date.now(),
    });
    formPersistenceStore.getState().clearAllFieldErrors();
    undoRedoStore.getState().clear();
  });

  const ruleError = (field: 'forligAnsvarsgradProcent' | 'forligAnsvarsgradBroek' | 'forligDato') => {
    clearResolvedFieldErrorsCache();
    return getResolvedFieldErrorsSnapshot('erstatningsopgoerelse')[field];
  };

  const renderWithForlig = (forligValues: {
    forligAnsvarsgradProcent: number | undefined;
    forligAnsvarsgradBroek: string | undefined;
    forligDato: ISODateString | undefined;
  }) =>
    render(
      <MemoryRouter>
        <FormPersistenceProvider runtime={initializePersistenceRuntime()}>
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
            forligValues={forligValues}
            setForligValues={vi.fn()}
            onGoToEetOplysninger={vi.fn()}
            stamdata={null}
            snapshot={{ issues: [], hasBlockingErrors: true, computation: null } as never}
          />
        </FormPersistenceProvider>
      </MemoryRouter>
    );

  it('rapporterer "begge udfyldt"-reglen til procent og brøk', () => {
    renderWithForlig({ forligAnsvarsgradProcent: 50, forligAnsvarsgradBroek: '1/3', forligDato: undefined });

    expect(ruleError('forligAnsvarsgradProcent')).toMatchObject({
      message: FORLIG_BEGGE_UDFYLDT_FEJL,
      severity: 'error',
      source: 'rule',
      blocksSave: true,
    });
    expect(ruleError('forligAnsvarsgradBroek')).toMatchObject({
      message: FORLIG_BEGGE_UDFYLDT_FEJL,
      severity: 'error',
      source: 'rule',
      blocksSave: true,
    });
  });

  it('rapporterer dato-reglen når forligDato er sat uden ansvarsgrad', () => {
    renderWithForlig({ forligAnsvarsgradProcent: undefined, forligAnsvarsgradBroek: undefined, forligDato: toISODateString('2024-05-17') });

    expect(ruleError('forligDato')).toMatchObject({
      message: FORLIG_DATO_KRAEVER_ANSVARSGRAD_FEJL,
      severity: 'error',
      source: 'rule',
      blocksSave: true,
    });
  });

  it('rapporterer ingen blokerende forligs-fejl ved et gyldigt forlig', () => {
    renderWithForlig({ forligAnsvarsgradProcent: undefined, forligAnsvarsgradBroek: '2/3', forligDato: toISODateString('2024-05-17') });

    expect(ruleError('forligAnsvarsgradProcent')).toBeUndefined();
    expect(ruleError('forligAnsvarsgradBroek')).toBeUndefined();
    expect(ruleError('forligDato')).toBeUndefined();
  });
});
