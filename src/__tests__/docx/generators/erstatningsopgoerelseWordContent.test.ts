/// <reference types="vitest/globals" />
import { STAMDATA_INITIAL_VALUES } from '../../../domain/stamdata/stamdataInitialValues';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { computeEoSnapshot } from '../../../domain/erstatningsopgoerelse/snapshot/eoSnapshot';
import { eoSnapshotToEoPdfDocument } from '../../../domain/erstatningsopgoerelse/snapshot/eoSnapshotToEoPdfDocument';
import type { EoModel } from '../../../domain/erstatningsopgoerelse/snapshot/eoPresentationModel';
import type { ErstatningsopgoerelseValues, StamdataValues } from '../../../schemas/formSchemas';
import { generateErstatningsopgoerelsePdf } from '../../../pdf/domains/eo/erstatningsopgoerelsePdf';
import { toISODateString } from '../../../types/branded';
import { renderWordDocument, xmlToPlainText } from './wordContentHarness';

const selected = {
  opgoerelse: true,
  loenindkomst: false,
  offentligeYdelser: false,
  shDage: false,
  regulering: false,
  okSatser: false,
  sygeferiegodtgoerelse: false,
  midlertidigEet: false,
};

const buildProjectedDocument = (stamdata: StamdataValues, eo: ErstatningsopgoerelseValues): EoModel => {
  const snapshot = computeEoSnapshot({ revision: 'docx-eo-test', stamdataValues: stamdata, eoValues: eo });
  const projection = eoSnapshotToEoPdfDocument(snapshot);
  if (projection.kind === 'blocked') {
    throw new Error(projection.message);
  }
  return projection.document;
};

describe('erstatningsopgørelse → Word-indhold', () => {
  const baseStamdata = (): StamdataValues => structuredClone(STAMDATA_INITIAL_VALUES);
  const baseEo = (): ErstatningsopgoerelseValues => {
    const values = createErstatningsopgoerelseInitialValues();
    values.kravPaaSvieSmerteGodtgoerelse = 'Nej';
    values.kravPaaTabtArbejdsfortjeneste = 'Nej';
    return values;
  };

  it('skriver hovedtitel og erstatningsperiode til .docx', async () => {
    const stamdata = baseStamdata();
    const eo = baseEo();
    eo.eoNummer = '1';
    eo.vedroererPeriodeFra = toISODateString('2025-04-03');
    eo.vedroererPeriodeTil = toISODateString('2026-02-22');
    stamdata.skadelidte = 'Kim Thinggaard Plehn Larsen';

    const { filename, documentXml } = await renderWordDocument(() => {
      generateErstatningsopgoerelsePdf(stamdata, eo, selected, {
        visUdkastStempel: false,
        document: buildProjectedDocument(stamdata, eo),
      });
    });

    const text = xmlToPlainText(documentXml);
    expect(filename).toMatch(/\.docx$/);
    expect(text).toContain('Erstatningsopgørelse 1');
    expect(text).toContain('03-04-2025 - 22-02-2026');
  });

  it('tilføjer UDKAST-vandmærke i header og (udkast)-filnavn når visUdkastStempel=true', async () => {
    const stamdata = baseStamdata();
    const eo = baseEo();

    const { filename, zip } = await renderWordDocument(() => {
      generateErstatningsopgoerelsePdf(stamdata, eo, selected, {
        visUdkastStempel: true,
        document: buildProjectedDocument(stamdata, eo),
      });
    });

    expect(filename).toMatch(/ \(udkast\)\.docx$/);
    const headerFiles = Object.keys(zip.files).filter((name) => /word\/header\d+\.xml$/.test(name));
    const headerXmls = await Promise.all(headerFiles.map((name) => zip.file(name)!.async('string')));
    const hasWatermark = headerXmls.some((xml) => /string="UDKAST"/.test(xml));
    expect(hasWatermark).toBe(true);
  });

  it('udelader UDKAST-vandmærke når visUdkastStempel=false', async () => {
    const stamdata = baseStamdata();
    const eo = baseEo();

    const { filename, zip } = await renderWordDocument(() => {
      generateErstatningsopgoerelsePdf(stamdata, eo, selected, {
        visUdkastStempel: false,
        document: buildProjectedDocument(stamdata, eo),
      });
    });

    expect(filename).not.toMatch(/\(udkast\)/);
    const headerFiles = Object.keys(zip.files).filter((name) => /word\/header\d+\.xml$/.test(name));
    const headerXmls = await Promise.all(headerFiles.map((name) => zip.file(name)!.async('string')));
    const hasWatermark = headerXmls.some((xml) => /string="UDKAST"/.test(xml));
    expect(hasWatermark).toBe(false);
  });
});
