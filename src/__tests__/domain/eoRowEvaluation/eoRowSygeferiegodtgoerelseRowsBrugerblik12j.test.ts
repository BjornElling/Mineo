import { buildEoSygeferiegodtgoerelseRows } from '../../../domain/eoRowEvaluation/eoRowSygeferiegodtgoerelseRows';
import { computeEoSnapshot } from '../../../domain/erstatningsopgoerelse/snapshot/eoSnapshot';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { collectSfggReferenceperiodeIssues } from '../../../domain/erstatningsopgoerelse/sfggReferenceperiodeRules';
import { STAMDATA_INITIAL_VALUES } from '../../../domain/stamdata/stamdataInitialValues';
import type { FieldIssue } from '../../../inputCore/inputIssue';
import { toAnyFieldRef } from '../../../inputCore/fieldDescriptor';
import {
  eoSfggManuelFoerstEfterSygeloenField,
  eoSfggReferenceperiodeFraField,
  eoSfggReferenceperiodeFravaersdageUdenLoenField,
  eoSfggReferenceperiodeTilField,
} from '../../../inputCore/catalog/erstatningsopgoerelseDescriptors';
import { eoEmploymentFields } from '../../../inputCore/catalog/erstatningsopgoerelseLoenDescriptors';
import type { ErstatningsopgoerelseValues, StandardLoenTableRow, StamdataValues } from '../../../schemas/formSchemas';
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

/** Grundsag som i 12j: skade 01-03-2023, TAF og EO-periode 01-03-2023 – 31-05-2023. */
const baseValues = (): ErstatningsopgoerelseValues => {
  const values = createErstatningsopgoerelseInitialValues();
  values.kravPaaTabtArbejdsfortjeneste = 'Ja';
  values.beregnesUdFra = 'Angivet månedsløn';
  values.maanedsloenenUdgoer = asAmount(30000);
  values.eoAngivetLoenLoenudvikling.loenudviklingBeregningsgrundlag = 'Ingen';
  values.vedroererPeriodeFra = iso('2023-03-01');
  values.vedroererPeriodeTil = iso('2023-05-31');
  values.tafPerioder = [{ id: 'taf-1', fra: iso('2023-03-01'), til: iso('2023-05-31'), loseFeriedage: undefined }];
  values.loenindkomstAnsaettelsesforhold = [createSfggEmployment({
    feriePct: 12.5,
    indtaegtsoplysningerTableData: [loenRaekke('2', '2023', 30000)],
  })];
  values.sfggAnsaettelsesforhold = [{
    ...createSfggIngenRow('af-1'),
    sfggBeregningskilde: 'Ferieloven',
    sfggReferenceperiodeFra: iso('2023-02-01'),
    sfggReferenceperiodeTil: iso('2023-02-28'),
  }];
  return values;
};

const STAMDATA: StamdataValues = {
  ...STAMDATA_INITIAL_VALUES,
  skadestype: 'Arbejdsulykke',
  skadedato: iso('2023-03-01'),
};

const buildRows = (
  values: ErstatningsopgoerelseValues,
  options: Readonly<{ stamdata?: StamdataValues; fieldIssues?: Readonly<Record<string, readonly FieldIssue[]>> }> = {},
) => {
  const stamdata = options.stamdata ?? STAMDATA;
  const snapshot = computeEoSnapshot({
    revision: 'test-sfgg-12j',
    stamdataValues: stamdata,
    eoValues: structuredClone(values),
  });
  return buildEoSygeferiegodtgoerelseRows(
    values,
    stamdata,
    snapshot.data?.canonicalOutput,
    snapshot.data?.pdfModel,
    options.fieldIssues ?? {},
  );
};

