import {
  __createTestStore,
} from '../../stores/formPersistenceStore';
import {
  hasAarsloenEffectiveRows,
  resolveAarsloenDefaultLoenperiode,
  shouldShowAarsloenFerieFields,
  shouldShowAarsloenShDageFields,
  shouldWarnAarsloenFeriePct,
} from '../../domain/policies';
import { LOENPERIODE, LOEN_PAA_HELLIGDAGE } from '../../types/loen';
import type { AarsloenTableRow } from '../../schemas/formSchemas';
import { PERSISTED_DATA_VERSION } from '../../config/persistenceVersion';

const VALID_META = { hydrated: true, schemaFingerprint: PERSISTED_DATA_VERSION };

describe('formPersistenceStore (aarsloen selectors)', () => {
  let store: ReturnType<typeof __createTestStore>;

  beforeEach(() => {
    store = __createTestStore();
    store.getState().clearAll(VALID_META);
  });

  it('defaults loenperiode to maaned when state is empty', () => {
    // arrange
    store.getState().clearSection('aarsloen');

    // act
    const state = store.getState();

    // assert
    expect(resolveAarsloenDefaultLoenperiode(state.sections.aarsloen)).toBe(LOENPERIODE.MAANED);
  });

  it('returns loenperiode from state when present', () => {
    // arrange
    store.getState().commitSection('aarsloen', {
      feriePct: undefined,
      fritvalgPct: undefined,
      shSoPct: undefined,
      storeBededagPct: undefined,
      pensionPct: undefined,
      loenperiode: LOENPERIODE.UGE,
      tableData: [],
      omregningTilFuldtAar: false,
      fuldLoenUnderFerie: true,
      retTilSjetteFerieuge: true,
      antalFeriedage: undefined,
      loenPaaHelligdage: LOEN_PAA_HELLIGDAGE.ALMINDELIG,
    });

    // act
    const state = store.getState();

    // assert
    expect(resolveAarsloenDefaultLoenperiode(state.sections.aarsloen)).toBe(LOENPERIODE.UGE);
  });

  it('detects non-empty rows', () => {
    // arrange
    const emptyRow: AarsloenTableRow = {
      id: 'row-1',
      col0_maaned: '',
      col1_maaned: '',
      col0_uge: '',
      col1_uge: '',
      col0_dag: '',
      col1_dag: '',
      col2: undefined,
      col3: undefined,
      col4: undefined,
      col5: undefined,
    };

    const filledRow: AarsloenTableRow = {
      ...emptyRow,
      id: 'row-2',
      col2: { kind: 'number', value: 1200 },
    };

    store.getState().commitSection('aarsloen', {
      feriePct: undefined,
      fritvalgPct: undefined,
      shSoPct: undefined,
      storeBededagPct: undefined,
      pensionPct: undefined,
      loenperiode: LOENPERIODE.MAANED,
      tableData: [emptyRow, filledRow],
      omregningTilFuldtAar: false,
      fuldLoenUnderFerie: true,
      retTilSjetteFerieuge: true,
      antalFeriedage: undefined,
      loenPaaHelligdage: LOEN_PAA_HELLIGDAGE.ALMINDELIG,
    });

    // act
    const state = store.getState();

    // assert
    expect(hasAarsloenEffectiveRows(state.sections.aarsloen)).toBe(true);
  });

  it('exposes derived UI flags from aarsloen state', () => {
    // arrange
    store.getState().commitSection('aarsloen', {
      feriePct: 15,
      fritvalgPct: undefined,
      shSoPct: undefined,
      storeBededagPct: undefined,
      pensionPct: undefined,
      loenperiode: LOENPERIODE.MAANED,
      tableData: [],
      omregningTilFuldtAar: false,
      fuldLoenUnderFerie: false,
      retTilSjetteFerieuge: false,
      antalFeriedage: undefined,
      loenPaaHelligdage: LOEN_PAA_HELLIGDAGE.SH_UDBETALING,
    });

    // act
    const state = store.getState();

    // assert
    expect(shouldShowAarsloenFerieFields(state.sections.aarsloen)).toBe(true);
    expect(shouldShowAarsloenShDageFields(state.sections.aarsloen)).toBe(true);
    expect(shouldWarnAarsloenFeriePct(state.sections.aarsloen)).toBe(true);
  });
});
