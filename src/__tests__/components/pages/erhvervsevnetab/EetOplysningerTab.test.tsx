import * as React from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import EetOplysningerTab from '../../../../components/pages/erhvervsevnetab/EetOplysningerTab';
import { FormPersistenceProvider } from '../../../../contexts/FormPersistenceContext';
import { formPersistenceStore } from '../../../../stores/formPersistenceStore';
import { undoRedoStore } from '../../../../stores/undoRedoStore';
import { clearResolvedFieldErrorsCache } from '../../../../hooks/useFormPersistenceSelectors';
import { getResolvedFieldErrorsSnapshot } from '../../../../stores/formPersistenceReadModel';
import { PERSISTED_DATA_VERSION } from '../../../../config/persistenceVersion';

vi.mock('../../../../contexts/useAppSettings', () => ({
  useAppSettings: () => ({ settings: {} }),
}));

// De tunge child-komponenter er urelaterede til køn-reglen; mock dem væk for at isolere testen.
vi.mock('../../../../components/tables/EetAslAfgoerelserTable', () => ({
  default: () => <div data-testid="asl-afgoerelser-table" />,
}));
vi.mock('../../../../components/inputs/AarsloenAmountFieldRow', () => ({
  default: () => <div data-testid="aarsloen-amount-field-row" />,
}));

const KOEN_BEREGNING_FEJL = 'Ved beregning før 1. marts 2015 skal køn angives.';
const KOEN_KAPITALISERING_FEJL = 'Ved kapitalisering før 1. marts 2015 skal køn angives.';

// Korrekthedsinvariant (8.2/F1): køn-reglen rapporteres nu til den centrale fejl-model under pageKey
// `erhvervsevnetab`, så Gem blokeres på linje med Erstatningsopgørelse — tidligere blokerede kun en lokal
// rød ring ikke save.
describe('EetOplysningerTab køn-regel (central fejl-model)', () => {
  beforeEach(() => {
    sessionStorage.clear();
    clearResolvedFieldErrorsCache();
    formPersistenceStore.getState().clearAll({
      hydrated: true,
      schemaFingerprint: PERSISTED_DATA_VERSION,
      lastCommittedAt: Date.now(),
    });
    formPersistenceStore.getState().clearAllFieldErrors();
    undoRedoStore.getState().clear();
  });

  const koenError = () => {
    clearResolvedFieldErrorsCache();
    return getResolvedFieldErrorsSnapshot('erhvervsevnetab').koen;
  };

  const renderTab = (values: {
    koen?: 'Mand' | 'Kvinde';
    beregningsdato?: string;
    aslAfgoerelser?: ReadonlyArray<{ kapDato?: string }>;
  }) =>
    render(
      <MemoryRouter>
        <FormPersistenceProvider>
          <EetOplysningerTab
            values={{
              koen: values.koen,
              beregningsdato: values.beregningsdato,
              aslAarsloen: undefined,
              ealAarsloen: undefined,
              ealEetPct: undefined,
              skadelidteFodselsdato: undefined,
              aslAfgoerelser: values.aslAfgoerelser ?? [],
            } as never}
            setValues={vi.fn()}
            setFieldValue={vi.fn()}
            handleAslAarsloenChange={vi.fn()}
            handleEalAarsloenChange={vi.fn()}
            skadedato="2014-01-01"
          />
        </FormPersistenceProvider>
      </MemoryRouter>
    );

  it('rapporterer køn-reglen som blokerende fejl ved beregningsdato før 1. marts 2015 uden køn', () => {
    renderTab({ beregningsdato: '2014-01-01' });

    expect(koenError()).toMatchObject({
      message: KOEN_BEREGNING_FEJL,
      severity: 'error',
      source: 'rule',
      blocksSave: true,
    });
  });

  it('rapporterer kapitaliserings-varianten ved kapDato før 1. marts 2015 uden køn', () => {
    renderTab({ aslAfgoerelser: [{ kapDato: '2010-06-01' }] });

    expect(koenError()).toMatchObject({
      message: KOEN_KAPITALISERING_FEJL,
      severity: 'error',
      source: 'rule',
      blocksSave: true,
    });
  });

  it('rapporterer ingen køn-fejl når køn er valgt', () => {
    renderTab({ koen: 'Kvinde', beregningsdato: '2014-01-01' });

    expect(koenError()).toBeUndefined();
  });

  it('rapporterer ingen køn-fejl når alle datoer er 1. marts 2015 eller senere', () => {
    renderTab({ beregningsdato: '2020-01-01', aslAfgoerelser: [{ kapDato: '2020-01-01' }] });

    expect(koenError()).toBeUndefined();
  });
});