describe('buildEoSygeferiegodtgoerelseRows – brugerblik 12j', () => {
  describe('afsnittets røde felter (BB-322, BB-323)', () => {
    it('folder kun BB-322-grænsereglen, hvor begge datoer har samme besked', () => {
      const values = baseValues();
      values.sfggAnsaettelsesforhold[0] = {
        ...values.sfggAnsaettelsesforhold[0]!,
        sfggReferenceperiodeFra: iso('2023-03-01'),
        sfggReferenceperiodeTil: iso('2023-03-28'),
      };
      const issues = collectSfggReferenceperiodeIssues(values);
      expect(issues).toHaveLength(2);

      const feltRows = buildRows(values, { fieldIssues: { 'af-1': issues } })
        .filter((row) => row.id.startsWith('sfgg.felt.'));

      expect(feltRows).toHaveLength(2);
      expect(feltRows.map((row) => row.summaryDeduplicationGroup)).toEqual([
        'sfgg-referenceperiode-taf-boundary:af-1',
        'sfgg-referenceperiode-taf-boundary:af-1',
      ]);
      expect(feltRows.map((row) => row.focusTarget)).toEqual([
        { kind: 'fieldAddress', address: eoSfggReferenceperiodeFraField.bind('af-1').address },
        { kind: 'fieldAddress', address: eoSfggReferenceperiodeTilField.bind('af-1').address },
      ]);
      expect(feltRows.every((row) => row.message === 'Datoen skal ligge før første TAF-periode (01-03-2023)')).toBe(true);
    });

    it('mærker en alene ugyldig Til-dato som Til og lader den stå alene', () => {
      const values = baseValues();
      values.sfggAnsaettelsesforhold[0] = {
        ...values.sfggAnsaettelsesforhold[0]!,
        sfggReferenceperiodeFra: iso('2023-02-01'),
        sfggReferenceperiodeTil: iso('2023-03-01'),
      };
      const issue = collectSfggReferenceperiodeIssues(values);
      expect(issue).toHaveLength(1);
      expect(issue[0]?.field.descriptor.id).toBe(eoSfggReferenceperiodeTilField.id);

      const row = buildRows(values, { fieldIssues: { 'af-1': issue } })
        .find((entry) => entry.id === 'sfgg.felt.sfggReferenceperiodeTil.af-1');

      expect(row).toEqual(expect.objectContaining({
        label: eoSfggReferenceperiodeTilField.label,
        focusTarget: { kind: 'fieldAddress', address: eoSfggReferenceperiodeTilField.bind('af-1').address },
      }));
      expect(row?.summaryText).toBeUndefined();
      expect(row?.summaryDeduplicationGroup).toBeUndefined();
    });

    it('folder ikke samme TAF-grænsefejl på tværs af ansættelsesforhold', () => {
      const values = baseValues();
      values.sfggAnsaettelsesforhold[0] = {
        ...values.sfggAnsaettelsesforhold[0]!,
        sfggReferenceperiodeFra: iso('2023-03-01'),
        sfggReferenceperiodeTil: iso('2023-03-28'),
      };
      values.loenindkomstAnsaettelsesforhold = [
        ...values.loenindkomstAnsaettelsesforhold,
        createSfggEmployment({ id: 'af-2', feriePct: 12.5 }),
      ];
      values.sfggAnsaettelsesforhold = [
        ...values.sfggAnsaettelsesforhold,
        {
          ...createSfggIngenRow('af-2'),
          sfggBeregningskilde: 'Ferieloven',
          sfggReferenceperiodeFra: iso('2023-03-01'),
          sfggReferenceperiodeTil: iso('2023-03-28'),
        },
      ];
      const issues = collectSfggReferenceperiodeIssues(values);
      const fieldIssues = Object.fromEntries(
        ['af-1', 'af-2'].map((id) => [id, issues.filter((issue) => issue.field.address.path.some(
          (segment) => segment.kind === 'entity' && segment.entityId === id
        ))])
      );

      const fieldRows = buildRows(values, { fieldIssues })
        .filter((row) => row.id.startsWith('sfgg.felt.'));

      expect(fieldRows.map((row) => row.summaryDeduplicationGroup)).toEqual([
        'sfgg-referenceperiode-taf-boundary:af-1',
        'sfgg-referenceperiode-taf-boundary:af-1',
        'sfgg-referenceperiode-taf-boundary:af-2',
        'sfgg-referenceperiode-taf-boundary:af-2',
      ]);
    });

    it('bevarer en linje pr. felt ved ens almindelige datogrænsebeskeder', () => {
      const fraIssue = collectSfggReferenceperiodeIssues({
        ...baseValues(),
        sfggAnsaettelsesforhold: [{
          ...baseValues().sfggAnsaettelsesforhold[0]!,
          sfggReferenceperiodeFra: iso('2023-03-01'),
        }],
      })[0]!;
      const tilIssue: FieldIssue = {
        ...fraIssue,
        code: `${eoSfggReferenceperiodeTilField.id}.bounds`,
        field: toAnyFieldRef(eoSfggReferenceperiodeTilField.bind('af-1')),
        reason: 'bounds',
        message: 'Dato skal være mellem 01-01-2005 og 31-12-2027',
      };
      const sameMessageFraIssue: FieldIssue = {
        ...fraIssue,
        code: `${eoSfggReferenceperiodeFraField.id}.bounds`,
        reason: 'bounds',
        message: tilIssue.message,
      };

      const feltRows = buildRows(baseValues(), {
        fieldIssues: { 'af-1': [sameMessageFraIssue, tilIssue] },
      }).filter((row) => row.id.startsWith('sfgg.felt.'));

      expect(feltRows).toHaveLength(2);
      expect(feltRows.map((row) => row.summaryDeduplicationGroup)).toEqual([undefined, undefined]);
      expect(feltRows.map((row) => row.focusTarget)).toEqual([
        { kind: 'fieldAddress', address: eoSfggReferenceperiodeFraField.bind('af-1').address },
        { kind: 'fieldAddress', address: eoSfggReferenceperiodeTilField.bind('af-1').address },
      ]);
    });

    it('giver en linje pr. felt med hver sin besked', () => {
      const values = baseValues();
      const fraIssue = collectSfggReferenceperiodeIssues({
        ...values,
        sfggAnsaettelsesforhold: [{ ...values.sfggAnsaettelsesforhold[0]!, sfggReferenceperiodeFra: iso('2023-03-01') }],
      })[0]!;
      const fravaerIssue = collectSfggReferenceperiodeIssues({
        ...values,
        sfggAnsaettelsesforhold: [{ ...values.sfggAnsaettelsesforhold[0]!, sfggReferenceperiodeFravaersdageUdenLoen: 28 }],
      })[0]!;

      const feltRows = buildRows(values, { fieldIssues: { 'af-1': [fraIssue, fravaerIssue] } })
        .filter((row) => row.id.startsWith('sfgg.felt.'));

      expect(feltRows.map((row) => row.focusTarget)).toEqual([
        { kind: 'fieldAddress', address: eoSfggReferenceperiodeFraField.bind('af-1').address },
        { kind: 'fieldAddress', address: eoSfggReferenceperiodeFravaersdageUdenLoenField.bind('af-1').address },
      ]);
      expect(feltRows[1]?.message).toBe('Højst 27 fraværsdage – referenceperioden har 28 kalenderdage');
    });
  });

  it('advarer gult om en referenceperiode over 12 måneder før reguleringsdatoen (BB-324)', () => {
    const values = baseValues();
    values.beregnesUdFra = 'Beregningsperiode';
    values.tafBeregningsperiodeFra = iso('2022-03-01');
    values.tafBeregningsperiodeTil = iso('2023-02-28');
    values.loenindkomstAnsaettelsesforhold[0] = {
      ...values.loenindkomstAnsaettelsesforhold[0]!,
      loenudviklingBeregningsgrundlag: 'Manuel procentsats',
      indtaegtsoplysningerTableData: [loenRaekke('1', '2022', 30000)],
    };
    values.sfggAnsaettelsesforhold[0] = {
      ...values.sfggAnsaettelsesforhold[0]!,
      sfggReferenceperiodeFra: iso('2022-01-01'),
      sfggReferenceperiodeTil: iso('2022-01-28'),
    };

    const row = buildRows(values).find((entry) => entry.id === 'sfgg.advarsel.gammelReferenceperiode.af-1');

    expect(row).toEqual(expect.objectContaining({
      status: 'warning',
      message: 'Referenceperioden slutter mere end 12 måneder før reguleringsdatoen (28-02-2023) – satsen er regnet med lønnen på reguleringsdatoen uden regulering',
      focusTarget: { kind: 'fieldAddress', address: eoSfggReferenceperiodeTilField.bind('af-1').address },
    }));
  });

  describe('«Først … efter ophør af sygeløn» uden lønrækker (BB-326)', () => {
    const manuel = (loen: readonly StandardLoenTableRow[]) => {
      const values = baseValues();
      values.loenindkomstAnsaettelsesforhold[0] = {
        ...values.loenindkomstAnsaettelsesforhold[0]!,
        indtaegtsoplysningerTableData: [...loen],
      };
      values.sfggAnsaettelsesforhold[0] = {
        ...createSfggIngenRow('af-1'),
        sfggBeregningskilde: 'Manuelt angivet',
        sfggManuelDagssats: asAmount(250),
        sfggManuelFoerstEfterSygeloen: 'Ja',
      };
      return buildRows(values).find((row) => row.id === 'sfgg.advarsel.sygeloenUdenLoenraekker.af-1');
    };

    it('advarer med link til valget, når der ingen lønrækker er i erstatningsperioden', () => {
      expect(manuel([loenRaekke('2', '2023', 30000)])).toEqual(expect.objectContaining({
        status: 'warning',
        message: 'Der er ikke registreret sygeløn i erstatningsperioden – angiv sygelønnen som lønrækker, ellers beregnes sygeferiegodtgørelse for hele perioden',
        focusTarget: { kind: 'fieldAddress', address: eoSfggManuelFoerstEfterSygeloenField.bind('af-1').address },
      }));
    });

    it('advarer ikke, når sygelønnen står som lønrækker', () => {
      expect(manuel([loenRaekke('2', '2023', 30000), loenRaekke('3', '2023', 30000)])).toBeUndefined();
    });
  });

  describe('«Overenskomst» uden overenskomst (BB-330)', () => {
    const overenskomstRow = (harOverenskomst: boolean) => {
      const values = baseValues();
      values.loenindkomstAnsaettelsesforhold[0] = {
        ...values.loenindkomstAnsaettelsesforhold[0]!,
        harOverenskomst,
        overenskomstId: undefined,
      };
      values.sfggAnsaettelsesforhold[0] = { ...values.sfggAnsaettelsesforhold[0]!, sfggBeregningskilde: 'Overenskomst' };
      return buildRows(values).find((row) => row.id === 'sfgg.overenskomst.af-1');
    };

    it('peger på togglen «Overenskomst», når den er slået fra', () => {
      expect(overenskomstRow(false)).toEqual(expect.objectContaining({
        status: 'error',
        summaryText: "Sygeferiegodtgørelse beregnes ud fra overenskomst, men ansættelsesforholdet har ingen overenskomst – slå 'Overenskomst' til, eller vælg 'Ferieloven'",
        focusTarget: { kind: 'fieldAddress', address: eoEmploymentFields.harOverenskomst.bind('af-1').address },
      }));
    });

    it('peger på «Vælg overenskomst», når togglen er slået til uden valg', () => {
      expect(overenskomstRow(true)).toEqual(expect.objectContaining({
        status: 'error',
        summaryText: "Sygeferiegodtgørelse beregnes ud fra overenskomst, men der er ikke valgt en overenskomst – vælg en under 'Vælg overenskomst', eller vælg 'Ferieloven'",
        focusTarget: { kind: 'fieldAddress', address: eoEmploymentFields.overenskomstId.bind('af-1').address },
      }));
    });
  });

  it('spærrer ikke en manuel dagssats, når 4-månedersgrænsen er nået før perioden (BB-320)', () => {
    const values = baseValues();
    values.eoNummer = '2';
    values.vedroererPeriodeFra = iso('2015-01-01');
    values.vedroererPeriodeTil = iso('2015-06-30');
    values.tafPerioder = [
      { id: 'taf-2014', fra: iso('2014-03-01'), til: iso('2014-12-31'), loseFeriedage: undefined },
      { id: 'taf-2015', fra: iso('2015-01-01'), til: iso('2015-06-30'), loseFeriedage: undefined },
    ];
    values.loenindkomstAnsaettelsesforhold[0] = {
      ...values.loenindkomstAnsaettelsesforhold[0]!,
      indtaegtsoplysningerTableData: [loenRaekke('2', '2014', 30000)],
    };
    values.sfggAnsaettelsesforhold[0] = {
      ...createSfggIngenRow('af-1'),
      sfggBeregningskilde: 'Manuelt angivet',
      sfggManuelDagssats: asAmount(250),
    };

    const rows = buildRows(values, { stamdata: { ...STAMDATA, skadedato: iso('2014-03-01') } });

    expect(rows.find((row) => row.id === 'sfgg.dagssats.af-1')).toBeUndefined();
    expect(rows.filter((row) => row.status === 'error')).toEqual([]);
    expect(rows.find((row) => row.id === 'sfgg.forklaring.af-1.1')?.displayValue).toBe('bortfaldt den 30-06-2014');
  });
});
