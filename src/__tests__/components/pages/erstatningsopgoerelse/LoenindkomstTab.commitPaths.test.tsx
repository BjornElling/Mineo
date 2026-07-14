// @vitest-environment jsdom
import * as React from 'react';
import { render, renderHook, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LoenindkomstTab from '../../../../components/pages/erstatningsopgoerelse/LoenindkomstTab';
import { useLoenindkomstVm } from '../../../../components/pages/erstatningsopgoerelse/loenindkomst/loenindkomstContext';
import { toISODateString } from '../../../../types/branded';
import {
  createDefaultLoenindkomstAnsaettelsesforhold,
  createErstatningsopgoerelseInitialValues,
} from '../../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import type { ErstatningsopgoerelseValues } from '../../../../schemas/formSchemas';

const mockStamdata = {
  skadedato: toISODateString('2024-01-01'),
  skadestype: 'Arbejdsulykke',
};

vi.mock('../../../../hooks/useFormFieldErrors', () => ({
  useDynamicFormFieldErrorReporter: () => vi.fn(),
  useFormFieldErrorReporter: () => vi.fn(),
  useKeyedFieldErrorReporter: () => vi.fn(),
  useFieldInvalidDraftChannel: () => ({
    committedInvalidDraft: undefined,
    onCommitInvalid: undefined,
    clearInvalidDraft: undefined,
  }),
}));

vi.mock('../../../../hooks/useFormPersistenceSelectors', () => ({
  usePersistedSectionSelector: () => mockStamdata,
  getPersistedSectionSnapshot: vi.fn(),
  useInvalidDraftForFieldSelector: () => undefined,
  useAuthoritativeSnapshotEpochSelector: () => 0,
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

type AnsaettelsesforholdList = ErstatningsopgoerelseValues['loenindkomstAnsaettelsesforhold'];

describe('LoenindkomstTab commit-stier', () => {
  const renderLoenindkomstTab = (
    eoValues: ErstatningsopgoerelseValues,
    onAnsaettelsesforholdChange: React.ComponentProps<typeof LoenindkomstTab>['onAnsaettelsesforholdChange']
  ) => render(
    <MemoryRouter>
      <LoenindkomstTab
        loenindkomstAnsaettelsesforhold={eoValues.loenindkomstAnsaettelsesforhold}
        beregnesUdFra={eoValues.beregnesUdFra}
        tafBeregningsperiodeFra={eoValues.tafBeregningsperiodeFra}
        tafBeregningsperiodeTil={eoValues.tafBeregningsperiodeTil}
        ferieperioder={eoValues.ferieperioder}
        fravaerPerioder={eoValues.fravaerPerioder}
        eoValues={eoValues}
        setEOValues={vi.fn<React.ComponentProps<typeof LoenindkomstTab>['setEOValues']>()}
        onAnsaettelsesforholdChange={onAnsaettelsesforholdChange}
        onNavigateToTabtArbejdsfortjeneste={vi.fn()}
        sfggSixMonthWarningEmploymentIds={[]}
      />
    </MemoryRouter>
  );

  it('håndhæver maks-grænsen i selve commit-updateren (ikke kun UI) ved tilføj', () => {
    // Start uden ansættelsesforhold, så tilføj-knappen (FAB) er synlig.
    const eoValues = createErstatningsopgoerelseInitialValues();
    eoValues.loenindkomstAnsaettelsesforhold = [];
    const onAnsaettelsesforholdChange = vi.fn<React.ComponentProps<typeof LoenindkomstTab>['onAnsaettelsesforholdChange']>();

    renderLoenindkomstTab(eoValues, onAnsaettelsesforholdChange);

    // Åbn tilføj-dialogen og bekræft.
    fireEvent.click(screen.getByRole('button', { name: /tilføj nyt ansættelsesforhold/i }));
    fireEvent.click(screen.getByRole('button', { name: /ja, tilføj/i }));

    expect(onAnsaettelsesforholdChange).toHaveBeenCalledTimes(1);
    const updater = onAnsaettelsesforholdChange.mock.calls[0][0];

    // Under grænsen: updateren tilføjer ét ansættelsesforhold.
    const tooFew: AnsaettelsesforholdList = [createDefaultLoenindkomstAnsaettelsesforhold()];
    expect(updater(tooFew)).toHaveLength(2);

    // Ved grænsen (10): updateren tilføjer IKKE — den returnerer prev uændret.
    const atMax: AnsaettelsesforholdList = Array.from({ length: 10 }, (_, i) => ({
      ...createDefaultLoenindkomstAnsaettelsesforhold(),
      id: `af-${i}`,
    }));
    const result = updater(atMax);
    expect(result).toBe(atMax);
    expect(result).toHaveLength(10);
  });

  it('afspejler sats-fejl rent fra committed state (rettelse rydder fejlen ved ny commit)', () => {
    // Beregningsperiode + indtastede lønoplysninger gør feriePct påkrævet. Et committet AF med
    // feriePct under 12 % skal vise en sats-fejl; en ny commit med gyldig feriePct rydder den.
    const baseAf = {
      ...createDefaultLoenindkomstAnsaettelsesforhold(),
      id: 'af-ferie',
      navnPaaArbejdssted: 'Arbejdssted',
      fuldLoenUnderFerie: 'Nej' as const,
      feriePct: 5,
      indtaegtsoplysningerTableData: [{
        id: 'loen-1',
        col0_maaned: '1',
        col1_maaned: '2024',
        col0_uge: '',
        col1_uge: '',
        col0_dag: undefined,
        col1_dag: undefined,
        col2: { kind: 'number' as const, value: 10000 },
        col3: undefined,
        col4: undefined,
        col5: undefined,
      }],
    };
    const invalidValues = createErstatningsopgoerelseInitialValues();
    invalidValues.beregnesUdFra = 'Beregningsperiode';
    invalidValues.loenindkomstAnsaettelsesforhold = [baseAf];

    const { rerender, container } = render(
      <MemoryRouter>
        <LoenindkomstTab
          loenindkomstAnsaettelsesforhold={invalidValues.loenindkomstAnsaettelsesforhold}
          beregnesUdFra={invalidValues.beregnesUdFra}
          tafBeregningsperiodeFra={invalidValues.tafBeregningsperiodeFra}
          tafBeregningsperiodeTil={invalidValues.tafBeregningsperiodeTil}
          ferieperioder={invalidValues.ferieperioder}
          fravaerPerioder={invalidValues.fravaerPerioder}
          eoValues={invalidValues}
          setEOValues={vi.fn<React.ComponentProps<typeof LoenindkomstTab>['setEOValues']>()}
          onAnsaettelsesforholdChange={vi.fn()}
          onNavigateToTabtArbejdsfortjeneste={vi.fn()}
          sfggSixMonthWarningEmploymentIds={[]}
        />
      </MemoryRouter>
    );

    // Sats-fejlen er afledt af committed state → den ugyldige feriePct giver et felt med fejl-flag.
    const erroredBefore = container.querySelectorAll('[aria-invalid="true"]').length;
    expect(erroredBefore).toBeGreaterThan(0);

    // Ny commit med gyldig feriePct: fejlen forsvinder udelukkende fordi memo'en genberegner fra
    // den nye committede værdi (ingen imperativ revalidering).
    const fixedValues = structuredClone(invalidValues);
    fixedValues.loenindkomstAnsaettelsesforhold = [{ ...baseAf, feriePct: 12.5 }];
    rerender(
      <MemoryRouter>
        <LoenindkomstTab
          loenindkomstAnsaettelsesforhold={fixedValues.loenindkomstAnsaettelsesforhold}
          beregnesUdFra={fixedValues.beregnesUdFra}
          tafBeregningsperiodeFra={fixedValues.tafBeregningsperiodeFra}
          tafBeregningsperiodeTil={fixedValues.tafBeregningsperiodeTil}
          ferieperioder={fixedValues.ferieperioder}
          fravaerPerioder={fixedValues.fravaerPerioder}
          eoValues={fixedValues}
          setEOValues={vi.fn<React.ComponentProps<typeof LoenindkomstTab>['setEOValues']>()}
          onAnsaettelsesforholdChange={vi.fn()}
          onNavigateToTabtArbejdsfortjeneste={vi.fn()}
          sfggSixMonthWarningEmploymentIds={[]}
        />
      </MemoryRouter>
    );

    const erroredAfter = container.querySelectorAll('[aria-invalid="true"]').length;
    expect(erroredAfter).toBeLessThan(erroredBefore);
  });
});

describe('useLoenindkomstVm', () => {
  it('kaster når den bruges uden for en LoenindkomstVmProvider', () => {
    expect(() => renderHook(() => useLoenindkomstVm())).toThrow(
      'useLoenindkomstVm skal bruges inden for en LoenindkomstVmProvider'
    );
  });
});
