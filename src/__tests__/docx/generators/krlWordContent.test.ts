// @vitest-environment jsdom
/// <reference types="vitest/globals" />
import { generateKRLDocument } from '../../../document/generators/krl/krlDocument';
import { renderWordDocument, xmlToPlainText } from './wordContentHarness';

// Word-indholdstest for KRL-satstabeller: kører den rigtige generator gennem
// Word-backenden og verificerer, at titel, tabel og kilde faktisk når .docx'en.
describe('krl → Word-indhold', () => {
  it('skriver titel og kilde til .docx', async () => {
    const { filename, documentXml } = await renderWordDocument((session) => {
      return generateKRLDocument(session, { visBrevhoved: false, anvendtSatstabel: 'KTO (kommuner)' });
    });

    const text = xmlToPlainText(documentXml);
    expect(filename).toMatch(/\.docx$/);
    expect(text).toContain('KRL Satstabeller');
    // Kildetekst under tabellen skal med, ellers er der tabt indhold.
    expect(text).toContain('Kilde');
    expect(text).toMatch(/krl\.dk/i);
  });

  it('fremhæver den anvendte satstabel og skriver datoerne ældste først (BB-317)', async () => {
    const { documentXml } = await renderWordDocument((session) =>
      generateKRLDocument(session, { visBrevhoved: false, anvendtSatstabel: 'SHK (regioner)' }));

    const text = xmlToPlainText(documentXml);
    expect(text).toContain('SHK (regioner) (anvendt)');
    expect(text).not.toContain('KTO (kommuner) (anvendt)');
    const datoer = [...text.matchAll(/(\d{2})-(\d{2})-(\d{4})/g)].map(([, d, m, y]) => `${y}-${m}-${d}`);
    expect(datoer.length).toBeGreaterThan(1);
    expect(datoer).toEqual([...datoer].sort());
  });

  it('inkluderer brevhoved-journalnr når brevhoved er slået til', async () => {
    const { documentXml } = await renderWordDocument((session) => {
      return generateKRLDocument(session, {
        visBrevhoved: true,
        anvendtSatstabel: 'KTO (kommuner)',
        stamdata: { journalnr: '5566', advokat: 'AB', sagsbehandler: 'CD' } as never,
      });
    });

    const text = xmlToPlainText(documentXml);
    expect(text).toContain('5566');
  });
});
