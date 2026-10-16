// @vitest-environment jsdom
/// <reference types="vitest/globals" />
import { generateReguleringDocument } from '../../../document/generators/eo/reguleringDocument';
import { ILON12_DISCONTINUED_NOTE } from '../../../data/statistikNotes';
import { renderWordDocument, xmlToPlainText } from './wordContentHarness';
import type { DanishDateString } from '../../../types/branded';

// Word-indholdstest for regulering-dokumentet: kører den rigtige generator gennem
// Word-backenden og verificerer, at titel, valgt model-label og tabelindhold
// faktisk når .docx'en. Vi bruger Statistik + ASL-årslønsmaksimum, da den sti
// trækker direkte fra aarsloenAslMax og ikke kræver offentlig-løn-lookup-input.
//
// Generatoren forventer interval allerede resolvet til { fraDato, tilDato }
// (DD-MM-YYYY danske datostrenge) – jf. downloadReguleringDokument i pdfService.ts,
// der spreder input + resolveReguleringInterval(...) + common-kontekst.
describe('regulering → Word-indhold', () => {
  const interval = {
    fraDato: '01-01-2022' as DanishDateString,
    tilDato: '31-12-2024' as DanishDateString,
  };

  it('skriver titel, model-label og ASL-tabel til .docx', async () => {
    const { filename, documentXml } = await renderWordDocument((session) => {
      return generateReguleringDocument(session, {
        overenskomstLabel: '',
        loenudviklingBasis: 'Statistik',
        overenskomstId: undefined,
        statistikModelLabel: 'ASL-årslønsmaksimum',
        interval,
        applyAlmindeligLoenPaaShDageRegel: false,
        visBrevhoved: false,
      });
    });

    const text = xmlToPlainText(documentXml);
    expect(filename).toMatch(/\.docx$/);
    expect(text).toContain('Regulering');
    // Den valgte model-label skal skrives som underrubrik.
    expect(text).toContain('ASL-årslønsmaksimum');
    // ASL-tabellens kolonneoverskrifter skal med.
    expect(text).toContain('Maksimum årsløn');
    // Mindst ét af de forventede årstal i intervallet (2022–2024).
    expect(text).toContain('2023');
  });

  it('inkluderer brevhoved-journalnr når brevhoved er slået til', async () => {
    const { documentXml } = await renderWordDocument((session) => {
      return generateReguleringDocument(session, {
        overenskomstLabel: '',
        loenudviklingBasis: 'Statistik',
        overenskomstId: undefined,
        statistikModelLabel: 'ASL-årslønsmaksimum',
        interval,
        applyAlmindeligLoenPaaShDageRegel: false,
        visBrevhoved: true,
        stamdata: { journalnr: '7711', advokat: 'AB', sagsbehandler: 'CD' } as never,
      });
    });

    const text = xmlToPlainText(documentXml);
    expect(text).toContain('7711');
  });

  it('skriver ILON12-ophørsbemærkning efter tabellen', async () => {
    const { documentXml } = await renderWordDocument((session) => {
      return generateReguleringDocument(session, {
        overenskomstLabel: '',
        loenudviklingBasis: 'Statistik',
        overenskomstId: undefined,
        statistikModelLabel: 'ILON12 (Danmarks Statistik)',
        interval,
        applyAlmindeligLoenPaaShDageRegel: false,
        visBrevhoved: false,
      });
    });

    const text = xmlToPlainText(documentXml);
    expect(text).toContain(ILON12_DISCONTINUED_NOTE);
  });

  // Afklaringslog 10a: forhøjet grundløn vises i sin gemte enhed og omregnet til «Ansættelse»-enheden.
  it.each([
    ['Timeløn', 'Måned', 'Forhøjelsen udgør 1.000 kr./måned / 160,33 = 6,24 kr./time.'],
    ['Månedsløn', 'Måned', 'Forhøjelsen udgør 1.000 kr./måned.'],
  ] as const)('skriver forhøjet grundløn ved %s angivet pr. %s', async (offentligLoenType, enhed, forventet) => {
    const { documentXml } = await renderWordDocument((session) => generateReguleringDocument(session, {
      overenskomstLabel: 'KL',
      loenudviklingBasis: 'Overenskomst',
      overenskomstId: 'kl-overenskomst',
      statistikModelLabel: undefined,
      interval,
      applyAlmindeligLoenPaaShDageRegel: false,
      offentligLoenType,
      offentligLoenTrin: 1,
      offentligLoenGruppe: 0,
      offentligLoenEkstraGrundloen: 1000,
      offentligLoenEkstraGrundloenAngivesPer: enhed,
      visBrevhoved: false,
    }));

    expect(xmlToPlainText(documentXml)).toContain(forventet);
  });
});
