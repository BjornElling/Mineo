// @vitest-environment jsdom
import { referenceRates, surchargeRates } from '../../../data/interestRates';
import {
  buildRenteberegningReaderProjection,
  hasAnyRentekravInput,
} from '../../../domain/renteberegning/renteberegningReaderProjection';
import * as renteberegningEngine from '../../../domain/renteberegning/renteberegningEngine';
import type { RentekravRow } from '../../../schemas/formSchemas';
import { toISODateString } from '../../../types/branded';
import { getProductionInputCatalog } from '../../../inputCore/catalog/productionCatalog';
import { createInputEvaluation } from '../../../inputCore/inputReader';
import { serializeFieldAddress } from '../../../inputCore/fieldAddress';
import {
  rentekravBelobField,
  rentekravTillaegstidField,
  renteberegningBeregningsdatoField,
} from '../../../inputCore/catalog/renteberegningDescriptors';
import {
  createEvaluationSourceToken,
  createInputRevision,
  createSettingsRevision,
} from '../../../inputCore/evaluationSource';

// Den FULDE projektionsmatrix for Renteberegning (§1.10/§3.9). Suiten dækkede tidligere kun tre nominelle/tomme
// cases; den beviste derfor ikke `blocked`-grenene — hverken at et rejected råinput blokerer, at blokeringen er
// PER RÆKKE, eller at motoren ikke kaldes i en blokeret projektion.
//
// Matrixen her er: {gyldig, rejected råtekst, tom} × {rækkefelt, tværgående beregningsdato} × {række, aggregat}.

const catalog = getProductionInputCatalog();

const createRow = (id: string, overrides?: Partial<RentekravRow>): RentekravRow => ({
  id,
  belob: { kind: 'number', value: 1_000 },
  renterFra: toISODateString('2024-01-01'),
  tillaegstid: 0,
  enhed: 'dage',
  ...overrides,
});

type RejectedSpec = Readonly<{ address: string; raw: string }>;

const buildReader = (
  rows: readonly RentekravRow[],
  beregningsdato: string | undefined,
  rejected: readonly RejectedSpec[] = []
) => {
  const input = catalog.validateSettledInput({
    sections: {
      stamdata: null, satser: null, aarsloen: null, faellesAarsloen: null,
      renteberegning: {
        beregningsdato: beregningsdato === undefined ? undefined : toISODateString(beregningsdato),
        kommentarer: undefined,
        rentekravRows: rows as RentekravRow[],
      },
      varigemen: null, forsoergertab: null, erstatningsopgoerelse: null, erhvervsevnetab: null,
    },
    rejectedInputs: Object.fromEntries(
      rejected.map(({ address, raw }) => [address, { raw, reason: 'format' as const }])
    ),
  });
  const sourceToken = createEvaluationSourceToken(createInputRevision(1), createSettingsRevision(1));
  return createInputEvaluation({ input, catalog, sourceToken }).reader;
};

const build = (
  rows: readonly RentekravRow[],
  beregningsdato: string | undefined,
  rejected: readonly RejectedSpec[] = []
) => buildRenteberegningReaderProjection({
  reader: buildReader(rows, beregningsdato, rejected),
  referenceRates,
  surchargeRates,
});

// XOR-invarianten (§1.5): et rejected felt har ALTID en tom canonical værdi — råteksten og en canonical værdi
// kan ikke eksistere samtidig. Fixtures skal derfor rydde feltet, når de injicerer et rejected råinput;
// `validateSettledInput` afviser ellers inputtet, og det er netop den invariant, vi bygger på.
const REJECTED_BELOB = (rowId: string): RejectedSpec => ({
  address: serializeFieldAddress(rentekravBelobField.bind(rowId).address),
  raw: 'ikke-et-beløb',
});

describe('Renteberegning projektionsmatrix: rejected råinput blokerer', () => {
  it('et rejected rækkefelt blokerer NETOP den række — søsterrækken forbliver ready', () => {
    // §1.10: blokeringen følger de refs, projektionen faktisk læser. Række r2's projektion læser ikke r1's felter.
    const projection = build(
      [createRow('r1', { belob: undefined }), createRow('r2')],
      '2024-12-31',
      [REJECTED_BELOB('r1')]
    );

    expect(projection.rowProjections.get('r1')?.status).toBe('blocked');
    expect(projection.rowProjections.get('r2')?.status).toBe('ready');
  });

  it('et rejected rækkefelt blokerer også AGGREGATET, fordi aggregatet læser alle rækker', () => {
    const projection = build(
      [createRow('r1', { belob: undefined }), createRow('r2')],
      '2024-12-31',
      [REJECTED_BELOB('r1')]
    );

    expect(projection.aggregateProjection.status).toBe('blocked');
  });

  it('en rejected tværgående beregningsdato blokerer ALLE rækker og aggregatet', () => {
    const projection = build(
      [createRow('r1'), createRow('r2')],
      undefined,
      [{ address: serializeFieldAddress(renteberegningBeregningsdatoField.bind().address), raw: '99-99-9999' }]
    );

    expect(projection.rowProjections.get('r1')?.status).toBe('blocked');
    expect(projection.rowProjections.get('r2')?.status).toBe('blocked');
    expect(projection.aggregateProjection.status).toBe('blocked');
  });

  it('en blokeret projektion bærer feltets issue med sig', () => {
    const projection = build(
      [createRow('r1', { tillaegstid: undefined })],
      '2024-12-31',
      [{ address: serializeFieldAddress(rentekravTillaegstidField.bind('r1').address), raw: 'x' }]
    );

    const row = projection.rowProjections.get('r1');
    expect(row?.status).toBe('blocked');
    expect(row?.issues.length).toBeGreaterThan(0);
  });
});

