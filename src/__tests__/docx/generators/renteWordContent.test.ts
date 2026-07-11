// @vitest-environment jsdom
/// <reference types="vitest/globals" />
import { generateRenteDocument } from '../../../document/generators/renteberegning/renteDocument';
import type { ProcessInterestPeriod } from '../../../domain/renteberegning/procesrenteCalculator';
import { toISODateString } from '../../../types/branded';
import { renderWordDocument, xmlToPlainText } from './wordContentHarness';

const makePeriod = (overrides?: Partial<ProcessInterestPeriod>): ProcessInterestPeriod => ({
  startDate: new Date(toISODateString('2024-01-01')),
  endDate: new Date(toISODateString('2024-06-30')),
  amount: 1000,
  referenceRatePct: 4.25,
  surchargeRatePct: 8,
  totalRatePct: 12.25,
  days: 181,
  interest: 60.87,
  ...overrides,
});

describe('rente → Word-indhold', () => {
  it('skriver titel, hovedstol og tabel-headere til .docx', async () => {
    const { filename, documentXml } = await renderWordDocument((session) => {
      return generateRenteDocument(session, 1000, '01-01-2024', '30-06-2024', [makePeriod()]);
    });
    const text = xmlToPlainText(documentXml);

    expect(filename).toMatch(/\.docx$/);
    expect(text).toContain('Procesrente');
    expect(text).toContain('Hovedstol');
    expect(text).toContain('Rentedage');
    expect(text).toContain('Beregnet rente');
    expect(text).toContain('60,87 kr.');
  });

  it('skriver beregningsprincipper til .docx', async () => {
    const { filename, documentXml } = await renderWordDocument((session) => {
      return generateRenteDocument(session, 1000, '01-01-2024', '30-06-2024', [makePeriod()]);
    });
    const text = xmlToPlainText(documentXml);

    expect(filename).toMatch(/\.docx$/);
    expect(text).toContain('Beregningsprincipper');
    expect(text).toContain('Rente beregnes i henhold til renteloven.');
  });
});
