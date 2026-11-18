import {
  buildMidlertidigtEetInsertSource,
  buildEetImportContext,
} from '../../domain/erhvervsevnetab/eetImportPort';
import { ERHVERVSEVNETAB_INITIAL_VALUES } from '../../domain/erhvervsevnetab/erhvervsevnetabInitialValues';
import { serializeFieldAddress } from '../../inputCore/fieldAddress';
import { stamdataSkadestypeField } from '../../inputCore/catalog/stamdataDescriptors';
import {
  aslAfgoerelseEetPctField,
  aslAfgoerelseVirkningsDatoField,
} from '../../inputCore/catalog/erhvervsevnetabDescriptors';
import { getProductionInputCatalog } from '../../inputCore/catalog/productionCatalog';
import { createInputEvaluation } from '../../inputCore/inputReader';
import {
  createEvaluationSourceToken,
  createInputRevision,
  createSettingsRevision,
} from '../../inputCore/evaluationSource';
import { toISODateString } from '../../types/branded';
import type {
  ErhvervsevnetabValues,
  FaellesAarsloenValues,
  StamdataValues,
} from '../../schemas/formSchemas';

const catalog = getProductionInputCatalog();
const amount = (value: number) => ({ kind: 'number' as const, value });

/** Codec'ets egen afvisning af råteksten, så den rejected post matcher feltet (§1.5). */
const rejectedEntry = (raw: string) => {
  const parsed = aslAfgoerelseVirkningsDatoField.codec.parseForSettle(raw);
  if (parsed.status !== 'rejected') throw new Error(`Forventede afvist råtekst: ${raw}`);
  return { raw, reason: parsed.reason, ...(parsed.detail === undefined ? {} : { detail: parsed.detail }) };
};

const buildEvaluation = (options?: Readonly<{
  eetPct?: number;
  /** Procenten på selve ASL-afgørelsesrækken – i modsætning til `eetPct` ER den en importafhængighed. */
  afgoerelseEetPct?: number;
  aslAarsloen?: number;
  foedselsdato?: string;
  skadedato?: string;
  beregningsdato?: string | null;
  invalidSkadestype?: boolean;
  aslAfgoerelser?: ErhvervsevnetabValues['aslAfgoerelser'];
  /** Rå, ikke-committbar tekst i afgørelsesrækkens virkningsdato (fx en dato, der ikke findes). */
  rejectedVirkningsdato?: string;
}>) => {
  const beregningsdato = options?.beregningsdato === undefined ? '2026-03-01' : options.beregningsdato;
  const erhvervsevnetab: ErhvervsevnetabValues = {
    ...ERHVERVSEVNETAB_INITIAL_VALUES,
    beregningsdato: beregningsdato === null ? undefined : toISODateString(beregningsdato),
    ealEetPct: options?.eetPct ?? 25,
    aslAfgoerelser: options?.aslAfgoerelser ?? [{
      id: 'afg-1',
      afgoerelsesDato: toISODateString('2026-02-01'),
      virkningsDato: options?.rejectedVirkningsdato === undefined ? toISODateString('2026-02-01') : undefined,
      eetPct: options?.afgoerelseEetPct ?? 25,
      kapDato: undefined,
      kapPct: undefined,
      afgoerelseType: 'Midlertidig',
      tidlKapDato: undefined,
      fsTilbageholdtEet: 'Nej',
    }],
  };
  const faellesAarsloen: FaellesAarsloenValues = {
    aslAarsloen: amount(options?.aslAarsloen ?? 600000),
    ealAarsloen: amount(600000),
  };
  const stamdata: StamdataValues = {
    journalnr: 'J', advokat: 'A', sagsbehandler: 'S', skadelidte: 'T',
    skadestype: options?.invalidSkadestype ? undefined : 'Arbejdsulykke',
    skadelidteFodselsdato: toISODateString(options?.foedselsdato ?? '1980-01-01'),
    skadedato: toISODateString(options?.skadedato ?? '2024-01-01'),
  };
  const input = catalog.validateSettledInput({
    sections: {
      stamdata, satser: null, aarsloen: null, faellesAarsloen, renteberegning: null,
      varigemen: null, forsoergertab: null, erstatningsopgoerelse: null, erhvervsevnetab,
    },
    rejectedInputs: {
      ...(options?.invalidSkadestype ? {
        [serializeFieldAddress(stamdataSkadestypeField.bind().address)]: {
          raw: 'ikke-en-type',
          reason: 'format' as const,
        },
      } : {}),
      ...(options?.rejectedVirkningsdato === undefined ? {} : {
        [serializeFieldAddress(aslAfgoerelseVirkningsDatoField.bind('afg-1').address)]:
          rejectedEntry(options.rejectedVirkningsdato),
      }),
    },
  });
  return createInputEvaluation({
    input,
    catalog,
    sourceToken: createEvaluationSourceToken(createInputRevision(7), createSettingsRevision(3)),
  });
};

