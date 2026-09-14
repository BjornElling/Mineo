/// <reference types="vitest/globals" />

import type { DocumentGenerationSession } from '../../document/documentGenerationSession';
import {
  satserDocumentDefinition,
  type SatserDocumentInput,
} from '../../domain/satser/satserDocumentDefinition';
import type { StamdataValues } from '../../schemas/formSchemas';

const { generateSatserDocumentMock } = vi.hoisted(() => ({
  generateSatserDocumentMock: vi.fn(async () => ({
    blob: new Blob(['renderer-facit']),
    filename: 'satser-facit.pdf',
  })),
}));

vi.mock('../../document/generators/satser/satserDocument', () => ({
  generateSatserDocument: generateSatserDocumentMock,
}));

const fakeSession = (): DocumentGenerationSession => ({
  format: 'pdf',
  render: vi.fn(async () => ({
    blob: new Blob(),
    filename: 'session-facit.pdf',
  })),
} as unknown as DocumentGenerationSession);

const stamdata: StamdataValues = {
  journalnr: 'J-DOC-001',
  advokat: 'Advokat',
  sagsbehandler: 'Sagsbehandler',
  skadelidte: 'Skadelidte',
  skadestype: 'Arbejdsulykke',
  skadedato: undefined,
  skadelidteFodselsdato: undefined,
};

const satser: SatserDocumentInput['satser'] = {
  eal: {
    svieSmertePrDag: 230,
    svieSmerteMax: 88_500,
    erhvervsevnetabEalMax: 10_000_000,
    foersoergertabEalMin: 1_000_000,
    vejledendeUdtalelseEet: 500_000,
  },
  asl: {
    varigeMenPrGrad: 10_000,
    aarsloenAslMax: 600_000,
    aarsloenMin: 250_000,
    aarsloenMinFoer2024: 227_000,
    aarsloenMinFra2024: 257_000,
    overgangsbelob: 100_000,
    reguleringProcentErhvervsevnetab: 0.04,
    reguleringProcentErhvervsevnetabFoer2024: 0.03,
    reguleringProcentErhvervsevnetabFra2024: 0,
  },
  diverse: {
    friProcesEnlig: 1_000,
    friProcesSamlevende: 2_000,
    friProcesBarn: 500,
    reguleringssats: 0.04,
  },
  referencer: {
    ealReference: 'EAL-facit',
    ealReferenceLinks: [],
    aslReference: 'ASL-facit',
    aslReferenceLinks: [],
    kapitalisering: 'Kapitalisering-facit',
    kapitaliseringLinks: [],
    kapitaliseringSkadeFra2011: 'Fra 2011-facit',
    kapitaliseringSkadeFra2011Links: [],
    kapitaliseringSkadeFoer2011: 'Før 2011-facit',
    kapitaliseringSkadeFoer2011Links: [],
    kapitaliseringSkadeFra2007: 'Fra 2007-facit',
    kapitaliseringSkadeFra2007Links: [],
    kapitaliseringSkadeFoer2007: 'Før 2007-facit',
    kapitaliseringSkadeFoer2007Links: [],
    friProcesReference: 'Fri proces-facit',
    friProcesReferenceLinks: [],
    reguleringssatsReference: 'Reguleringssats-facit',
    reguleringssatsReferenceLinks: [],
  },
};

describe('DOC-001: Satser-definitionens renderer-wiring', () => {
  it('videresender typed sats-snapshot og stamdata ved aktivt brevhoved', async () => {
    const session = fakeSession();
    const input: SatserDocumentInput = { year: 2024, satser, stamdata };
    const render = await satserDocumentDefinition.loadRenderer();

    await expect(render(session, input, { visBrevhoved: true })).resolves.toEqual({
      blob: expect.any(Blob),
      filename: 'satser-facit.pdf',
    });

    expect(generateSatserDocumentMock).toHaveBeenCalledTimes(1);
    expect(generateSatserDocumentMock).toHaveBeenCalledWith(
      session,
      2024,
      satser,
      { visBrevhoved: true, stamdata }
    );
  });
});
