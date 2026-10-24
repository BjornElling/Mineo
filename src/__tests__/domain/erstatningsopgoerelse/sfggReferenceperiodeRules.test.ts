import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import {
  buildSfggReferenceperiodeUdenLoenBesked,
  collectSfggReferenceperiodeIssues,
} from '../../../domain/erstatningsopgoerelse/sfggReferenceperiodeRules';
import {
  eoSfggReferenceperiodeFraField,
  eoSfggReferenceperiodeFravaersdageUdenLoenField,
  eoSfggReferenceperiodeTilField,
} from '../../../inputCore/catalog/erstatningsopgoerelseDescriptors';
import type { ErstatningsopgoerelseValues, StandardLoenTableRow } from '../../../schemas/formSchemas';
import {
  asSfggAmount as asAmount,
  createSfggEmployment,
  createSfggIngenRow,
  sfggIso as iso,
} from '../../utils/sfggTestSupport';

const loenRaekke = (maaned: string, aar: string, beloeb: number): StandardLoenTableRow => ({
  id: `loen-${aar}-${maaned}`,
  col0_maaned: maaned,
  col1_maaned: aar,
  col0_uge: '',
  col1_uge: '',
  col0_dag: undefined,
  col1_dag: undefined,
  col2: asAmount(beloeb),
  col3: undefined,
  col4: undefined,
  col5: undefined,
});

/**
 * Grundsag: TAF fra 01-03-2023, referenceperiode februar 2023 (28 kalenderdage, 20 arbejdsdage) med løn.
 * «Angivet månedsløn» giver opgørelse i kalenderdage, «Angivet dagsløn» i arbejdsdage.
 */
const buildValues = (patch: Readonly<{
  beregnesUdFra?: ErstatningsopgoerelseValues['beregnesUdFra'];
  fra?: string;
  til?: string;
  fravaersdage?: number;
  loen?: readonly StandardLoenTableRow[];
  kilde?: ErstatningsopgoerelseValues['sfggAnsaettelsesforhold'][number]['sfggBeregningskilde'];
}> = {}): ErstatningsopgoerelseValues => {
  const values = createErstatningsopgoerelseInitialValues();
  values.kravPaaTabtArbejdsfortjeneste = 'Ja';
  values.beregnesUdFra = patch.beregnesUdFra ?? 'Angivet månedsløn';
  values.tafPerioder = [{ id: 'taf-1', fra: iso('2023-03-01'), til: iso('2023-12-31'), loseFeriedage: undefined }];
  values.loenindkomstAnsaettelsesforhold = [createSfggEmployment({
    indtaegtsoplysningerTableData: [...(patch.loen ?? [loenRaekke('2', '2023', 30000)])],
  })];
  values.sfggAnsaettelsesforhold = [{
    ...createSfggIngenRow('af-1'),
    sfggBeregningskilde: patch.kilde ?? 'Ferieloven',
    sfggReferenceperiodeFra: iso(patch.fra ?? '2023-02-01'),
    sfggReferenceperiodeTil: iso(patch.til ?? '2023-02-28'),
    sfggReferenceperiodeFravaersdageUdenLoen: patch.fravaersdage ?? 0,
  }];
  return values;
};

const summarize = (values: ErstatningsopgoerelseValues) => collectSfggReferenceperiodeIssues(values).map((issue) => ({
  field: issue.field.descriptor.id,
  message: issue.message,
}));

