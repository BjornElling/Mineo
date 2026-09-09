// @vitest-environment jsdom
/// <reference types="vitest/globals" />
import { generateDifferencekravDocument } from '../../../document/generators/differencekrav/differencekravDocument';
import type { EetDifferencekravComputation } from '../../../domain/erhvervsevnetab/eetDifferencekravCalculation';
import { toISODateString } from '../../../types/branded';
import { renderWordDocument, xmlToPlainText } from './wordContentHarness';
import { fromKroner } from '../../../domain/money/money';

// Word-indholdstest for differencekrav: kører den RIGTIGE generator gennem
// Word-backenden med et realistisk computation-fixture (mineret fra
// differencekravPdf.test.ts) og verificerer, at titel og afgørelsesindhold
// faktisk når .docx'en.
describe('differencekrav → Word-indhold', () => {
  it('skriver titel og midlertidig-afgørelse-indhold til .docx', async () => {
    const { filename, documentXml } = await renderWordDocument((session) => {
      return generateDifferencekravDocument(session, {
        computation: {
          beregningsdato: toISODateString('2026-03-17'),
          skadedato: toISODateString('2011-06-16'),
          dagFoerBeregningsdato: toISODateString('2026-03-16'),
          fradragGaelderForFoer2011: false,
          ealKravOre: fromKroner(100000),
          ealEetPct: 15,
          fradragLoebendeYdelserOre: fromKroner(0),
          fradragKapitaliseretEetOre: fromKroner(0),
          proformaKapitalisering: null,
          resterendeLoebendeYdelser: null,
          merErstatningPensionsalder: null,
          differencekravFoerForligOre: fromKroner(100000),
          forligFactor: null,
          forligLabel: null,
          forligDato: null,
          differencekravOre: fromKroner(100000),
          afgoerelser: [{
            rowId: 'afg-1',
            afgoerelsesdato: toISODateString('2020-01-01'),
            virkningsdato: toISODateString('2020-02-01'),
            afgoerelseType: 'Midlertidig',
            eetPct: 15,
            fradragesTil: toISODateString('2020-02-01'),
            beloebOre: fromKroner(0),
            fradragForetages: false,
            tilbagevirkendeKraftFradrag: null,
          }],
          kapitaliseringerAfgoerelser: [],
          loebendeComputation: null,
          kapComputation: null,
          ealComputation: null,
        } satisfies EetDifferencekravComputation,
        bilagSelection: {
          opgoerelse: true,
          loebendeYdelser: false,
          kapitalisering: false,
          eetEfterEal: false,
          proformaKapitalisering: false,
          merErstatningPensionsalder: false,
          visUdvidetSpecifikationLoebendeYdelserBilag: false,
        },
      });
    });

    const text = xmlToPlainText(documentXml);
    expect(filename).toMatch(/\.docx$/);
    expect(text).toContain('Differencekrav (EET)');
    expect(text).toContain('Midlertidig afgørelse');
    expect(text).toContain('Skaden er indtrådt den 16. juni 2011 eller senere.');
    // Konkret beløb på en udfyldt sti: det beregnede differencekrav skal nå .docx'en.
    expect(text).toContain('100.000 kr.');
  });

  /**
   * BB-182: EAL-bilaget kaldes med `includeBeregningsdatoHeader = false`, som fjerner hele
   * «Beregning»-sektionen fra kroppen. Skadedatoen ligger derfor i Specifikationen og ikke i
   * headeren – ellers ville netop bilaget mangle den forudsætning, både opreguleringen og
   * aldersreduktionen hviler på, og differencekravets egen krop skriver den ikke.
   */
  it('bærer skadedatoen med i EAL-bilaget, hvor «Beregning»-sektionen er udeladt', async () => {
    const { documentXml } = await renderWordDocument((session) => {
      return generateDifferencekravDocument(session, {
        computation: {
          beregningsdato: toISODateString('2026-03-17'),
          skadedato: toISODateString('2018-06-01'),
          dagFoerBeregningsdato: toISODateString('2026-03-16'),
          fradragGaelderForFoer2011: false,
          ealKravOre: fromKroner(2137500),
          ealEetPct: 50,
          fradragLoebendeYdelserOre: fromKroner(0),
          fradragKapitaliseretEetOre: fromKroner(0),
          proformaKapitalisering: null,
          resterendeLoebendeYdelser: null,
          merErstatningPensionsalder: null,
          differencekravFoerForligOre: fromKroner(2137500),
          forligFactor: null,
          forligLabel: null,
          forligDato: null,
          differencekravOre: fromKroner(2137500),
          afgoerelser: [],
          kapitaliseringerAfgoerelser: [],
          loebendeComputation: null,
          kapComputation: null,
          ealComputation: {
            beregningsdato: toISODateString('2026-03-17'),
            skadedato: toISODateString('2018-06-01'),
            fodselsdato: toISODateString('1980-01-01'),
            skadesaar: 2018,
            beregningsaar: 2026,
            aarsloenOre: fromKroner(400000),
            aarsloenSource: 'asl',
            reguleringsaar: [2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026],
            reguleringsPctRounded4: 12.5,
            reguleretAarsloenOre: fromKroner(450000),
            eetPct: 50,
            eetPctSource: 'asl',
            kapitaliseringsfaktor: 10,
            eetBeregnetOre: fromKroner(2250000),
            eetMaksOre: fromKroner(9999999),
            eetAnvendtOre: fromKroner(2250000),
            eetReduceretTilMaks: false,
            alderVedSkade: 38,
            alderVedSkadeCapped: 38,
            aldersreduktionPct: 5,
            aldersreduktionBeloebOre: fromKroner(112500),
            ealKravOre: fromKroner(2137500),
            forlig: null,
          },
        } satisfies EetDifferencekravComputation,
        bilagSelection: {
          opgoerelse: true,
          loebendeYdelser: false,
          kapitalisering: false,
          eetEfterEal: true,
          proformaKapitalisering: false,
          merErstatningPensionsalder: false,
          visUdvidetSpecifikationLoebendeYdelserBilag: false,
        },
      });
    });

    const text = xmlToPlainText(documentXml);
    expect(text).toContain('EET efter EAL');
    // Bilaget har ingen «Beregning»-sektion – men skadedatoen er der.
    expect(text).toContain('Skadedato');
    expect(text).toContain('01-06-2018');
    // BB-177: adjektivet må ikke være tilbage i bilaget heller.
    expect(text).not.toContain('Endeligt erhvervsevnetab');
  });

  /**
   * Mer-erstatningen ved forhøjet folkepensionsalder samler fire fund i ét afsnit:
   *  - BB-190: samtlige beløb stod UDEN «kr.» – side om side med linjer, der havde enheden.
   *  - BB-191: størrelsen hed fire ting; nu ét navn, «Forhøjet pensionsalder».
   *  - BB-193: to kapitaliseringer gav to ORDRET identiske overskrifter med to forskellige beløb.
   *  - BB-201: summen stod kun på skærmen, ikke i specifikationen og bilaget.
   */
  it('trykker mer-erstatningen med enhed, ét navn, adskilte overskrifter og en sum', async () => {
    const event = (kapitaliseringspct: number, kapitaliseringsdato: string, merErstatning: number) => ({
      rowId: `row-${kapitaliseringspct}`,
      afgoerelsesdato: toISODateString('2018-12-01'),
      kapitaliseringsdato: toISODateString(kapitaliseringsdato),
      kapitaliseringspct,
      forhoejelsesdato: toISODateString('2020-12-31'),
      satsAar: 2021,
      gammelAlderLabel: '68 år',
      nyAlderLabel: '69 år',
      alderAar: 52,
      alderMaaneder: 5,
      faktorMaanedsAfhaengig: true,
      koenOpdelt: false,
      grundloenOre: fromKroner(278558),
      erstatningsniveauPct: 83 as const,
      amBidragPct: 8 as const,
      grundydelseOre: fromKroner(31906.03),
      grundydelse2024Ore: null,
      opreguleringTil2024PctRounded4: null,
      aarsydelseGrundlagOre: fromKroner(31906.03),
      aarsydelseReguleringsPctRounded4: 53.6,
      aarsydelseOre: fromKroner(49007.66),
      gammel: {
        kapitaliseringsbekendtgoerelseLabel: 'Vejl. 9921/2019, tabel A',
        folkepensionsalderLabel: '68 år',
        kapitaliseringsfaktor: 10.157,
        kapitalvaerdiOre: fromKroner(497770.8),
      },
      ny: {
        kapitaliseringsbekendtgoerelseLabel: 'Vejl. 9870/2020, tabel A',
        folkepensionsalderLabel: '69 år',
        kapitaliseringsfaktor: 10.689,
        kapitalvaerdiOre: fromKroner(523842.88),
      },
      merErstatningOre: fromKroner(merErstatning),
    });

    const merErstatningPensionsalder = {
      events: [event(15, '2019-01-01', 26072), event(25, '2020-06-01', 43453)],
      samletMerErstatningOre: fromKroner(69525),
    } as EetDifferencekravComputation['merErstatningPensionsalder'];

    const { documentXml } = await renderWordDocument((session) => {
      return generateDifferencekravDocument(session, {
        computation: {
          beregningsdato: toISODateString('2022-06-01'),
          skadedato: toISODateString('2018-06-01'),
          dagFoerBeregningsdato: toISODateString('2022-05-31'),
          fradragGaelderForFoer2011: false,
          ealKravOre: fromKroner(3940650),
          ealEetPct: 50,
          fradragLoebendeYdelserOre: fromKroner(122936),
          fradragKapitaliseretEetOre: fromKroner(516226),
          proformaKapitalisering: null,
          resterendeLoebendeYdelser: null,
          merErstatningPensionsalder,
          differencekravFoerForligOre: fromKroner(2064024),
          forligFactor: null,
          forligLabel: null,
          forligDato: null,
          differencekravOre: fromKroner(2064024),
          afgoerelser: [],
          kapitaliseringerAfgoerelser: [],
          loebendeComputation: null,
          kapComputation: null,
          ealComputation: null,
        } satisfies EetDifferencekravComputation,
        bilagSelection: {
          opgoerelse: true,
          loebendeYdelser: false,
          kapitalisering: false,
          eetEfterEal: false,
          proformaKapitalisering: false,
          merErstatningPensionsalder: true,
          visUdvidetSpecifikationLoebendeYdelserBilag: false,
        },
      });
    });

    const text = xmlToPlainText(documentXml);

    // BB-191: ét navn – både specifikationens underoverskrift og bilagets titel.
    expect(text).toContain('Forhøjet pensionsalder');
    expect(text).not.toContain('Mer-erstatning forhøjet folkepension');

    // BB-193: de to fradragslinjer kan skelnes, fordi overskriften bærer kapitaliseringen.
    expect(text).toContain('Forhøjelse pr. 31-12-2020 (68 år → 69 år) · kapitaliseret (15 %) den 01-01-2019');
    expect(text).toContain('Forhøjelse pr. 31-12-2020 (68 år → 69 år) · kapitaliseret (25 %) den 01-06-2020');

    // BB-201: summen står i BÅDE specifikationen og bilaget.
    expect(text.match(/Samlet mer-erstatning/g)?.length).toBe(2);
    expect(text).toContain('69.525 kr.');

    // BB-194: faktoropslagets forudsætninger er navngivet.
    expect(text).toContain('Alder ved forhøjelsen');
    expect(text).toContain('52 år, 5 måneder');
    expect(text).toContain('Kapitaliseringsbekendtgørelse');
    expect(text).toContain('Kapitaliseringsfaktor');

    // BB-190: hvert beløb i afsnittet bærer enheden. Uden rettelsen stod fx «31.906,03» og
    // «497.770,80» bart, mens nabolinjerne havde «kr.».
    expect(text).toContain('31.906,03 kr.');
    expect(text).toContain('497.770,80 kr.');
    expect(text).toContain('523.842,88 kr.');
    expect(text).toContain('26.072 kr.');
    expect(text).not.toMatch(/=\s*31\.906,03(?!\s*kr\.)/);
  });

  /**
   * Forliget optræder ÉN gang i differencekravdokumentet: på forsidens bundlinje, hvor det anvendes på
   * beløbet efter alle fire ASL-fradrag. EAL-bilaget er differencekravets GRUNDLAG og viser derfor det
   * ureducerede krav – med én linje, der siger hvorfor. Et reduceret bilag ved siden af en reduceret
   * bundlinje ville se ud, som om forliget var indregnet to gange.
   */
  it('viser EAL-bilaget ureduceret med en forklarende linje, når forsiden bærer et forlig', async () => {
    const { documentXml } = await renderWordDocument((session) => {
      return generateDifferencekravDocument(session, {
        computation: {
          beregningsdato: toISODateString('2026-03-17'),
          skadedato: toISODateString('2018-06-01'),
          dagFoerBeregningsdato: toISODateString('2026-03-16'),
          fradragGaelderForFoer2011: false,
          ealKravOre: fromKroner(2137500),
          ealEetPct: 50,
          fradragLoebendeYdelserOre: fromKroner(137500),
          fradragKapitaliseretEetOre: fromKroner(0),
          proformaKapitalisering: null,
          resterendeLoebendeYdelser: null,
          merErstatningPensionsalder: null,
          differencekravFoerForligOre: fromKroner(2000000),
          forligFactor: 0.5,
          forligLabel: '50 %',
          forligDato: toISODateString('2022-05-01'),
          differencekravOre: fromKroner(1000000),
          afgoerelser: [],
          kapitaliseringerAfgoerelser: [],
          loebendeComputation: null,
          kapComputation: null,
          ealComputation: {
            beregningsdato: toISODateString('2026-03-17'),
            skadedato: toISODateString('2018-06-01'),
            fodselsdato: toISODateString('1980-01-01'),
            skadesaar: 2018,
            beregningsaar: 2026,
            aarsloenOre: fromKroner(400000),
            aarsloenSource: 'asl',
            reguleringsaar: [2019, 2020],
            reguleringsPctRounded4: 12.5,
            reguleretAarsloenOre: fromKroner(450000),
            eetPct: 50,
            eetPctSource: 'asl',
            kapitaliseringsfaktor: 10,
            eetBeregnetOre: fromKroner(2250000),
            eetMaksOre: fromKroner(9999999),
            eetAnvendtOre: fromKroner(2250000),
            eetReduceretTilMaks: false,
            alderVedSkade: 38,
            alderVedSkadeCapped: 38,
            aldersreduktionPct: 5,
            aldersreduktionBeloebOre: fromKroner(112500),
            ealKravOre: fromKroner(2137500),
            // Grafen sender ALTID `forlig: null` til differencekravets EAL-beregning.
            forlig: null,
          },
        } satisfies EetDifferencekravComputation,
        bilagSelection: {
          opgoerelse: true,
          loebendeYdelser: false,
          kapitalisering: false,
          eetEfterEal: true,
          proformaKapitalisering: false,
          merErstatningPensionsalder: false,
          visUdvidetSpecifikationLoebendeYdelserBilag: false,
        },
      });
    });

    const text = xmlToPlainText(documentXml);
    // Forsiden: forliget anvendt på beløbet efter fradrag.
    expect(text).toContain('Der er den 1. maj 2022 indgået forlig i sagen på betaling af 50 %.');
    expect(text).toContain('Beregnet differencekrav (50 % af 2.000.000 kr.)');
    expect(text).toContain('1.000.000 kr.');
    // Bilaget: det ureducerede krav plus forklaringen.
    expect(text).toContain('2.250.000 kr. - 112.500 kr. =');
    expect(text).toContain('2.137.500 kr.');
    expect(text).toContain('Forliget om ansvarsgrad er ikke indregnet i dette bilag');
    // Bilaget må ikke bære sin egen forligsreduktion.
    expect(text).not.toContain('50 % x (2.250.000 kr. - 112.500 kr.) =');
  });
});
