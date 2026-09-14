// @vitest-environment jsdom
/// <reference types="vitest/globals" />

import type { SatserDocumentInput } from '../../../domain/satser/satserDocumentDefinition';
import { generateSatserDocument } from '../../../document/generators/satser/satserDocument';
import { renderWordDocument, xmlToPlainText } from '../../docx/generators/wordContentHarness';

type SatserData = SatserDocumentInput['satser'];

const satser: SatserData = {
  eal: {
    svieSmertePrDag: null,
    svieSmerteMax: null,
    erhvervsevnetabEalMax: null,
    foersoergertabEalMin: null,
    vejledendeUdtalelseEet: null,
  },
  asl: {
    varigeMenPrGrad: null,
    aarsloenAslMax: null,
    aarsloenMin: null,
    aarsloenMinFoer2024: null,
    aarsloenMinFra2024: null,
    overgangsbelob: null,
    reguleringProcentErhvervsevnetab: null,
    reguleringProcentErhvervsevnetabFoer2024: null,
    reguleringProcentErhvervsevnetabFra2024: null,
  },
  diverse: {
    friProcesEnlig: null,
    friProcesSamlevende: null,
    friProcesBarn: null,
    reguleringssats: 2.75,
  },
  referencer: {
    ealReference: '',
    ealReferenceLinks: [],
    aslReference: '',
    aslReferenceLinks: [],
    kapitalisering: '',
    kapitaliseringLinks: [],
    kapitaliseringSkadeFra2011: '',
    kapitaliseringSkadeFra2011Links: [],
    kapitaliseringSkadeFoer2011: '',
    kapitaliseringSkadeFoer2011Links: [],
    kapitaliseringSkadeFra2007: '',
    kapitaliseringSkadeFra2007Links: [],
    kapitaliseringSkadeFoer2007: '',
    kapitaliseringSkadeFoer2007Links: [],
    friProcesReference: '',
    friProcesReferenceLinks: [],
    reguleringssatsReference: '',
    reguleringssatsReferenceLinks: [],
  },
};

describe('DATA-001/TD-020 – diverse.reguleringssats som dokumentforbruger', () => {
  it('skriver den håndskrevne reguleringssats som dansk procentfacit', async () => {
    const { documentXml } = await renderWordDocument((session) =>
      generateSatserDocument(session, 2025, satser, { visBrevhoved: false })
    );
    const text = xmlToPlainText(documentXml);

    expect(text).toContain('Diverse');
    expect(text).toMatch(/Reguleringssats\s*2,75 %/);
  });
});
