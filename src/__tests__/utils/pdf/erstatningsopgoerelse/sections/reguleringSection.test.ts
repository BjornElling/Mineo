import { describe, expect, it, vi } from 'vitest';
import { renderReguleringSection } from '../../../../../utils/pdf/erstatningsopgoerelse/sections/reguleringSection';
import { createErstatningsopgoerelseInitialValues } from '../../../../../domain/erstatningsopgoerelse/erstatningsopgoerelseInitialValues';
import { STAMDATA_INITIAL_VALUES } from '../../../../../domain/stamdata/stamdataInitialValues';
import { toISODateString } from '../../../../../types/branded';

const iso = (value: string) => toISODateString(value);

const makeContext = (
  eoValues: ReturnType<typeof createErstatningsopgoerelseInitialValues>,
  stamdataValues = STAMDATA_INITIAL_VALUES
) => {
  const startBilagPage = vi.fn();
  const renderSubheader = vi.fn();
  const safeAddWrappedText = vi.fn();
  const writeLabelValueLine = vi.fn();

  let y = 0;

  return {
    startBilagPage,
    renderSubheader,
    safeAddWrappedText,
    writeLabelValueLine,
    ctx: {
      eoValues,
      stamdataValues,
      lineHeight: 4,
      modelLoenudviklingSegmenter: [] as const,
      startBilagPage,
      renderSubheader,
      safeAddWrappedText,
      writeLabelValueLine,
      resolveValgtReguleringDisplay: vi.fn(() => 'Ingen'),
      resolveReguleringsdato: vi.fn(() => undefined),
      parseOptionalIsoDate: vi.fn((v: string | undefined) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? iso(v) : undefined)),
      resolveLoenSkadesdatoText: vi.fn(
        ({ skadesdato }: { subject: 'lønnen'; skadesdato: unknown; saerligFraDatoRegulering: unknown }) =>
          skadesdato ? `lønnen på skadestidspunktet (${String(skadesdato)})` : 'lønnen'
      ),
      resolveTafDateBounds: vi.fn(() => null),
      buildReguleringsvaerdierTableData: vi.fn(() => null),
      buildReguleringIndexRows: vi.fn(() => []),
      resolveStatistikModelIdFromLabel: vi.fn(() => undefined),
      renderStandardPdfTable: vi.fn(({ startY }: { startY: number }) => startY + 20),
      writer: {
        addSpacer: vi.fn(),
        setY: vi.fn((nextY: number) => { y = nextY; }),
        getY: vi.fn(() => y),
        getDoc: vi.fn(() => ({})),
        writeUnderlinedLabel: vi.fn(),
        setY: vi.fn(),
      },
    },
  };
};

describe('renderReguleringSection – startBilagPage', () => {
  it('kalder startBilagPage med "Regulering"', () => {
    const eoValues = createErstatningsopgoerelseInitialValues();
    const { startBilagPage, ctx } = makeContext(eoValues);

    renderReguleringSection(ctx);

    expect(startBilagPage).toHaveBeenCalledWith('Regulering');
  });
});

describe('renderReguleringSection – ingen ansættelsesforhold', () => {
  it('viser "Ingen ansættelsesforhold" når der ikke er ansættelsesforhold', () => {
    const eoValues = createErstatningsopgoerelseInitialValues();
    eoValues.beregnesUdFra = 'Beregningsperiode';
    eoValues.loenindkomstAnsaettelsesforhold = [];
    const { safeAddWrappedText, ctx } = makeContext(eoValues);

    renderReguleringSection(ctx);

    expect(safeAddWrappedText).toHaveBeenCalledWith('Ingen ansættelsesforhold.');
  });
});