describe('buildMidlertidigtEetInsertSource', () => {
  it('bygger importkilden fra readerens samme revision og canonical værdier', () => {
    const source = buildMidlertidigtEetInsertSource(buildEvaluation());

    expect(source.revision).toBe('input-7-settings-3');
    // Importkilden indeholder kun importmotorens typed read-set; EAL-procenten hører til en anden gren.
    expect(source.eetValues.ealEetPct).toBeUndefined();
    expect(source.eetValues.ealAarsloen).toBeUndefined();
    expect(source.eetValues.aslAfgoerelser).toHaveLength(1);
    expect(source.issues).toBeUndefined();
  });

  // En sektionsvis gate ville blokere importen ved ETHVERT rødt felt i `erhvervsevnetab`.
  // `ealEetPct` læses ikke af `computeEetLoebendeYdelserForEoImport` – kun af EET-siden selv og
  // EET-efter-EAL. En bounds-fejl her fjernede altså importen og dens grupper fra Erstatningsopgørelsen
  // uden at røre noget tal i importen. Overblokering er lige så forkert som falske tal (§1.10).
  it('blokerer IKKE importen ved et rødt felt, importberegningen ikke læser', () => {
    const source = buildMidlertidigtEetInsertSource(buildEvaluation({ eetPct: 101 }));

    // Readeren maskerer fortsat den røde værdi – men den er ikke en importafhængighed.
    expect(source.eetValues.ealEetPct).toBeUndefined();
    expect(source.issues).toBeUndefined();
  });

  // EET-sidens beregningsdato er en opgørelsesdato for EET-sidens egne beregninger. Importen afgrænses af
  // TAF-slutdatoen, så en tom eller rød EET-beregningsdato må hverken spærre importen eller nå den.
  it.each([
    ['tom', null],
    ['før skadedatoen (rød bounds-fejl)', '2023-06-30'],
  ])('blokerer IKKE importen ved en %s EET-beregningsdato', (_label, beregningsdato) => {
    const source = buildMidlertidigtEetInsertSource(buildEvaluation({ beregningsdato }));

    expect(source.eetValues.beregningsdato).toBeUndefined();
    expect(source.issues).toBeUndefined();
  });

  it('fail-closer ved et rødt felt, importberegningen FAKTISK læser', () => {
    // Modretningen: gaten må ikke være blevet tandløs. `aslAfgoerelser.eetPct` ganges ind i periodebeløbene,
    // så en maskeret værdi ville give et falsk tal.
    const source = buildMidlertidigtEetInsertSource(buildEvaluation({ afgoerelseEetPct: 101 }));

    expect(source.issues).toEqual([{
      id: 'field-asl-afgoerelser',
      severity: 'error',
      message: 'Afgørelsen af 01-02-2026, EET %: Erhvervsevnetabet skal være mellem 5 og 100',
      focusTarget: { kind: 'fieldAddress', address: aslAfgoerelseEetPctField.bind('afg-1').address },
    }]);
  });

  it('nævner HVER rød celle i afgørelsen med række, kolonne og årsag – ikke én generisk fejl (BB-407)', () => {
    const source = buildMidlertidigtEetInsertSource(buildEvaluation({
      afgoerelseEetPct: 101,
      rejectedVirkningsdato: '31-02-2026',
    }));

    const issues = source.issues ?? [];
    expect(issues.map((issue) => issue.id)).toEqual(['field-asl-afgoerelser', 'field-asl-afgoerelser']);
    expect(issues.map((issue) => issue.focusTarget)).toEqual([
      { kind: 'fieldAddress', address: aslAfgoerelseVirkningsDatoField.bind('afg-1').address },
      { kind: 'fieldAddress', address: aslAfgoerelseEetPctField.bind('afg-1').address },
    ]);
    expect(issues[0]?.message).toMatch(/^Afgørelsen af 01-02-2026, Virkningsdato: /);
    expect(issues[1]?.message).toBe('Afgørelsen af 01-02-2026, EET %: Erhvervsevnetabet skal være mellem 5 og 100');
    expect(issues.some((issue) => issue.message.includes('ikke gyldigt udfyldt'))).toBe(false);

    // Rettes datoen, står procenten tilbage alene – brugeren kan se, at den første rettelse hjalp.
    const efterDato = buildMidlertidigtEetInsertSource(buildEvaluation({ afgoerelseEetPct: 101 }));
    expect(efterDato.issues?.map((issue) => issue.message)).toEqual([
      'Afgørelsen af 01-02-2026, EET %: Erhvervsevnetabet skal være mellem 5 og 100',
    ]);
  });

  it('genbruger tabellens tværrækkefejl og feltadresse før EO-importen', () => {
    const rows: ErhvervsevnetabValues['aslAfgoerelser'] = [{
      id: 'tidligere-kapitalisering',
      afgoerelsesDato: toISODateString('2019-06-01'),
      eetPct: 40,
      kapDato: toISODateString('2019-06-01'),
      kapPct: 40,
      afgoerelseType: 'Endelig',
      fsTilbageholdtEet: 'Nej',
    }, {
      id: 'midlertidig-rest',
      afgoerelsesDato: toISODateString('2020-01-01'),
      eetPct: 60,
      afgoerelseType: 'Midlertidig',
      fsTilbageholdtEet: 'Nej',
    }, {
      id: 'lavere-end-kapitaliseret',
      afgoerelsesDato: toISODateString('2021-10-01'),
      eetPct: 30,
      afgoerelseType: 'Endelig',
      fsTilbageholdtEet: 'Nej',
    }];
    const options = { foedselsdato: '1955-07-01', skadedato: '2019-04-01', aslAarsloen: 401000 };
    const source = buildMidlertidigtEetInsertSource(buildEvaluation({ ...options, aslAfgoerelser: rows }));
    expect(source.issues).toEqual([{
      id: 'field-asl-afgoerelser', severity: 'error',
      message: 'Afgørelsen af 01-10-2021, EET % kan ikke være lavere end den akkumulerede kapitaliseringsprocent fra tidligere afgørelser.',
      focusTarget: { kind: 'fieldAddress', address: aslAfgoerelseEetPctField.bind('lavere-end-kapitaliseret').address },
    }]);
    const blocked = buildEetImportContext(source, toISODateString('2022-06-30'));
    expect(blocked.groups).toEqual([]);
    expect(blocked.issues).toEqual(source.issues);

    // Rettelsen af EET-forløbet genåbner importen. Et uafhængigt rødt EAL-felt spærrer den stadig ikke.
    const readySource = buildMidlertidigtEetInsertSource(buildEvaluation({
      ...options,
      eetPct: 101,
      aslAfgoerelser: rows.map((row) => row.id === 'lavere-end-kapitaliseret' ? {
        ...row, eetPct: 60, kapDato: toISODateString('2021-10-01'), kapPct: 20,
      } : row),
    }));
    expect(readySource.issues).toBeUndefined();
    const ready = buildEetImportContext(readySource, toISODateString('2022-06-30'));
    expect(ready.issues.filter((issue) => issue.severity === 'error')).toEqual([]);
    expect(ready.groups).not.toHaveLength(0);
  });

  it('fail-closer ved en rød ASL-årsløn – grundlønnen ganges ind i hvert periodebeløb', () => {
    const source = buildMidlertidigtEetInsertSource(buildEvaluation({ aslAarsloen: -5 }));

    const issue = source.issues?.find((candidate) => candidate.id === 'midlertidigt-eet-faelles-aarsloen-schema-invalid');
    expect(issue).toBeDefined();
    // Feltets konkrete besked, ikke «… er ikke gyldigt udfyldt» (BB-407).
    expect(issue?.message).not.toContain('ikke gyldigt udfyldt');
  });

  it('gengiver ASL-årslønnens konkrete loft, når beløbet er for højt (BB-407)', () => {
    const source = buildMidlertidigtEetInsertSource(buildEvaluation({ aslAarsloen: 9000000 }));

    const issue = source.issues?.find((candidate) => candidate.id === 'midlertidigt-eet-faelles-aarsloen-schema-invalid');
    expect(issue?.message).toMatch(/\d{3}\.\d{3}/);
    expect(issue?.focusTarget?.kind).toBe('fieldAddress');
  });

  it('fail-closer ved ugyldig datoorden i stamdata', () => {
    const source = buildMidlertidigtEetInsertSource(buildEvaluation({
      foedselsdato: '2010-01-01',
      skadedato: '2009-01-01',
    }));

    expect(source.issues?.map((issue) => issue.id)).toContain('midlertidigt-eet-stamdata-date-order');
  });

  it('bruger datoordenens fallbacktekst, når Skadestype samtidig er rød', () => {
    const source = buildMidlertidigtEetInsertSource(buildEvaluation({
      foedselsdato: '2010-01-01',
      skadedato: '2009-01-01',
      invalidSkadestype: true,
    }));

    expect(source.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'midlertidigt-eet-stamdata-date-order',
        message: expect.stringContaining('skadedato'),
      }),
    ]));
  });

  it('bruger datoordenens referencegrænse, når Fødselsdato samtidig har en bounds-fejl', () => {
    const source = buildMidlertidigtEetInsertSource(buildEvaluation({
      foedselsdato: '2100-01-01',
      skadedato: '2020-01-01',
    }));

    expect(source.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'midlertidigt-eet-stamdata-date-order',
        message: 'Der er angivet en skadedato før skadelidtes fødselsdato (2100-01-01)',
      }),
    ]));
  });

  it('fail-closer ved en anden stamdata-fejl end datoorden', () => {
    const source = buildMidlertidigtEetInsertSource(buildEvaluation({
      foedselsdato: '1970-01-01',
      skadedato: '2004-12-31',
    }));

    expect(source.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'midlertidigt-eet-stamdata-schema-invalid',
        severity: 'error',
      }),
    ]));
    // Feltets navn og årsag, ikke «Stamdata kunne ikke valideres» (BB-407).
    expect(source.issues?.some((issue) => issue.message.startsWith('Stamdata kunne ikke valideres'))).toBe(false);
  });

});
