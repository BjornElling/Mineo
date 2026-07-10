// @vitest-environment jsdom
/// <reference types="vitest/globals" />
import type { TafPerYearResult } from '../../../domain/erstatningsopgoerelse/engines/tafPerYearDerived';
import { moneyOre } from '../../../domain/money/money';
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
          unitAmountOre: moneyOre(200000),
          deltaPct: 0,
          amountOre: moneyOre(50000000),
        },
      ],
      deductions: [
        { label: 'Sygedagpenge', amountOre: moneyOre(10000000) },
      ],
      yearIncomeOre: moneyOre(50000000),
      yearDeductionsOre: moneyOre(10000000),
      // "Allerede betalt TAF" bæres separat (uden for forlig-faktoren), ikke i deductions.
      yearTidligereModtagetTafOre: moneyOre(2500000),
      yearTafFoerForligOre: moneyOre(40000000),
      yearTafOre: moneyOre(37500000),
    },
  ],
  sumYearTafOre: moneyOre(37500000),
  afrundingOre: moneyOre(0),
  samletTafKravOre: moneyOre(37500000),
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
