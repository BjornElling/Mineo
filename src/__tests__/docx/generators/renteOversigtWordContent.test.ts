// @vitest-environment jsdom
/// <reference types="vitest/globals" />
import {
  generateRenteOversigtDocument,
  type RenteOversigtRow,
} from '../../../document/generators/renteberegning/renteOversigtDocument';
import { toISODateString } from '../../../types/branded';
import { renderWordDocument, xmlToPlainText } from './wordContentHarness';

const makeRow = (overrides?: Partial<RenteOversigtRow>): RenteOversigtRow => ({
  beloeb: 1250,
  rentedato: toISODateString('2024-01-11'),
  beregnetRente: 2.25,
  ...overrides,
});

describe('renteOversigt → Word-indhold', () => {
  it('skriver titel, beregningsdato-linje og tabel-headere til .docx', async () => {
    const { filename, documentXml } = await renderWordDocument((session) => {
      return generateRenteOversigtDocument(session, toISODateString('2024-02-01'), [
        makeRow(),
        makeRow({ beloeb: 5000, rentedato: toISODateString('2023-06-01'), beregnetRente: 412.5 }),
      ]);
    });
    const text = xmlToPlainText(documentXml);

    expect(filename).toMatch(/\.docx$/);
    expect(text).toContain('Procesrente');
    expect(text).toContain('Rente beregnes til og med 01-02-2024');
    expect(text).toContain('Rentedato');
    expect(text).toContain('11-01-2024');
    expect(text).toContain('Beregnet rente');
    expect(text).toContain('Samlet rentebeløb');
  });

  it('skriver beregningsprincipper til .docx', async () => {
    const { filename, documentXml } = await renderWordDocument((session) => {
      return generateRenteOversigtDocument(session, toISODateString('2024-02-01'), [makeRow()]);
    });
    const text = xmlToPlainText(documentXml);

    expect(filename).toMatch(/\.docx$/);
    expect(text).toContain('Beregningsprincipper');
    expect(text).toContain('Rente beregnes i henhold til renteloven.');
  });

  it('skriver hypotetisk-advarsel til .docx når beregningsdatoen ligger efter seneste procesrente', async () => {
    const { documentXml } = await renderWordDocument((session) => {
      return generateRenteOversigtDocument(session, toISODateString('2024-07-01'), [makeRow()], {
        latestReferenceRatePeriodEnd: toISODateString('2024-06-30'),
      });
    });
    const text = xmlToPlainText(documentXml);

    expect(text).toContain(
      'Der er kun fastsat procesrente frem til 30-06-2024. Beregning derefter er hypotetisk!'
    );
  });
});
