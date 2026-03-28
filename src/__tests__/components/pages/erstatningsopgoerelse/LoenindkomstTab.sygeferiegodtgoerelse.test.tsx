import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LoenindkomstTab from '../../../../components/pages/erstatningsopgoerelse/LoenindkomstTab';
import {
  createDefaultLoenindkomstAnsaettelsesforhold,
  createErstatningsopgoerelseInitialValues,
} from '../../../../domain/erstatningsopgoerelse/erstatningsopgoerelseInitialValues';

vi.mock('../../../../hooks/useEOLoenindkomstInputErrors', () => ({
  useSetEOLoenindkomstInputError: () => vi.fn(),
}));

vi.mock('../../../../hooks/useFormPersistenceSelectors', () => ({
  usePersistedSectionSelector: () => ({
    skadesdato: '2024-01-01',
  }),
  getPersistedSectionSnapshot: vi.fn(),
}));

vi.mock('../../../../contexts/useAppSettings', () => ({
  useAppSettings: () => ({
    settings: {
      defaultFuldLoenUnderFerie: true,
      defaultLoenPaaHelligdage: 'Almindelig løn',
      defaultOverenskomstFilterLoenmodtager: undefined,
      defaultOverenskomstFilterArbejdsgiver: undefined,
    },
  }),
}));

describe('LoenindkomstTab sygeferiegodtgørelse', () => {
  it('viser "Ingen overenskomst valgt" og skjuler efterfølgende SFGG-linjer når overenskomst ikke er valgt ovenfor', () => {
    const eoValues = createErstatningsopgoerelseInitialValues();
    const ansaettelsesforhold = {
      ...createDefaultLoenindkomstAnsaettelsesforhold(),
      harOverenskomst: false,
      overenskomstId: undefined,
    };
    eoValues.beregnesTabtArbejdsfortjeneste = 'Ja';
    eoValues.loenindkomstAnsaettelsesforhold = [ansaettelsesforhold];
    eoValues.sfggAnsaettelsesforhold = [
      {
        ansaettelsesforholdId: ansaettelsesforhold.id,
        beregnesUdFra: 'Overenskomst',
        referenceperiodeFra: '2023-12-01',
        referenceperiodeTil: '2023-12-31',
        referenceperiodeFravaersdageUdenLoen: 0,
        manuelDagssats: undefined,
        manuelBeloebIHenholdTil: undefined,
        manuelFoerstEfterSygeloen: 'Nej',
        satsvalg: undefined,
        alleredeBetaltBeloeb: '0,00',
      },
    ];

    render(
      <MemoryRouter>
        <LoenindkomstTab
          loenindkomstAnsaettelsesforhold={eoValues.loenindkomstAnsaettelsesforhold}
          beregnesUdFra={eoValues.beregnesUdFra}
          periodeTilBeregningFra={eoValues.periodeTilBeregningFra}
          periodeTilBeregningTil={eoValues.periodeTilBeregningTil}
          ferieperioder={eoValues.ferieperioder}
          fravaerPerioder={eoValues.fravaerPerioder}
          eoValues={eoValues}
          setEOValues={vi.fn()}
          onAnsaettelsesforholdChange={vi.fn()}
        />
      </MemoryRouter>
    );

    expect(screen.getByText('Sygeferiegodtgørelse beregnes ud fra')).toBeInTheDocument();
    expect(screen.getByText('Overenskomst (angivet ovenfor)')).toBeInTheDocument();
    expect(screen.getByText('Ingen overenskomst valgt')).toBeInTheDocument();
    expect(screen.queryByText('Overenskomstens referenceperiode')).not.toBeInTheDocument();
    expect(screen.queryByText('Evt. allerede betalt sygeferiegodtgørelse i denne erstatningsperiode')).not.toBeInTheDocument();
  });
});
