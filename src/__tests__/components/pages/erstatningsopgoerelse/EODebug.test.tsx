import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import EODebug from '../../../../components/pages/erstatningsopgoerelse/EODebug';

const { eoSnapshotToDebugViewMock } = vi.hoisted(() => ({
  eoSnapshotToDebugViewMock: vi.fn(),
}));

vi.mock('../../../../hooks/useEOLoenindkomstInputErrors', () => ({
  useEOLoenindkomstInputErrors: () => ({}),
}));

vi.mock('../../../../contexts/useAppSettings', () => ({
  useAppSettings: () => ({ settings: {} }),
}));

vi.mock('../../../../domain/erstatningsopgoerelse/eoSnapshotToDebugView', () => ({
  eoSnapshotToDebugView: eoSnapshotToDebugViewMock,
}));

describe('EODebug', () => {
  const renderComponent = (snapshot: React.ComponentProps<typeof EODebug>['eoSnapshot']) => {
    return render(
      <MemoryRouter>
        <EODebug eoSnapshot={snapshot} />
      </MemoryRouter>
    );
  };

  beforeEach(() => {
    eoSnapshotToDebugViewMock.mockReset();
  });

  it('viser blocked-alert fra debug-view-projektionen', () => {
    eoSnapshotToDebugViewMock.mockReturnValue({
      kind: 'blocked',
      severity: 'info',
      title: 'EO debug kræver et friskt snapshot',
      message: 'Åbn debug-fanen igen fra Erstatningsopgørelse for at bygge snapshot på committed data.',
    });

    renderComponent(null);

    expect(screen.getByText('EO debug kræver et friskt snapshot')).toBeInTheDocument();
    expect(screen.getByText('Åbn debug-fanen igen fra Erstatningsopgørelse for at bygge snapshot på committed data.')).toBeInTheDocument();
  });

  it('renderer projekterede sektioner og sammentælling', () => {
    eoSnapshotToDebugViewMock.mockReturnValue({
      kind: 'ready',
      canonicalOutput: undefined,
      debugSnapshot: {
        sammentaellingRows: [
          {
            key: 'taf',
            label: 'TAF-periode 1',
            control: {
              beregnetDisplay: '10',
              tabelDisplay: '10',
              beregnetValue: 10,
              tabelValue: 10,
              loseFeriedage: 0,
              oevrigeFravaersdage: 0,
            },
          },
        ],
      },
      stamdataValues: {},
      erstatningsopgoerelseValues: {
        midlertidigtEetAfgorelse: 'Nej',
        endeligtEetAfgorelse: 'Nej',
      },
      rowsBySection: new Map([
        ['stamdata', [{ id: 'stamdata.skadesdato', label: 'Skadesdato', displayValue: '01-01-2024', status: 'ok' }]],
        ['aes', [{ id: 'aes.varigeMen', label: 'Varigt mén', displayValue: 'Nej', status: 'ok', group: 'aes.varigeMen' }]],
      ]),
      regulationSections: [
        {
          id: 'regulation.1',
          header: 'Ansættelsesforhold 1',
          rows: [{ id: 'regulation.1:overenskomst', label: 'Overenskomst', value: '3F' }],
        },
      ],
    });

    renderComponent({ revision: 'rev-1' } as never);

    expect(screen.getByText('Stamdata')).toBeInTheDocument();
    expect(screen.getByText('Skadesdato')).toBeInTheDocument();
    expect(screen.queryByText('Lønoversigter')).not.toBeInTheDocument();
    expect(screen.getByText('Ansættelsesforhold 1')).toBeInTheDocument();
    expect(screen.queryByText('Sammentælling')).not.toBeInTheDocument();
    expect(screen.queryByText('Beregnet: 10 | Tabel: 10')).not.toBeInTheDocument();
  });

  it('samler lønindkomst og regulering i én sektion pr. ansættelsesforhold', () => {
    eoSnapshotToDebugViewMock.mockReturnValue({
      kind: 'ready',
      canonicalOutput: undefined,
      debugSnapshot: {
        sammentaellingRows: [],
      },
      stamdataValues: {},
      erstatningsopgoerelseValues: {
        midlertidigtEetAfgorelse: 'Nej',
        endeligtEetAfgorelse: 'Nej',
      },
      rowsBySection: new Map([
        ['loenindkomst', [
          {
            id: 'loenindkomst.af1.arbejdsstedNavn',
            label: 'Navn på arbejdssted',
            displayValue: 'Tandlægerne Toft og Vedsted',
            status: 'ok',
          },
          {
            id: 'loenindkomst.af1.loenoplysninger',
            label: 'Alle lønoplysninger indtastet korrekt',
            displayValue: 'Ja',
            status: 'ok',
          },
          {
            id: 'loenindkomst.af1.regulering.valgt',
            label: 'Valgt regulering',
            displayValue: 'Ja',
            status: 'ok',
          },
          {
            id: 'loenindkomst.af1.regulering.navn',
            label: 'Navn på reguleringsform',
            displayValue: 'overenskomst Tandlægeforening/HK',
            status: 'ok',
          },
          {
            id: 'loenindkomst.af1.regulering.alleVaerdier',
            label: 'Alle reguleringsværdier udfyldt',
            displayValue: 'Ja',
            status: 'ok',
          },
          {
            id: 'loenindkomst.af1.regulering.taf.reguleringsdato',
            label: 'Reguleringsværdi på reguleringsdato for TAF',
            displayValue: 'Ja',
            status: 'ok',
          },
          {
            id: 'loenindkomst.af1.regulering.taf.start',
            label: 'Reguleringsværdi på start-dato for TAF',
            displayValue: 'Ja',
            status: 'ok',
          },
          {
            id: 'loenindkomst.af1.regulering.taf.slut',
            label: 'Reguleringsværdi på slut-dato for TAF',
            displayValue: 'Ja',
            status: 'ok',
          },
          {
            id: 'loenindkomst.af2.arbejdsstedNavn',
            label: 'Navn på arbejdssted',
            displayValue: 'Hennings Autoophug',
            status: 'ok',
          },
          {
            id: 'loenindkomst.af2.regulering.navn',
            label: 'Navn på reguleringsform',
            displayValue: 'ASL-årslønsmaksimum',
            status: 'ok',
          },
        ]],
      ]),
      regulationSections: [
        {
          id: 'regulation.af1',
          header: 'Regulering (Tandlægerne Toft og Vedsted)',
          rows: [
            { id: 'regulation.af1:kilde', label: 'Navn på reguleringsform', value: 'overenskomst Tandlægeforening/HK' },
            { id: 'regulation.af1:skadesdato', label: 'Reguleringsdato (Skadedato)', value: '24-05-2023' },
            { id: 'regulation.af1:basisvaerdi', label: 'Basisværdi (indeks 100)', value: '33.476,39' },
            { id: 'regulation.af1:seneste_indeks', label: 'Seneste indeks', value: '110,32' },
          ],
          tables: [
            {
              id: 'regulation.af1:vaerdier',
              columns: ['Dato', 'Måneder', 'Grundløn', 'Feriepenge', 'Fritvalg', 'Store Bededag', 'Pension'],
              rows: [{ id: 'regulation.af1:table:1', cells: ['24-05-2023', '0,26', '25.174,00', '15,00%', '7,00%', '0,00%', '9,00%'] }],
            },
            {
              id: 'regulation.af1:beregnet',
              columns: ['Fra-dato', 'Til-dato', 'Indeksberegning', 'Indeks', 'Lønudvikling'],
              rows: [{ id: 'regulation.af1:table:2', cells: ['01-07-2023', '29-02-2024', '25.174,00 x (...)', '100,00', '+ 0,00 %'] }],
            },
          ],
        },
        {
          id: 'regulation.af2',
          header: 'Regulering (Hennings Autoophug)',
          rows: [{ id: 'regulation.af2:overenskomst', label: 'Overenskomst', value: 'ATL' }],
        },
      ],
    });

    const { container } = renderComponent({ revision: 'rev-1' } as never);

    expect(screen.getByText('Tandlægerne Toft og Vedsted')).toBeInTheDocument();
    expect(screen.getByText('Hennings Autoophug')).toBeInTheDocument();
    expect(screen.queryAllByText('Navn på arbejdssted')).toHaveLength(0);
    expect(screen.getByText('overenskomst Tandlægeforening/HK')).toBeInTheDocument();
    expect(screen.getAllByText('Navn på reguleringsform')).toHaveLength(2);
    expect(screen.getAllByText('overenskomst Tandlægeforening/HK')).toHaveLength(1);
    expect(screen.getByText('ASL-årslønsmaksimum')).toBeInTheDocument();
    expect(screen.getAllByText('24-05-2023').length).toBeGreaterThan(0);
    expect(screen.getByText('ATL')).toBeInTheDocument();
    expect(screen.getByText('Beregnet regulering')).toBeInTheDocument();
    expect(screen.queryByText('Basisværdi (indeks 100)')).not.toBeInTheDocument();
    expect(screen.queryByText('Seneste indeks')).not.toBeInTheDocument();
    expect(screen.queryByText('Pakke')).not.toBeInTheDocument();
    expect(screen.queryByText('Indeks')).toBeInTheDocument();
    expect(screen.queryByText('Reguleringsværdi på reguleringsdato for TAF')).not.toBeInTheDocument();
    expect(screen.queryByText('Reguleringsværdi på start-dato for TAF')).not.toBeInTheDocument();
    expect(screen.queryByText('Reguleringsværdi på slut-dato for TAF')).not.toBeInTheDocument();
    expect(screen.getByText('Reguleringsværdi på: Reguleringsdato / start-dato for TAF / slut-dato for TAF')).toBeInTheDocument();
    expect(screen.getAllByText('Fra-dato').length).toBeGreaterThan(0);
    expect(screen.getByText('Til-dato')).toBeInTheDocument();
    expect(screen.getByText('Indeksberegning')).toBeInTheDocument();
    expect(screen.getByText('Lønudvikling')).toBeInTheDocument();
    expect(screen.getAllByText('Lønindkomst').every((element) => element.classList.contains('row--subheading-underlined'))).toBe(true);
    expect(screen.getAllByText('Regulering').every((element) => element.classList.contains('row--subheading-underlined'))).toBe(true);
    expect(screen.getAllByText('Beregnet regulering').every((element) => element.classList.contains('row--subheading-underlined'))).toBe(true);
    const regulationSubheading = screen.getAllByText('Regulering')[0];
    const datoRow = screen.getByText('Reguleringsdato (Skadedato)');
    const valgtReguleringRow = screen.getByText('Valgt regulering');
    expect(
      regulationSubheading.compareDocumentPosition(datoRow) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    const navnRow = screen.getAllByText('Navn på reguleringsform')[0];
    const alleVaerdierRow = screen.getByText('Alle reguleringsværdier udfyldt');
    const combinedTafRow = screen.getByText('Reguleringsværdi på: Reguleringsdato / start-dato for TAF / slut-dato for TAF');
    expect(datoRow.compareDocumentPosition(valgtReguleringRow) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(valgtReguleringRow.compareDocumentPosition(navnRow) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(navnRow.compareDocumentPosition(alleVaerdierRow) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(alleVaerdierRow.compareDocumentPosition(combinedTafRow) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(container.querySelectorAll('.content-box')).toHaveLength(2);
  });

  it('bruger Arbejdssted-fallback i lønindkomsttitel når arbejdsstedsnavn mangler', () => {
    eoSnapshotToDebugViewMock.mockReturnValue({
      kind: 'ready',
      canonicalOutput: undefined,
      debugSnapshot: {
        sammentaellingRows: [],
      },
      stamdataValues: {},
      erstatningsopgoerelseValues: {
        midlertidigtEetAfgorelse: 'Nej',
        endeligtEetAfgorelse: 'Nej',
      },
      rowsBySection: new Map([
        ['loenindkomst', [
          {
            id: 'loenindkomst.af1.arbejdsstedNavn',
            label: 'Navn på arbejdssted',
            displayValue: '-',
            status: 'warning',
          },
          {
            id: 'loenindkomst.af1.regulering.navn',
            label: 'Navn på reguleringsform',
            displayValue: 'ASL-årslønsmaksimum',
            status: 'ok',
          },
        ]],
      ]),
      regulationSections: [],
    });

    renderComponent({ revision: 'rev-1' } as never);

    expect(screen.getByText('Arbejdssted 1')).toBeInTheDocument();
    expect(screen.getByText('Navn på arbejdssted')).toBeInTheDocument();
    expect(screen.getByText('ASL-årslønsmaksimum')).toBeInTheDocument();
  });

  it('renderer en regulerings-contentbox pr. ansættelsesforhold', () => {
    eoSnapshotToDebugViewMock.mockReturnValue({
      kind: 'ready',
      canonicalOutput: undefined,
      debugSnapshot: {
        sammentaellingRows: [],
      },
      stamdataValues: {},
      erstatningsopgoerelseValues: {
        midlertidigtEetAfgorelse: 'Nej',
        endeligtEetAfgorelse: 'Nej',
      },
      rowsBySection: new Map(),
      regulationSections: [
        {
          id: 'regulation.af-1',
          header: 'Regulering (Hennings Autoophug)',
          rows: [{ id: 'regulation.af-1:overenskomst', label: 'Overenskomst', value: 'Hoteloverenskomsten' }],
        },
        {
          id: 'regulation.af-2',
          header: 'Regulering (Tandlægerne Toft og Vedsted)',
          rows: [{ id: 'regulation.af-2:overenskomst', label: 'Overenskomst', value: 'Tandlægeforening/HK' }],
        },
      ],
    });

    renderComponent({ revision: 'rev-1' } as never);

    expect(screen.getByText('Regulering (Hennings Autoophug)')).toBeInTheDocument();
    expect(screen.getByText('Regulering (Tandlægerne Toft og Vedsted)')).toBeInTheDocument();
    expect(screen.getByText('Hoteloverenskomsten')).toBeInTheDocument();
    expect(screen.getByText('Tandlægeforening/HK')).toBeInTheDocument();
  });

  it('bevarer orphan-regulering som separat contentbox når ingen lønsektion matcher', () => {
    eoSnapshotToDebugViewMock.mockReturnValue({
      kind: 'ready',
      canonicalOutput: undefined,
      debugSnapshot: {
        sammentaellingRows: [],
      },
      stamdataValues: {},
      erstatningsopgoerelseValues: {
        midlertidigtEetAfgorelse: 'Nej',
        endeligtEetAfgorelse: 'Nej',
      },
      rowsBySection: new Map(),
      regulationSections: [
        {
          id: 'regulation.af-ukendt',
          header: 'Regulering (Ukendt)',
          rows: [{ id: 'regulation.af-ukendt:overenskomst', label: 'Overenskomst', value: 'Test' }],
        },
      ],
    });

    renderComponent({ revision: 'rev-1' } as never);

    expect(screen.getByText('Regulering (Ukendt)')).toBeInTheDocument();
    expect(screen.getByText('Test')).toBeInTheDocument();
  });

  it('viser AES-togglelinjen for endeligt EET selv når værdien er Nej', () => {
    eoSnapshotToDebugViewMock.mockReturnValue({
      kind: 'ready',
      canonicalOutput: undefined,
      debugSnapshot: {
        sammentaellingRows: [],
      },
      stamdataValues: {},
      erstatningsopgoerelseValues: {
        midlertidigtEetAfgorelse: 'Nej',
        endeligtEetAfgorelse: 'Nej',
      },
      rowsBySection: new Map([
        ['aes', [
          {
            id: 'aes.endeligtEetAfgorelse',
            label: 'Endelig EET-afgørelse 15+ %',
            displayValue: 'Nej',
            status: 'ok',
            group: 'aes.endeligtEet',
          },
          {
            id: 'aes.endeligEETAfgoerelseDato',
            label: 'Dato for endelig EET-afgørelse',
            displayValue: '-',
            status: 'ok',
            group: 'aes.endeligtEet',
          },
        ]],
      ]),
      regulationSections: [],
    });

    renderComponent({ revision: 'rev-1' } as never);

    expect(screen.getByText('Endelig EET-afgørelse 15+ %')).toBeInTheDocument();
    expect(screen.getByText('Nej')).toBeInTheDocument();
    expect(screen.queryByText('Dato for endelig EET-afgørelse')).not.toBeInTheDocument();
  });

  it('viser AES-togglelinjen for midlertidigt EET selv når værdien er Nej', () => {
    eoSnapshotToDebugViewMock.mockReturnValue({
      kind: 'ready',
      canonicalOutput: undefined,
      debugSnapshot: {
        sammentaellingRows: [],
      },
      stamdataValues: {},
      erstatningsopgoerelseValues: {
        midlertidigtEetAfgorelse: 'Nej',
        endeligtEetAfgorelse: 'Nej',
      },
      rowsBySection: new Map([
        ['aes', [
          {
            id: 'aes.midlertidigtEetAfgorelse',
            label: 'Midlertidigt EET-afgørelse 15+ %',
            displayValue: 'Nej',
            status: 'ok',
            group: 'aes.midlertidigtEet',
          },
          {
            id: 'aes.midlertidigEETAfgoerelseDato',
            label: 'Dato for midlertidig EET-afgørelse',
            displayValue: '-',
            status: 'ok',
            group: 'aes.midlertidigtEet',
          },
        ]],
      ]),
      regulationSections: [],
    });

    renderComponent({ revision: 'rev-1' } as never);

    expect(screen.getByText('Midlertidigt EET-afgørelse 15+ %')).toBeInTheDocument();
    expect(screen.getByText('Nej')).toBeInTheDocument();
    expect(screen.queryByText('Dato for midlertidig EET-afgørelse')).not.toBeInTheDocument();
  });

  it('viser AES-togglelinjen for varige mén når værdien er Nej', () => {
    eoSnapshotToDebugViewMock.mockReturnValue({
      kind: 'ready',
      canonicalOutput: undefined,
      debugSnapshot: {
        sammentaellingRows: [],
      },
      stamdataValues: {},
      erstatningsopgoerelseValues: {
        midlertidigtEetAfgorelse: 'Nej',
        endeligtEetAfgorelse: 'Nej',
      },
      rowsBySection: new Map([
        ['aes', [
          {
            id: 'aes.varigeMenAfgorelse',
            label: 'Afgørelse om varige mén 5+ %',
            displayValue: 'Nej',
            status: 'ok',
            group: 'aes.varigeMen',
          },
          {
            id: 'aes.menAfgoerelseDato',
            label: 'Mén-afgørelsesdato',
            displayValue: '-',
            status: 'ok',
            group: 'aes.varigeMen',
          },
        ]],
      ]),
      regulationSections: [],
    });

    renderComponent({ revision: 'rev-1' } as never);

    expect(screen.getByText('Afgørelse om varige mén 5+ %')).toBeInTheDocument();
    expect(screen.getByText('Nej')).toBeInTheDocument();
    expect(screen.getByText('Mén-afgørelsesdato')).toBeInTheDocument();
  });

  it('viser "ok" for offentlige ydelser uden fejl', () => {
    eoSnapshotToDebugViewMock.mockReturnValue({
      kind: 'ready',
      canonicalOutput: undefined,
      debugSnapshot: {
        sammentaellingRows: [],
      },
      stamdataValues: {},
      erstatningsopgoerelseValues: {
        midlertidigtEetAfgorelse: 'Nej',
        endeligtEetAfgorelse: 'Nej',
      },
      rowsBySection: new Map([
        ['offentlige-ydelser', [
          {
            id: 'offentligeYdelser.ydelsestype-sygedagpenge',
            label: 'Sygedagpenge',
            displayValue: 'ok',
            status: 'ok',
          },
          {
            id: 'offentligeYdelser.ydelsestype-pension',
            label: 'Pension',
            displayValue: 'ok',
            status: 'ok',
          },
        ]],
      ]),
      regulationSections: [],
    });

    renderComponent({ revision: 'rev-1' } as never);

    expect(screen.getByText('Offentlige ydelser')).toBeInTheDocument();
    expect(screen.getByText('Sygedagpenge')).toBeInTheDocument();
    expect(screen.getByText('Pension')).toBeInTheDocument();
    expect(screen.getAllByText('ok')).toHaveLength(2);
  });

  it('viser "Ingen" til venstre for tomme særlige kommentarer', () => {
    eoSnapshotToDebugViewMock.mockReturnValue({
      kind: 'ready',
      canonicalOutput: undefined,
      debugSnapshot: {
        sammentaellingRows: [],
      },
      stamdataValues: {},
      erstatningsopgoerelseValues: {
        midlertidigtEetAfgorelse: 'Nej',
        endeligtEetAfgorelse: 'Nej',
      },
      rowsBySection: new Map([
        ['saerlige-kommentarer', [
          {
            id: 'saerligekommentarer',
            label: 'Ingen',
            displayValue: '-',
            status: 'ok',
          },
        ]],
      ]),
      regulationSections: [],
    });

    renderComponent({ revision: 'rev-1' } as never);

    expect(screen.getByText('Eventuelle særlige kommentarer')).toBeInTheDocument();
    expect(screen.getByText('Ingen')).toBeInTheDocument();
  });

  it('viser TAF-sektionen som Tabt arbejdsfortjeneste', () => {
    eoSnapshotToDebugViewMock.mockReturnValue({
      kind: 'ready',
      canonicalOutput: undefined,
      debugSnapshot: {
        sammentaellingRows: [],
      },
      stamdataValues: {},
      erstatningsopgoerelseValues: {
        midlertidigtEetAfgorelse: 'Nej',
        endeligtEetAfgorelse: 'Nej',
      },
      rowsBySection: new Map([
        ['taf', [
          {
            id: 'taf.ophoerSkyldes',
            label: 'TAF-ophør skyldes',
            displayValue: 'Erstatningsperiodens ophør (21-12-2025)',
            status: 'ok',
          },
        ]],
      ]),
      regulationSections: [],
    });

    renderComponent({ revision: 'rev-1' } as never);

    expect(screen.getByText('Tabt arbejdsfortjeneste')).toBeInTheDocument();
    expect(screen.queryByText('TAF')).not.toBeInTheDocument();
  });

  it('viser grønne statusikoner for afledte reguleringsrækker uden egen fejllogik', () => {
    eoSnapshotToDebugViewMock.mockReturnValue({
      kind: 'ready',
      canonicalOutput: undefined,
      debugSnapshot: {
        sammentaellingRows: [],
      },
      stamdataValues: {},
      erstatningsopgoerelseValues: {
        midlertidigtEetAfgorelse: 'Nej',
        endeligtEetAfgorelse: 'Nej',
      },
      rowsBySection: new Map([
        ['loenindkomst', [
          {
            id: 'loenindkomst.af1.regulering.valgt',
            label: 'Valgt regulering',
            displayValue: 'Ja',
            status: 'ok',
          },
        ]],
      ]),
      regulationSections: [
        {
          id: 'regulation.af1',
          header: 'Regulering (Test)',
          rows: [
            { id: 'regulation.af1:skadesdato', label: 'Reguleringsdato (Skadedato)', value: '26-01-2024' },
            { id: 'regulation.af1:overenskomst', label: 'Overenskomst', value: 'KL-overenskomsten (Forhandlingsfællesskabet / KL)' },
          ],
        },
      ],
    });

    const { container } = renderComponent({ revision: 'rev-1' } as never);

    const skadesdatoLabel = screen.getByText('Reguleringsdato (Skadedato)');
    const overenskomstLabel = screen.getByText('Overenskomst');
    const skadesdatoRow = skadesdatoLabel.closest('.row--label-right-hover');
    const overenskomstRow = overenskomstLabel.closest('.row--label-right-hover');

    expect(skadesdatoRow?.querySelector('[data-testid=\"CheckIcon\"]')).not.toBeNull();
    expect(overenskomstRow?.querySelector('[data-testid=\"CheckIcon\"]')).not.toBeNull();
    expect(container.querySelectorAll('[data-testid=\"CheckIcon\"]').length).toBeGreaterThanOrEqual(3);
  });
});
