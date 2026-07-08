// @vitest-environment jsdom
import * as React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LoenindkomstTab from '../../../../components/pages/erstatningsopgoerelse/LoenindkomstTab';
import { resolveSatserHeading } from '../../../../components/pages/erstatningsopgoerelse/loenindkomst/resolveSatserHeading';
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

describe('LoenindkomstTab sygeferiegodtgørelse', () => {
  const renderLoenindkomstTab = (
    eoValues = createErstatningsopgoerelseInitialValues(),
    overrides?: Readonly<{
      onAnsaettelsesforholdChange?: React.ComponentProps<typeof LoenindkomstTab>['onAnsaettelsesforholdChange'];
      sfggSixMonthWarningEmploymentIds?: readonly string[];
    }>
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
        onAnsaettelsesforholdChange={
          overrides?.onAnsaettelsesforholdChange ?? vi.fn<React.ComponentProps<typeof LoenindkomstTab>['onAnsaettelsesforholdChange']>()
        }
        onNavigateToTabtArbejdsfortjeneste={vi.fn()}
        sfggSixMonthWarningEmploymentIds={overrides?.sfggSixMonthWarningEmploymentIds ?? []}
      />
    </MemoryRouter>
  );

  it('viser satsoverskrift for skadedato, anmeldelsesdato, beregningsperiode og anden dato', () => {
    expect(resolveSatserHeading({
      anvendtReguleringsdato: toISODateString('2024-01-01'),
      skadedato: toISODateString('2024-01-01'),
      skadestype: 'Arbejdsulykke',
      beregnesUdFra: 'Angivet månedsløn',
      beregningsperiodeTil: undefined,
      saerligFraDatoRegulering: undefined,
    })).toBe('Satser på skadedatoen (01-01-2024)');

    expect(resolveSatserHeading({
      anvendtReguleringsdato: toISODateString('2024-01-01'),
      skadedato: toISODateString('2024-01-01'),
      skadestype: undefined,
      beregnesUdFra: 'Angivet månedsløn',
      beregningsperiodeTil: undefined,
      saerligFraDatoRegulering: undefined,
    })).toBe('Satser på skadedatoen (01-01-2024)');

    expect(resolveSatserHeading({
      anvendtReguleringsdato: toISODateString('2024-01-01'),
      skadedato: toISODateString('2024-01-01'),
      skadestype: 'Erhvervssygdom',
      beregnesUdFra: 'Angivet månedsløn',
      beregningsperiodeTil: undefined,
      saerligFraDatoRegulering: undefined,
    })).toBe('Satser på anmeldelsesdatoen (01-01-2024)');

    expect(resolveSatserHeading({
      anvendtReguleringsdato: toISODateString('2024-12-31'),
      skadedato: toISODateString('2024-01-01'),
      skadestype: 'Arbejdsulykke',
      beregnesUdFra: 'Beregningsperiode',
      beregningsperiodeTil: toISODateString('2024-12-31'),
      saerligFraDatoRegulering: undefined,
    })).toBe('Satser ved beregningsperiodens udløb (31-12-2024)');

    expect(resolveSatserHeading({
      anvendtReguleringsdato: toISODateString('2024-03-15'),
      skadedato: toISODateString('2024-01-01'),
      skadestype: 'Arbejdsulykke',
      beregnesUdFra: 'Angivet månedsløn',
      beregningsperiodeTil: undefined,
      saerligFraDatoRegulering: toISODateString('2024-03-15'),
    })).toBe('Satser på den manuelt angivne reguleringsdato (15-03-2024)');

    expect(resolveSatserHeading({
      anvendtReguleringsdato: toISODateString('2024-03-15'),
      skadedato: toISODateString('2024-01-01'),
      skadestype: 'Arbejdsulykke',
      beregnesUdFra: 'Angivet månedsløn',
      beregningsperiodeTil: undefined,
      saerligFraDatoRegulering: undefined,
    })).toBe('Satser den 15. marts 2024');

    expect(resolveSatserHeading({
      anvendtReguleringsdato: undefined,
      skadedato: undefined,
      skadestype: undefined,
      beregnesUdFra: 'Angivet månedsløn',
      beregningsperiodeTil: undefined,
      saerligFraDatoRegulering: undefined,
    })).toBe('Satser');
  });

  it('viser kun SFGG-valget for ansættelsesforhold hvor skadelidte var ansat på skadestidspunktet', () => {
    const eoValues = createErstatningsopgoerelseInitialValues();
    eoValues.kravPaaTabtArbejdsfortjeneste = 'Ja';
    eoValues.loenindkomstAnsaettelsesforhold = [
      {
        ...createDefaultLoenindkomstAnsaettelsesforhold(),
        id: 'af-aktiv',
        navnPaaArbejdssted: 'Aktivt arbejde',
        ansatPaaSkadestidspunktet: true,
      },
      {
        ...createDefaultLoenindkomstAnsaettelsesforhold(),
        id: 'af-ikke-aktiv',
        navnPaaArbejdssted: 'Tidligere arbejde',
        ansatPaaSkadestidspunktet: false,
      },
    ];

    renderLoenindkomstTab(eoValues);

    expect(screen.getByText('Sygeferiegodtgørelse beregnes ud fra')).toBeInTheDocument();
    expect(screen.getByText('Ansættelsesforhold 2 (Tidligere arbejde)').closest('.content-box')).not.toHaveTextContent(
      'Sygeferiegodtgørelse beregnes ud fra'
    );
  });

  const SIX_MONTH_NOTE = 'Bemærk: Sygeferiegodtgørelsen i dette ansættelsesforhold løber mere end 6 måneder efter sidste indkomst. Kontrollér, om perioden er korrekt.';

  it('viser 6-måneders-bemærkningen i SFGG-sektionen når ansættelsesforholdets id er markeret', () => {
    const eoValues = createErstatningsopgoerelseInitialValues();
    eoValues.kravPaaTabtArbejdsfortjeneste = 'Ja';
    eoValues.loenindkomstAnsaettelsesforhold = [{
      ...createDefaultLoenindkomstAnsaettelsesforhold(),
      id: 'af-markeret',
      ansatPaaSkadestidspunktet: true,
    }];

    renderLoenindkomstTab(eoValues, { sfggSixMonthWarningEmploymentIds: ['af-markeret'] });

    expect(screen.getByText(SIX_MONTH_NOTE)).toBeInTheDocument();
  });

  it('viser ikke 6-måneders-bemærkningen når ansættelsesforholdets id ikke er markeret', () => {
    const eoValues = createErstatningsopgoerelseInitialValues();
    eoValues.kravPaaTabtArbejdsfortjeneste = 'Ja';
    eoValues.loenindkomstAnsaettelsesforhold = [{
      ...createDefaultLoenindkomstAnsaettelsesforhold(),
      id: 'af-markeret',
      ansatPaaSkadestidspunktet: true,
    }];

    renderLoenindkomstTab(eoValues, { sfggSixMonthWarningEmploymentIds: [] });

    expect(screen.queryByText(SIX_MONTH_NOTE)).not.toBeInTheDocument();
  });

  it('autofastsætter overenskomstsatser ud fra beregningsperiodens slutdato og ikke skadedatoen', async () => {
    mockStamdata.skadedato = toISODateString('2023-02-01');
    mockStamdata.skadestype = 'Arbejdsulykke';
    const onAnsaettelsesforholdChange = vi.fn();
    const eoValues = createErstatningsopgoerelseInitialValues();
    eoValues.beregnesUdFra = 'Beregningsperiode';
    eoValues.tafBeregningsperiodeTil = toISODateString('2024-01-01');
    eoValues.loenindkomstAnsaettelsesforhold = [{
      ...createDefaultLoenindkomstAnsaettelsesforhold(),
      harOverenskomst: true,
      overenskomstId: 'bygge-anlaeg',
      ansatPaaSkadestidspunktet: true,
      saerligFraDatoRegulering: undefined,
      fritvalgPct: undefined,
      shSoPct: undefined,
      storeBededagPct: undefined,
      pensionPct: undefined,
    }];

    renderLoenindkomstTab(eoValues, { onAnsaettelsesforholdChange });

    await waitFor(() => expect(onAnsaettelsesforholdChange).toHaveBeenCalled());

    const updater = onAnsaettelsesforholdChange.mock.calls[0]?.[0] as ((current: ErstatningsopgoerelseValues['loenindkomstAnsaettelsesforhold']) => ErstatningsopgoerelseValues['loenindkomstAnsaettelsesforhold']);
    const next = updater(eoValues.loenindkomstAnsaettelsesforhold);

    expect(next[0]?.pensionPct).toBeCloseTo(10.15, 10);
    expect(next[0]?.storeBededagPct).toBeCloseTo(0.45, 10);
  });

  it('viser anvendt reguleringsdato som basisdato i manuel lønudvikling ved beregningsperiode', () => {
    mockStamdata.skadedato = toISODateString('2023-02-01');
    mockStamdata.skadestype = 'Arbejdsulykke';
    const eoValues = createErstatningsopgoerelseInitialValues();
    eoValues.beregnesUdFra = 'Beregningsperiode';
    eoValues.tafBeregningsperiodeTil = toISODateString('2024-01-01');
    eoValues.loenindkomstAnsaettelsesforhold = [{
      ...createDefaultLoenindkomstAnsaettelsesforhold(),
      ansatPaaSkadestidspunktet: true,
      loenudviklingBeregningsgrundlag: 'Manuelt angivet',
      saerligFraDatoRegulering: undefined,
    }];

    renderLoenindkomstTab(eoValues);

    expect(screen.getByDisplayValue('01-01-2024')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('01-02-2023')).not.toBeInTheDocument();
  });

  it('viser "Ingen overenskomst valgt" og skjuler efterfølgende SFGG-linjer når overenskomst ikke er valgt ovenfor', () => {
    mockStamdata.skadedato = toISODateString('2024-01-01');
    mockStamdata.skadestype = 'Arbejdsulykke';
    const eoValues = createErstatningsopgoerelseInitialValues();
    const ansaettelsesforhold = {
      ...createDefaultLoenindkomstAnsaettelsesforhold(),
      harOverenskomst: false,
      overenskomstId: undefined,
    };
    eoValues.kravPaaTabtArbejdsfortjeneste = 'Ja';
    eoValues.loenindkomstAnsaettelsesforhold = [ansaettelsesforhold];
    eoValues.sfggAnsaettelsesforhold = [
      {
        ansaettelsesforholdId: ansaettelsesforhold.id,
        sfggBeregningskilde: 'Overenskomst',
        sfggReferenceperiodeFra: toISODateString('2023-12-01'),
        sfggReferenceperiodeTil: toISODateString('2023-12-31'),
        sfggReferenceperiodeFravaersdageUdenLoen: 0,
        sfggManuelDagssats: undefined,
        sfggManuelBeloebIHenholdTil: undefined,
        sfggManuelFoerstEfterSygeloen: 'Nej',
        sfggSatsvalg: undefined,
        sfggAlleredeBetaltBeloeb: { kind: 'number', value: 0 },
      },
    ];

    renderLoenindkomstTab(eoValues);

    expect(screen.getByText('Sygeferiegodtgørelse beregnes ud fra')).toBeInTheDocument();
    expect(screen.getByText('Overenskomst (angivet ovenfor)')).toBeInTheDocument();
    expect(screen.getByText('Ingen overenskomst valgt')).toBeInTheDocument();
    expect(screen.queryByText('Overenskomstens referenceperiode')).not.toBeInTheDocument();
    expect(screen.queryByText('Evt. allerede betalt sygeferiegodtgørelse i denne erstatningsperiode')).not.toBeInTheDocument();
  });
});
