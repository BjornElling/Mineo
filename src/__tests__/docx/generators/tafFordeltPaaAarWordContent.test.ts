/// <reference types="vitest/globals" />
import type { TafPerYearResult } from '../../../domain/erstatningsopgoerelse/engines/tafPerYearDerived';
import type { MoneyOre } from '../../../domain/erstatningsopgoerelse/snapshot/eoPresentationModel';
import type { TafPerYearDocument } from '../../../domain/erstatningsopgoerelse/snapshot/eoSnapshotToTafPerYearDocument';
import { generateTafFordeltPaaAarDocument } from '../../../document/generators/tafFordelt/tafFordeltPaaAarDocument';
import { toISODateString } from '../../../types/branded';
import { renderWordDocument, xmlToPlainText } from './wordContentHarness';

// Word-indholdstest for TAF fordelt på år: kører den RIGTIGE generator gennem
// Word-backenden med et præ-projiceret dokument (mineret fra wiring-testen) og
// verificerer, at årsoverskrifter, fradragslinjer og total faktisk når .docx'en.
const FAKE_MODEL = {
  brevhoved: null,
  periodeDisplay: '01-01-2024 - 31-12-2024',
  skadelidteNavn: 'Test Person',
  skadestypeLinje: 'Arbejdsulykke den 1. januar 2024',
  forlig: { erIndgaaet: false, label: null, dato: null, factor: null },
  tabtArbejdsfortjeneste: {
    beregnes: true,
    statusLinjer: ['Status: aktiv'],
    eetLinjer: [],
    differencekravLinje: null,
    harTafPerioder: true,
    tafPerioderLinjer: ['01-01-2024 - 31-12-2024'],
  },
};

const FAKE_RESULT: TafPerYearResult = {
  years: [
    {
      year: 2024,
      segments: [
        {
          fra: toISODateString('2024-01-02') as never,
          til: toISODateString('2024-12-31') as never,
          kind: 'arbejdsdage',
          quantity: 250,
          sourceLabel: 'Timeløn',
          unitAmountOre: 200000 as MoneyOre,
          deltaPct: 0,
          amountOre: 50000000 as MoneyOre,
        },
      ],
      deductions: [
        { label: 'Sygedagpenge', amountOre: 10000000 as MoneyOre },
        { label: 'Allerede betalt TAF', amountOre: 2500000 as MoneyOre },
      ],
      yearIncomeOre: 50000000 as MoneyOre,
      yearDeductionsOre: 12500000 as MoneyOre,
      yearTafFoerForligOre: 37500000 as MoneyOre,
      yearTafOre: 37500000 as MoneyOre,
    },
  ],
  sumYearTafOre: 37500000 as MoneyOre,
  afrundingOre: 0 as MoneyOre,
  samletTafKravOre: 37500000 as MoneyOre,
};

const FAKE_DOCUMENT: TafPerYearDocument = {
  model: FAKE_MODEL as never,
  presentation: FAKE_RESULT,
};

describe('tafFordeltPaaAar → Word-indhold', () => {
  it('skriver årsfordeling, fradragslinjer og total til .docx', async () => {
    const { filename, documentXml } = await renderWordDocument(() => {
      generateTafFordeltPaaAarDocument({ document: FAKE_DOCUMENT });
    });

    const text = xmlToPlainText(documentXml);
    expect(filename).toMatch(/\.docx$/);
    expect(text).toContain('Tabt arbejdsfortjeneste fordelt på år');
    expect(text).toContain('Erstatningsperiode med tabt arbejdsfortjeneste');
    expect(text).toContain('2024');
    // Fradragslinje + total skal med, ellers er der tabt indhold.
    expect(text).toContain('Allerede betalt TAF');
    expect(text).toContain('Samlet TAF-krav');
  });

  it('giver udkast-suffix i filnavnet når visUdkastStempel=true', async () => {
    const { filename } = await renderWordDocument(() => {
      generateTafFordeltPaaAarDocument({ document: FAKE_DOCUMENT, visUdkastStempel: true });
    });

    expect(filename).toMatch(/ \(udkast\)\.docx$/);
  });
});