describe('Renteberegning projektionsmatrix: motoren kaldes ikke i blocked', () => {
  it('kalder ALDRIG computeRentekravRow, når et rækkefelt er rejected', () => {
    // Kontraktkravet (`form-contract.md` §2.3 / `error-contract.md` §5): kun en ready projektion må fodre motoren.
    // Motoren kaldes efter `runProjection` gennem `mapReadyProjection`; blocked kan derfor ikke nå motoren.
    const spy = vi.spyOn(renteberegningEngine, 'computeRentekravRow');
    try {
      build([createRow('r1', { belob: undefined })], '2024-12-31', [REJECTED_BELOB('r1')]);

      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it('kalder ALDRIG motoren, når den tværgående beregningsdato er rejected', () => {
    const spy = vi.spyOn(renteberegningEngine, 'computeRentekravRow');
    try {
      build(
        [createRow('r1'), createRow('r2')],
        undefined,
        [{ address: serializeFieldAddress(renteberegningBeregningsdatoField.bind().address), raw: '99-99-9999' }]
      );

      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it('kalder motoren præcis én gang pr. gyldig række og genbruger resultatet i aggregatet', () => {
    const spy = vi.spyOn(renteberegningEngine, 'computeRentekravRow');
    try {
      build([createRow('r1'), createRow('r2')], '2024-12-31');
      expect(spy).toHaveBeenCalledTimes(2);
    } finally {
      spy.mockRestore();
    }
  });

  it('kalder kun motoren for den ready søskenderække, når aggregatet er blocked', () => {
    const spy = vi.spyOn(renteberegningEngine, 'computeRentekravRow');
    try {
      const projection = build(
        [createRow('r1', { belob: undefined }), createRow('r2')],
        '2024-12-31',
        [REJECTED_BELOB('r1')]
      );

      expect(projection.rowProjections.get('r1')?.status).toBe('blocked');
      expect(projection.rowProjections.get('r2')?.status).toBe('ready');
      expect(projection.aggregateProjection.status).toBe('blocked');
      expect(spy).toHaveBeenCalledTimes(1);
    } finally {
      spy.mockRestore();
    }
  });
});

describe('Renteberegning projektionsmatrix: tomme og manglende værdier', () => {
  it('regner rejected råtekst som indtastning til Slet alle', () => {
    const reader = buildReader(
      [createRow('r1', { belob: undefined })],
      '2024-12-31',
      [REJECTED_BELOB('r1')]
    );

    expect(hasAnyRentekravInput(reader)).toBe(true);
  });

  it('regner en helt tom række som ingen indtastning', () => {
    const reader = buildReader([
      { id: 'r-empty', belob: undefined, renterFra: undefined, tillaegstid: undefined, enhed: 'dage' },
    ], '2024-12-31');

    expect(hasAnyRentekravInput(reader)).toBe(false);
  });

  it('en manglende beregningsdato holder projektionen ready (feltet er optional)', () => {
    // `beregningsdato` læses med `optional`, så tomhed er ikke en blokering — kun rejected råtekst er.
    // Testen fastholder den afgrænsning, så en fremtidig ændring til `require` ikke sker ubemærket.
    const projection = build([createRow('r1')], undefined);

    expect(projection.rowProjections.get('r1')?.status).toBe('ready');
    expect(projection.aggregateProjection.status).toBe('ready');
  });

  it('en HELT tom tabel giver et ready aggregat uden pdfContexts', () => {
    const projection = build([], '2024-12-31');

    expect(projection.rowProjections.size).toBe(0);
    expect(projection.aggregateProjection.status).toBe('ready');
    if (projection.aggregateProjection.status !== 'ready') throw new Error('forventede ready');
    expect(projection.aggregateProjection.value.pdfContexts.size).toBe(0);
    expect(projection.aggregateProjection.value.anyRowHasError).toBe(false);
  });

  it('en delvist udfyldt række er ready, men bidrager ikke med pdfContext', () => {
    // Delvist udfyldt = ikke tom (så den tælles), men motoren kan ikke give en pdfContext → anyRowHasError.
    const partial = createRow('r-partial', { renterFra: undefined });
    const projection = build([partial], '2024-12-31');

    expect(projection.rowProjections.get('r-partial')?.status).toBe('ready');
    if (projection.aggregateProjection.status !== 'ready') throw new Error('forventede ready');
    expect(projection.aggregateProjection.value.pdfContexts.has('r-partial')).toBe(false);
    expect(projection.aggregateProjection.value.anyRowHasError).toBe(true);
  });

  it('en tom række blokerer ikke en gyldig søsterrække i aggregatet', () => {
    const emptyRow: RentekravRow = {
      id: 'r-empty', belob: undefined, renterFra: undefined, tillaegstid: undefined, enhed: 'dage',
    };
    const projection = build([createRow('r1'), emptyRow], '2024-12-31');

    if (projection.aggregateProjection.status !== 'ready') throw new Error('forventede ready');
    expect(projection.aggregateProjection.value.pdfContexts.has('r1')).toBe(true);
    expect(projection.aggregateProjection.value.pdfContexts.size).toBe(1);
    expect(projection.aggregateProjection.value.anyRowHasError).toBe(false);
  });
});
