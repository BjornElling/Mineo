// @vitest-environment jsdom
import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import EetKapitaliseringTab from '../../../../components/pages/erhvervsevnetab/EetKapitaliseringTab';
import { FormPersistenceProvider } from '../../../../contexts/FormPersistenceContext';
import { toISODateString } from '../../../../types/branded';
import type { EetKapitaliseringAfgoerelseComputation } from '../../../../domain/erhvervsevnetab/eetKapitaliseringCalculation';

vi.mock('../../../../contexts/useAppSettings', () => ({
  useAppSettings: () => ({ settings: {} }),
}));

vi.mock('../../../../document/service/documentService', () => ({
  downloadKapitaliseringDokument: vi.fn(),
}));

vi.mock('../../../../hooks/useShakeFlag', () => ({
  useShakeFlag: () => ({ shake: false, triggerShake: vi.fn() }),
}));

const baseAfgoerelse: EetKapitaliseringAfgoerelseComputation = {
  rowId: 'kap-1',
  afgoerelsesdato: toISODateString('2025-01-01'),
  kapitaliseringsdato: toISODateString('2025-01-01'),
  kapitaliseringspct: 100,
  grundloen: 320000,
  erstatningsniveauPct: 80,
  amBidragPct: 8,
  grundydelse: 256000,
  grundydelse2024: 260000,
  opreguleringTil2024PctRounded4: 1.5,
  aarsydelseGrundlag: 260000,
  aarsydelseReguleringsPctRounded4: 2.5,
  aarsydelse: 266500,
  kapitaliseringsbekendtgoerelseLabel: 'Bekendtgørelse 2024',
  tabelLabel: 'Tabel A',
  folkepensionsalderLabel: '69 år',
  saerfaktor: null,
  alderAar: 45,
  alderMaaneder: 6,
  kapitaliseretPgaUnderToAarTilFp: false,
  faktorMaanedsAfhaengig: false,
  kapitaliseringsfaktor: 10,
  kapitalbelob: 2665000,
  koenOpdelt: true,
};

const renderTab = (afgoerelser: EetKapitaliseringAfgoerelseComputation[]) =>
  render(
    <MemoryRouter>
      <FormPersistenceProvider>
        <EetKapitaliseringTab
          values={{ koen: 'Kvinde', beregningsdato: toISODateString('2025-03-17') } as never}
          onGoToEetOplysninger={vi.fn()}
          stamdata={null}
          snapshot={{ issues: [], hasBlockingErrors: false, computation: { afgoerelser } }}
        />
      </FormPersistenceProvider>
    </MemoryRouter>
  );

describe('EetKapitaliseringTab', () => {
  it('renderer den delte kapitaliserings-rækkesekvens med UI-specifikke detaljer (faktor-gren)', () => {
    renderTab([baseAfgoerelse]);

    // UI-only Beregningsdato-række (uden for den delte model).
    expect(screen.getByText('Beregningsdato')).toBeInTheDocument();

    // Underoverskrifter fra den delte model.
    expect(screen.getByText('Grundydelse og regulering')).toBeInTheDocument();
    expect(screen.getByText('Kapitaliseringsbekendtgørelse og tabel')).toBeInTheDocument();
    // "Kapitaliseringsfaktor" optræder både som underoverskrift og som række-etiket (uændret fra inline-JSX).
    expect(screen.getAllByText('Kapitaliseringsfaktor')).toHaveLength(2);
    expect(screen.getByText('Kapitalbeløb')).toBeInTheDocument();

    // Reguleringsprocent-etiketten bruger UI'ens LANGE datoform (1. januar 2025), ikke kort form.
    expect(screen.getByText(/Reguleringsprocent \(1\. januar 2025\)/)).toBeInTheDocument();

    // Køn-rækken vises (køn-opdelt + køn sat).
    expect(screen.getByText('Køn')).toBeInTheDocument();
    expect(screen.getByText('Kvinde')).toBeInTheDocument();

    // < 2 år-rækken.
    expect(screen.getByText('Kapitaliseret pga. < 2 år til folkepension?')).toBeInTheDocument();
  });

  it('viser særfaktor-rækken med UI-etiketten (<) når kapitaliseret pga. < 2 år til folkepension', () => {
    renderTab([
      {
        ...baseAfgoerelse,
        rowId: 'kap-2',
        kapitaliseretPgaUnderToAarTilFp: true,
        saerfaktor: 8.5,
      },
    ]);

    expect(screen.getByText('Særfaktor (< 2 år til folkepension)')).toBeInTheDocument();
    // Faktor-undersektionen vises ikke i < 2 år-grenen.
    expect(screen.queryByText('Kapitaliseringsfaktor')).not.toBeInTheDocument();
  });

  it('viser empty-state når der ingen afgørelser er', () => {
    renderTab([]);
    expect(screen.getByText('Der er ingen kapitaliserede afgørelser i sagen.')).toBeInTheDocument();
  });
});