describe('collectSfggReferenceperiodeIssues', () => {
  it('giver ingen fejl for en gyldig referenceperiode med løn', () => {
    expect(summarize(buildValues())).toEqual([]);
  });

  describe('grænsen før første TAF-periode (BB-322)', () => {
    it('markerer kun fra-datoen, når den ligger på første TAF-dag', () => {
      const issues = collectSfggReferenceperiodeIssues(buildValues({ fra: '2023-03-01', til: '2023-03-28' }));
      expect(issues.map((issue) => issue.field.descriptor.id)).toEqual([
        eoSfggReferenceperiodeFraField.id,
        eoSfggReferenceperiodeTilField.id,
      ]);
      expect(issues[0]?.message).toBe('Datoen skal ligge før første TAF-periode (01-03-2023)');
      expect(issues[0]?.field.address).toEqual(eoSfggReferenceperiodeFraField.bind('af-1').address);
      expect(issues[0]?.severity).toBe('error');
    });

    it('markerer kun til-datoen, når kun den ligger i TAF-perioden', () => {
      expect(summarize(buildValues({ fra: '2023-02-01', til: '2023-03-05' }))).toEqual([{
        field: eoSfggReferenceperiodeTilField.id,
        message: 'Datoen skal ligge før første TAF-periode (01-03-2023)',
      }]);
    });

    it('accepterer dagen før første TAF-dag', () => {
      expect(summarize(buildValues({ fra: '2023-02-01', til: '2023-02-28' }))).toEqual([]);
    });
  });

  describe('fraværsdagenes loft (BB-323)', () => {
    it('tillader højst kalenderdagene minus én', () => {
      expect(summarize(buildValues({ fravaersdage: 27 }))).toEqual([]);
      expect(summarize(buildValues({ fravaersdage: 28 }))).toEqual([{
        field: eoSfggReferenceperiodeFravaersdageUdenLoenField.id,
        message: 'Højst 27 fraværsdage – referenceperioden har 28 kalenderdage',
      }]);
    });

    it('tillader højst arbejdsdagene minus én og tæller ikke fraværet dobbelt', () => {
      // Validatoren sammenlignede før med arbejdsdagene EFTER fraværsfradraget, så 11 af 20 blev afvist.
      expect(summarize(buildValues({ beregnesUdFra: 'Angivet dagsløn', fravaersdage: 11 }))).toEqual([]);
      expect(summarize(buildValues({ beregnesUdFra: 'Angivet dagsløn', fravaersdage: 19 }))).toEqual([]);
      expect(summarize(buildValues({ beregnesUdFra: 'Angivet dagsløn', fravaersdage: 20 }))).toEqual([{
        field: eoSfggReferenceperiodeFravaersdageUdenLoenField.id,
        message: 'Højst 19 fraværsdage – referenceperioden har 20 arbejdsdage',
      }]);
    });

    it('trækker ferie fra og siger det', () => {
      const values = buildValues({ fravaersdage: 21 });
      values.ferieperioder = [{ id: 'ferie-1', fra: iso('2023-02-01'), til: iso('2023-02-07') }];
      expect(summarize(values)).toEqual([{
        field: eoSfggReferenceperiodeFravaersdageUdenLoenField.id,
        message: 'Højst 20 fraværsdage – referenceperioden har 21 kalenderdage uden ferie',
      }]);
    });

    it('bøjer i ental', () => {
      expect(summarize(buildValues({ fra: '2023-02-27', til: '2023-02-28', fravaersdage: 2 }))).toEqual([{
        field: eoSfggReferenceperiodeFravaersdageUdenLoenField.id,
        message: 'Højst 1 fraværsdag – referenceperioden har 2 kalenderdage',
      }]);
      expect(summarize(buildValues({ fra: '2023-02-28', til: '2023-02-28', fravaersdage: 1 }))).toEqual([{
        field: eoSfggReferenceperiodeFravaersdageUdenLoenField.id,
        message: 'Der kan ikke angives fraværsdage – referenceperioden har 1 kalenderdag',
      }]);
    });
  });

  it('markerer fra-datoen, når perioden ingen arbejdsdage har', () => {
    expect(summarize(buildValues({ beregnesUdFra: 'Angivet dagsløn', fra: '2023-02-04', til: '2023-02-05' }))).toEqual([{
      field: eoSfggReferenceperiodeFraField.id,
      message: 'Referenceperioden har ingen arbejdsdage uden ferie og SH-dage',
    }]);
  });

  describe('en periode uden løn (BB-319)', () => {
    it('spærrer med periodens datoer på fra-feltet', () => {
      const issues = collectSfggReferenceperiodeIssues(buildValues({ fra: '2021-01-01', til: '2021-01-28' }));
      expect(issues).toHaveLength(1);
      expect(issues[0]?.field.address).toEqual(eoSfggReferenceperiodeFraField.bind('af-1').address);
      expect(issues[0]?.message).toBe(
        'Der er ingen løn i referenceperioden (01-01-2021 – 28-01-2021) – angiv perioden før sygeforløbet'
      );
      expect(issues[0]?.message).toBe(buildSfggReferenceperiodeUdenLoenBesked(iso('2021-01-01'), iso('2021-01-28')));
    });

    it('overlader en samlet negativ løn til motorens egen fejl (BB-290)', () => {
      expect(summarize(buildValues({ loen: [loenRaekke('2', '2023', -1000)] }))).toEqual([]);
    });
  });

  describe('relevans', () => {
    it('gælder ikke uden TAF-krav', () => {
      const values = buildValues({ fra: '2023-03-01', til: '2023-03-28' });
      values.kravPaaTabtArbejdsfortjeneste = 'Nej';
      expect(summarize(values)).toEqual([]);
    });

    it('gælder ikke ved en manuel dagssats, hvor perioden er skjult', () => {
      expect(summarize(buildValues({ kilde: 'Manuelt angivet', fra: '2023-03-01', til: '2023-03-28' }))).toEqual([]);
    });

    it('gælder ikke ved «Overenskomst» uden aktiv overenskomst, hvor perioden er skjult', () => {
      expect(summarize(buildValues({ kilde: 'Overenskomst', fra: '2023-03-01', til: '2023-03-28' }))).toEqual([]);
    });

    it('gælder ikke, når skadelidte ikke var ansat på skadestidspunktet', () => {
      const values = buildValues({ fra: '2023-03-01', til: '2023-03-28' });
      values.loenindkomstAnsaettelsesforhold = [{ ...values.loenindkomstAnsaettelsesforhold[0]!, ansatPaaSkadestidspunktet: false }];
      expect(summarize(values)).toEqual([]);
    });
  });
});