describe('renderReguleringSection – ansættelsesforhold med ingen regulering', () => {
  it('kalder writeLabelValueLine med "Regulering" for hvert ansættelsesforhold', () => {
    const eoValues = createErstatningsopgoerelseInitialValues();
    eoValues.beregnesUdFra = 'Beregningsperiode';
    eoValues.loenindkomstAnsaettelsesforhold = [
      {
        ...createErstatningsopgoerelseInitialValues().loenindkomstAnsaettelsesforhold[0],
        id: 'af-1',
        navnPaaArbejdssted: 'Test Arbejdssted',
        loenudviklingBeregningsgrundlag: 'Ingen',
      },
    ];
    const { writeLabelValueLine, ctx } = makeContext(eoValues);

    renderReguleringSection(ctx);

    expect(writeLabelValueLine).toHaveBeenCalledWith('Regulering', expect.any(String));
  });

  it('bruger ansættelsesstedets navn som underoverskrift', () => {
    const eoValues = createErstatningsopgoerelseInitialValues();
    eoValues.beregnesUdFra = 'Beregningsperiode';
    eoValues.loenindkomstAnsaettelsesforhold = [
      {
        ...createErstatningsopgoerelseInitialValues().loenindkomstAnsaettelsesforhold[0],
        id: 'af-2',
        navnPaaArbejdssted: 'Kerteminde Kommune',
        loenudviklingBeregningsgrundlag: 'Ingen',
      },
    ];
    const { renderSubheader, ctx } = makeContext(eoValues);

    renderReguleringSection(ctx);

    expect(renderSubheader).toHaveBeenCalledWith(
      'Kerteminde Kommune',
      expect.anything(),
      expect.anything()
    );
  });

  it('bruger fallback-navn "Ansættelsesforhold 1" når navnPaaArbejdssted er tomt', () => {
    const eoValues = createErstatningsopgoerelseInitialValues();
    eoValues.beregnesUdFra = 'Beregningsperiode';
    eoValues.loenindkomstAnsaettelsesforhold = [
      {
        ...createErstatningsopgoerelseInitialValues().loenindkomstAnsaettelsesforhold[0],
        id: 'af-3',
        navnPaaArbejdssted: '',
        loenudviklingBeregningsgrundlag: 'Ingen',
      },
    ];
    const { renderSubheader, ctx } = makeContext(eoValues);

    renderReguleringSection(ctx);

    expect(renderSubheader).toHaveBeenCalledWith(
      'Ansættelsesforhold 1',
      expect.anything(),
      expect.anything()
    );
  });
});

describe('renderReguleringSection – KRL satstabel-note', () => {
  it('viser KRL-link for lønudvikling baseret på KRL satstabel', () => {
    const eoValues = createErstatningsopgoerelseInitialValues();
    eoValues.beregnesUdFra = 'Beregningsperiode';
    eoValues.loenindkomstAnsaettelsesforhold = [
      {
        ...createErstatningsopgoerelseInitialValues().loenindkomstAnsaettelsesforhold[0],
        id: 'af-krl',
        navnPaaArbejdssted: 'KRL-sted',
        loenudviklingBeregningsgrundlag: 'KRL satstabel',
      },
    ];
    const { safeAddWrappedText, ctx } = makeContext(eoValues);

    renderReguleringSection(ctx);

    expect(safeAddWrappedText).toHaveBeenCalledWith(
      expect.stringContaining('https://www.krl.dk/#/sats')
    );
  });
});

describe('renderReguleringSection – statistik-noter', () => {
  const makeAnsaettelsesforhold = (grundlag: string) => ({
    ...createErstatningsopgoerelseInitialValues().loenindkomstAnsaettelsesforhold[0],
    id: 'af-stat',
    navnPaaArbejdssted: 'Statistik-sted',
    loenudviklingBeregningsgrundlag: grundlag as never,
    loenudviklingStatistikModel: grundlag === 'Statistik' ? 'ILON12-label' : undefined,
  });

  it('viser ILON12-note når resolveStatistikModelIdFromLabel returnerer "ILON12"', () => {
    const eoValues = createErstatningsopgoerelseInitialValues();
    eoValues.beregnesUdFra = 'Beregningsperiode';
    eoValues.loenindkomstAnsaettelsesforhold = [makeAnsaettelsesforhold('Statistik')];
    const { safeAddWrappedText, ctx } = makeContext(eoValues);
    ctx.resolveStatistikModelIdFromLabel = vi.fn(() => 'ILON12');

    renderReguleringSection(ctx);

    expect(safeAddWrappedText).toHaveBeenCalledWith(expect.stringContaining('ILON12'));
  });

  it('viser SBLON2-note når resolveStatistikModelIdFromLabel returnerer "SBLON2"', () => {
    const eoValues = createErstatningsopgoerelseInitialValues();
    eoValues.beregnesUdFra = 'Beregningsperiode';
    eoValues.loenindkomstAnsaettelsesforhold = [makeAnsaettelsesforhold('Statistik')];
    const { safeAddWrappedText, ctx } = makeContext(eoValues);
    ctx.resolveStatistikModelIdFromLabel = vi.fn(() => 'SBLON2');

    renderReguleringSection(ctx);

    expect(safeAddWrappedText).toHaveBeenCalledWith(expect.stringContaining('SBLON2'));
  });

  it('viser ASL-note når statistikLabel starter med "ASL-"', () => {
    const eoValues = createErstatningsopgoerelseInitialValues();
    eoValues.beregnesUdFra = 'Beregningsperiode';
    const af = makeAnsaettelsesforhold('Statistik');
    af.loenudviklingStatistikModel = 'ASL-2024';
    eoValues.loenindkomstAnsaettelsesforhold = [af];
    const { safeAddWrappedText, ctx } = makeContext(eoValues);
    // resolveStatistikModelIdFromLabel returnerer undefined → kode tjekker label.startsWith('ASL-')
    ctx.resolveStatistikModelIdFromLabel = vi.fn(() => undefined);

    renderReguleringSection(ctx);

    expect(safeAddWrappedText).toHaveBeenCalledWith(
      expect.stringContaining('ASL-årslønsmaksimum')
    );
  });
});
