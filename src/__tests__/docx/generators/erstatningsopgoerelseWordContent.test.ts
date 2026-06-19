/// <reference types="vitest/globals" />
import { STAMDATA_INITIAL_VALUES } from '../../../domain/stamdata/stamdataInitialValues';
import {
  createDefaultLoenindkomstAnsaettelsesforhold,
  createErstatningsopgoerelseInitialValues,
} from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { computeEoSnapshot } from '../../../domain/erstatningsopgoerelse/snapshot/eoSnapshot';
import { eoSnapshotToEoDocument } from '../../../domain/erstatningsopgoerelse/snapshot/eoSnapshotToEoDocument';
import type { EoModel } from '../../../domain/erstatningsopgoerelse/snapshot/eoPresentationModel';
import type { ErstatningsopgoerelseValues, StamdataValues } from '../../../schemas/formSchemas';
import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import { generateErstatningsopgoerelseDocument } from '../../../document/generators/eo/erstatningsopgoerelseDocument';
import { withSfggIngenForEmployments } from '../../utils/sfggTestSupport';
import { toISODateString } from '../../../types/branded';
import { renderWordDocument, xmlToPlainText } from './wordContentHarness';

const asAmountValue = (value: number): AmountValue => ({ kind: 'number', value });

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
  const projection = eoSnapshotToEoDocument(snapshot);
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
      generateErstatningsopgoerelseDocument(stamdata, eo, selected, {
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
      generateErstatningsopgoerelseDocument(stamdata, eo, selected, {
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
      generateErstatningsopgoerelseDocument(stamdata, eo, selected, {
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

  // Supplerende multi-sektions-fixture (jf. udskudt fund fra 10.7): den oprindelige EO-paritetstest
  // kørte kun med `opgoerelse: true`, så bilag-sektionerne (Lønindkomst, SH-dage) var IKKE Word-dækket
  // via generator-paritet. Her aktiveres de med reelt datagrundlag, så et skjult indholdstab i en
  // bilag-sektion under Word fanges.
  it('skriver bilag-sektionerne (Lønindkomst, SH-dage) til .docx', async () => {
    const stamdata: StamdataValues = {
      ...structuredClone(STAMDATA_INITIAL_VALUES),
      skadestype: 'Arbejdsulykke',
      skadedato: toISODateString('2024-01-01'),
    };
    const eo = createErstatningsopgoerelseInitialValues();
    eo.kravPaaTabtArbejdsfortjeneste = 'Ja';
    // Angivet månedsløn driver TAF; indkomst-tabellen (indkomst uden skade) driver
    // lønindkomst-bilaget. De afstemmes ikke mod hinanden, så projektionens kontrol-
    // invariant (indkomst-uoverensstemmelse) blokerer ikke.
    eo.beregnesUdFra = 'Angivet månedsløn';
    eo.maanedsloenenUdgoer = asAmountValue(40000);
    eo.eoAngivetLoenLoenudvikling.loenudviklingBeregningsgrundlag = 'Ingen';
    eo.vedroererPeriodeFra = toISODateString('2024-01-01');
    eo.vedroererPeriodeTil = toISODateString('2024-01-31');
    eo.tafBeregningsperiodeFra = toISODateString('2024-01-01');
    eo.tafBeregningsperiodeTil = toISODateString('2024-01-31');
    eo.tafPerioder = [{ id: 'taf-1', fra: toISODateString('2024-01-01'), til: toISODateString('2024-01-31'), loseFeriedage: undefined }];
    eo.loenindkomstAnsaettelsesforhold = [
      {
        ...createDefaultLoenindkomstAnsaettelsesforhold(),
        id: 'af-1',
        navnPaaArbejdssted: 'AAB',
        loenudviklingBeregningsgrundlag: 'Ingen',
        indtaegtsoplysningerTableData: [
          {
            id: 'row-1',
            col0_maaned: '1',
            col1_maaned: '2024',
            col0_uge: '',
            col1_uge: '',
            col0_dag: undefined,
            col1_dag: undefined,
            col2: asAmountValue(10000),
            col3: undefined,
            col4: undefined,
            col5: undefined,
          },
        ],
      },
    ];
    const preparedEo = withSfggIngenForEmployments(eo);
    const multiSelected = {
      opgoerelse: true,
      loenindkomst: true,
      offentligeYdelser: false,
      shDage: true,
      regulering: false,
      okSatser: false,
      sygeferiegodtgoerelse: false,
      midlertidigEet: false,
    };

    const { documentXml } = await renderWordDocument(() => {
      generateErstatningsopgoerelseDocument(stamdata, preparedEo, multiSelected, {
        visUdkastStempel: false,
        document: buildProjectedDocument(stamdata, preparedEo),
      });
    });

    const text = xmlToPlainText(documentXml);
    expect(text).toContain('Lønindkomst');
    expect(text).toContain('SH-dage');
  });
});
