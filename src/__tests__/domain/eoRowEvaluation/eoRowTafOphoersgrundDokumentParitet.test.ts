import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import type { ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';
import {
  createDefaultLoenindkomstAnsaettelsesforhold,
  createErstatningsopgoerelseInitialValues,
} from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { STAMDATA_INITIAL_VALUES } from '../../../domain/stamdata/stamdataInitialValues';
import { buildTabtArbejdsfortjenesteModel } from '../../../domain/erstatningsopgoerelse/snapshot/eoPresentationSectionBuilders';
import { computeEoSnapshot } from '../../../domain/erstatningsopgoerelse/snapshot/eoSnapshot';
import { vaelgTafOphoersgrund } from '../../../domain/erstatningsopgoerelse/validation/tafPeriodConstraints';
import { buildEoTaftRows } from '../../../domain/eoRowEvaluation/eoRowTaftRows';
import { EMPTY_FIELD_ISSUE_SET } from '../../../inputCore/inputIssue';
import { toISODateString, type ISODateString } from '../../../types/branded';
import { withSfggIngenForEmployments } from '../../utils/sfggTestSupport';

const asAmountValue = (value: number): AmountValue => ({ kind: 'number', value });
const iso = (value: string) => toISODateString(value);

const TAF_RANGES = [{ fra: iso('2024-01-01'), til: iso('2024-06-30') }];

const buildValues = (patch: Partial<ErstatningsopgoerelseValues>): ErstatningsopgoerelseValues => {
  const initial = createErstatningsopgoerelseInitialValues();
  return withSfggIngenForEmployments({
    ...initial,
    vedroererPeriodeFra: iso('2024-01-01'),
    vedroererPeriodeTil: iso('2024-12-31'),
    beregnesUdFra: 'Angivet månedsløn' as const,
    maanedsloenenUdgoer: asAmountValue(30000),
    kravPaaTabtArbejdsfortjeneste: 'Ja' as const,
    verserendeKlageEet: 'Nej' as const,
    tafPerioder: [{ id: 'taf-1', fra: iso('2024-01-01'), til: iso('2024-06-30'), loseFeriedage: 0 }],
    loenindkomstAnsaettelsesforhold: [
      {
        ...createDefaultLoenindkomstAnsaettelsesforhold(),
        loenudviklingBeregningsgrundlag: 'Ingen' as const,
        indtaegtsoplysningerTableData: [],
      },
    ],
    eoAngivetLoenLoenudvikling: {
      ...initial.eoAngivetLoenLoenudvikling,
      loenudviklingBeregningsgrundlag: 'Ingen' as const,
    },
    ...patch,
  });
};

/** Dokumentets TAF-statuslinjer og EO-kontrollens «TAF-ophør skyldes» for samme indtastning. */
const resolveBeggeSider = (values: ErstatningsopgoerelseValues, skadedatoISO: ISODateString) => {
  const stamdata = { ...STAMDATA_INITIAL_VALUES, skadestype: 'Arbejdsulykke' as const, skadedato: skadedatoISO };
  const snapshot = computeEoSnapshot({ revision: 'ophoersgrund-paritet', stamdataValues: stamdata, eoValues: values });
  if (!snapshot.data) throw new Error('Forventede beregnet EO-fixture');
  const dokument = buildTabtArbejdsfortjenesteModel(values, {
    tafNetto: snapshot.data.engines.tafNetto,
    tafRanges: TAF_RANGES,
    skadedatoISO,
    skadestype: 'Arbejdsulykke',
  });
  const kontrol = buildEoTaftRows(values, EMPTY_FIELD_ISSUE_SET, {
    skadedatoISO,
    skadelidteFodselsdato: undefined,
    erErhvervssygdom: false,
    endeligEETBeregnetDato: values.endeligEETVirkningsdato,
    midlertidigEETBeregnetDato: values.midlertidigEETVirkningsdato,
    differencekravDato: values.differencekravDato,
    verserendeKlageEet: false,
  }).find((row) => row.id === 'taf.ophoerSkyldes');
  return { dokument, kontrol };
};

describe('TAF-ophørsgrund: EO-kontrol og dokument vælger samme grund', () => {
  // Endelig EET og differencekrav på samme dato: dokumentet lader differencekravet bringe TAF til ophør, og
  // EO-kontrollen skal sige det samme – ikke «Endelig EET-afgørelse».
  it('nævner differencekravet begge steder, når endelig EET og differencekrav falder på samme dato', () => {
    const { dokument, kontrol } = resolveBeggeSider(buildValues({
      endeligtEETAfgorelse: 'Ja',
      endeligEETVirkningsdato: iso('2024-07-01'),
      differencekravDato: iso('2024-07-01'),
    }), iso('2024-01-01'));

    expect(dokument.differencekravLinje).toBe(
      'Der er opgjort differencekrav i sagen pr. 1. juli 2024. Differencekravet bringer retten til tabt arbejdsfortjeneste til ophør.'
    );
    expect(dokument.eetLinjer).not.toContain('Afgørelsen bringer retten til tabt arbejdsfortjeneste til ophør.');
    expect(kontrol?.displayValue).toBe('Differencekrav opgjort (01-07-2024)');
    expect(kontrol?.status).toBe('ok');
  });

  // Skade før 16-06-2011, midlertidig og endelig EET på samme dato: begge sider nævnte allerede den
  // endelige afgørelse – det skal bestå.
  it('nævner den endelige afgørelse begge steder ved samme dato for midlertidig og endelig EET før 2011', () => {
    const { dokument, kontrol } = resolveBeggeSider(buildValues({
      endeligtEETAfgorelse: 'Ja',
      endeligEETVirkningsdato: iso('2024-07-01'),
      midlertidigtEETAfgorelse: 'Ja',
      midlertidigEETVirkningsdato: iso('2024-07-01'),
    }), iso('2010-01-01'));

    expect(dokument.differencekravLinje).toBeNull();
    expect(dokument.eetLinjer).toContain('Afgørelsen bringer retten til tabt arbejdsfortjeneste til ophør.');
    expect(kontrol?.displayValue).toBe('Endelig EET-afgørelse (01-07-2024)');
  });

  it('vælger den tidligste dato og ved samme dato differencekrav før endelig før midlertidig', () => {
    expect(vaelgTafOphoersgrund([])).toBeUndefined();
    expect(vaelgTafOphoersgrund([
      { kilde: 'midlertidigEet', referenceDato: iso('2024-07-01') },
      { kilde: 'endeligEet', referenceDato: iso('2024-07-01') },
      { kilde: 'differencekrav', referenceDato: iso('2024-07-01') },
    ])?.kilde).toBe('differencekrav');
    expect(vaelgTafOphoersgrund([
      { kilde: 'midlertidigEet', referenceDato: iso('2024-07-01') },
      { kilde: 'endeligEet', referenceDato: iso('2024-07-01') },
    ])?.kilde).toBe('endeligEet');
    expect(vaelgTafOphoersgrund([
      { kilde: 'differencekrav', referenceDato: iso('2024-08-01') },
      { kilde: 'midlertidigEet', referenceDato: iso('2024-07-01') },
    ])?.kilde).toBe('midlertidigEet');
  });
});
