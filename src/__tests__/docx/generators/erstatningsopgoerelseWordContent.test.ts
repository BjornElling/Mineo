// @vitest-environment jsdom
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

    const { filename, documentXml } = await renderWordDocument((session) => {
      return generateErstatningsopgoerelseDocument(session, stamdata, eo, selected, {
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

    const { filename, zip } = await renderWordDocument((session) => {
      return generateErstatningsopgoerelseDocument(session, stamdata, eo, selected, {
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

    const { filename, zip } = await renderWordDocument((session) => {
      return generateErstatningsopgoerelseDocument(session, stamdata, eo, selected, {
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

    const { documentXml } = await renderWordDocument((session) => {
      return generateErstatningsopgoerelseDocument(session, stamdata, preparedEo, multiSelected, {
        visUdkastStempel: false,
        document: buildProjectedDocument(stamdata, preparedEo),
      });
    });

    const text = xmlToPlainText(documentXml);
    expect(text).toContain('Lønindkomst');
    expect(text).toContain('SH-dage');
  });

  // Regression: ved angivet løn er loenudvikling.perAnsaettelse tom (hele forløbet ligger i de
  // globale segmenter), så regulering-sektionens per-ansættelse-opslag fandt intet og
  // "Beregnet regulering"-tabellen blev tom ("Ingen reguleringsrækker i perioden."), selvom
  // reguleringsforløbet var korrekt beregnet og vist under Forventet indkomst. Reproduceres her
  // med ASL-årslønsmaksimum (det spor brugeren observerede), men fejlen ramte alle
  // reguleringsformer under angivet løn.
  it('genererer Beregnet regulering-tabellen for angivet løn med ASL-årslønsmaksimum', async () => {
    const stamdata: StamdataValues = {
      ...structuredClone(STAMDATA_INITIAL_VALUES),
      skadestype: 'Arbejdsulykke',
      skadedato: toISODateString('2022-05-31'),
    };
    const eo = createErstatningsopgoerelseInitialValues();
    eo.kravPaaTabtArbejdsfortjeneste = 'Ja';
    eo.beregnesUdFra = 'Angivet månedsløn';
    eo.maanedsloenenUdgoer = asAmountValue(41593.87);
    eo.eoAngivetLoenLoenudvikling.loenudviklingBeregningsgrundlag = 'Statistik';
    eo.eoAngivetLoenLoenudvikling.loenudviklingStatistikModel = 'ASL-årslønsmaksimum';
    eo.vedroererPeriodeFra = toISODateString('2022-06-01');
    eo.vedroererPeriodeTil = toISODateString('2025-06-30');
    eo.tafBeregningsperiodeFra = toISODateString('2022-06-01');
    eo.tafBeregningsperiodeTil = toISODateString('2025-06-30');
    eo.tafPerioder = [{ id: 'taf-1', fra: toISODateString('2022-06-01'), til: toISODateString('2025-06-30'), loseFeriedage: undefined }];

    const preparedEo = withSfggIngenForEmployments(eo);
    const reguleringSelected = {
      opgoerelse: true,
      loenindkomst: false,
      offentligeYdelser: false,
      shDage: false,
      regulering: true,
      okSatser: false,
      sygeferiegodtgoerelse: false,
      midlertidigEet: false,
    };

    const { documentXml } = await renderWordDocument((session) => {
      return generateErstatningsopgoerelseDocument(session, stamdata, preparedEo, reguleringSelected, {
        visUdkastStempel: false,
        document: buildProjectedDocument(stamdata, preparedEo),
      });
    });

    const text = xmlToPlainText(documentXml);
    expect(text).toContain('Beregnet regulering');
    expect(text).not.toContain('Ingen reguleringsrækker i perioden.');
    // Lønudviklingen mellem ASL-maks 2022 (570.000) og 2023 (588.000) er +3,16 %.
    expect(text).toContain('3,16');
  });

  // Ende-til-ende-paritet (led 3, punkt 14): binder KL-lønaftaler-formen fra input → snapshot/model
  // → færdigt Word-produkt, og bekræfter at den kæde-opregulerede løn (segmentets autoritative
  // reguleretLoenOre) når IDENTISK ud i BÅDE Forventet indkomst-linjen (opgoerelse-sektionen) OG
  // Beregnet regulering-tabellen (regulering-bilaget). Begge forbrugere læser nu samme kilde (U8),
  // så et tabt/forvansket nedstrøms-led ville få mindst én af værdierne til at forsvinde.
  it('KL-lønaftaler: reguleret løn er identisk i Forventet indkomst og Beregnet regulering (paritet)', async () => {
    const stamdata: StamdataValues = {
      ...structuredClone(STAMDATA_INITIAL_VALUES),
      skadestype: 'Arbejdsulykke',
      skadedato: toISODateString('2024-04-01'),
    };
    const eo = createErstatningsopgoerelseInitialValues();
    eo.kravPaaTabtArbejdsfortjeneste = 'Ja';
    eo.beregnesUdFra = 'Angivet månedsløn';
    eo.maanedsloenenUdgoer = asAmountValue(30000);
    eo.angivetMaanedsloenOpreguleresFraDato = toISODateString('2024-04-01');
    eo.eoAngivetLoenLoenudvikling.loenudviklingBeregningsgrundlag = 'KL-lønaftaler';
    eo.vedroererPeriodeFra = toISODateString('2024-04-01');
    eo.vedroererPeriodeTil = toISODateString('2026-03-31');
    eo.tafBeregningsperiodeFra = toISODateString('2024-04-01');
    eo.tafBeregningsperiodeTil = toISODateString('2026-03-31');
    eo.tafPerioder = [{ id: 'taf-1', fra: toISODateString('2024-04-01'), til: toISODateString('2026-03-31'), loseFeriedage: undefined }];

    const preparedEo = withSfggIngenForEmployments(eo);
    const klSelected = {
      opgoerelse: true,
      loenindkomst: false,
      offentligeYdelser: false,
      shDage: false,
      regulering: true,
      okSatser: false,
      sygeferiegodtgoerelse: false,
      midlertidigEet: false,
    };

    const { documentXml } = await renderWordDocument((session) => {
      return generateErstatningsopgoerelseDocument(session, stamdata, preparedEo, klSelected, {
        visUdkastStempel: false,
        document: buildProjectedDocument(stamdata, preparedEo),
      });
    });

    const text = xmlToPlainText(documentXml);
    // KL-lønaftaler-grenen er nået i Beregnet regulering-tabellen (særlig visning: reguleret løn, ingen indeks).
    expect(text).toContain('Beregnet regulering');
    expect(text).toContain('Reguleret månedsløn');
    expect(text).not.toContain('Ingen reguleringsrækker i perioden.');

    // Den kæde-opregulerede, afrundede månedsløn (base 30.000 fra 01-04-2024):
    //   01-10-2024 (+1,30 %) → 30.390,00 ; 01-11-2025 (+0,75 %) → 30.709,78.
    // Værdierne skal optræde i BÅDE Forventet indkomst-linjen og Beregnet regulering-tabellen –
    // dvs. mindst to forekomster hver, hvilket beviser at ingen af de to nedstrøms-led taber værdien.
    const countOccurrences = (needle: string): number => text.split(needle).length - 1;
    expect(countOccurrences('30.390,00')).toBeGreaterThanOrEqual(2);
    expect(countOccurrences('30.709,78')).toBeGreaterThanOrEqual(2);
  });
});
