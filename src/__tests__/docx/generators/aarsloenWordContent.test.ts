/// <reference types="vitest/globals" />
import { generateAarsloenDocument } from '../../../document/generators/aarsloen/aarsloenDocument';
import { renderWordDocument, xmlToPlainText } from './wordContentHarness';

// Word-indholdstest for årslønsberegningen: kører den RIGTIGE generator gennem
// Word-backenden og verificerer, at titel, satser, tabel og beregningsafsnit
// faktisk når .docx'en (ingen skjult indholdstab).
describe('aarsloen → Word-indhold', () => {
  it('skriver titel, satser og indtægtstabel til .docx', async () => {
    const { filename, documentXml } = await renderWordDocument(() => {
      generateAarsloenDocument({
        satser: {
          feriePct: 12.5,
          fritvalgPct: 2,
          shSoPct: 3,
          pensionPct: 10,
        },
        loenperiode: 'maaned',
        tableData: [
          {
            id: 'row-1',
            col0_maaned: '1',
            col1_maaned: '2024',
            col0_uge: '',
            col1_uge: '',
            col0_dag: undefined,
            col1_dag: undefined,
            col2: { kind: 'number', value: 11111 },
            col3: { kind: 'number', value: 1111 },
            col4: { kind: 'number', value: 111 },
            col5: { kind: 'number', value: 11 },
          },
          {
            id: 'row-2',
            col0_maaned: '2',
            col1_maaned: '2024',
            col0_uge: '',
            col1_uge: '',
            col0_dag: undefined,
            col1_dag: undefined,
            col2: { kind: 'number', value: 12000 },
            col3: undefined,
            col4: undefined,
            col5: undefined,
          },
        ],
        beregnetAarsloen: 24333,
        omregningTilFuldtAar: false,
        periodeData: null,
        fuldLoenUnderFerie: false,
        retTilSjetteFerieuge: false,
        antalFeriedage: undefined,
        loenPaaHelligdage: 'Ingen',
        shDageAntal: null,
        beregningsData: { metode: 'ingen', erEtAar: false } as never,
      });
    });

    const text = xmlToPlainText(documentXml);
    expect(filename).toMatch(/\.docx$/);
    expect(text).toContain('Årslønsberegning');
    // Satser-sektion + en konkret label
    expect(text).toContain('Satser');
    expect(text).toContain('Feriegodtgørelse/-tillæg');
    // Indtægtsoplysninger-tabel + total
    expect(text).toContain('Indtægtsoplysninger');
    expect(text).toContain('I alt');
  });

  it('inkluderer beregningsafsnit ved omregning til fuldt år (metode C)', async () => {
    const { filename, documentXml } = await renderWordDocument(() => {
      generateAarsloenDocument({
        satser: {
          feriePct: 12.5,
        },
        loenperiode: 'maaned',
        tableData: [
          {
            id: 'row-1',
            col0_maaned: '1',
            col1_maaned: '2024',
            col0_uge: '',
            col1_uge: '',
            col0_dag: undefined,
            col1_dag: undefined,
            col2: { kind: 'number', value: 30000 },
            col3: undefined,
            col4: undefined,
            col5: undefined,
          },
        ],
        beregnetAarsloen: 30000,
        omregningTilFuldtAar: true,
        periodeData: { antalMaaneder: 1 } as never,
        fuldLoenUnderFerie: true,
        retTilSjetteFerieuge: false,
        antalFeriedage: undefined,
        loenPaaHelligdage: 'Almindelig løn',
        shDageAntal: null,
        beregningsData: {
          metode: 'C',
          erEtAar: false,
          antalEnheder: 1,
          omregnetAarsloen: 360000,
        } as never,
      });
    });

    const text = xmlToPlainText(documentXml);
    expect(filename).toMatch(/\.docx$/);
    expect(text).toContain('Beregningsprincipper');
    expect(text).toContain('Beregning');
    expect(text).toContain('Sammentælling af løn fra tabellen');
  });
});
