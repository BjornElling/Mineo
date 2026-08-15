// @vitest-environment jsdom
import { __createSlimInputTestStore } from '../../../../inputCore/runtime/slimInputStore';
import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { dispatchInput, ActiveEditorRegistry, type SlimInputStore } from '../../../../inputCore/runtime';
import {
  createInputRuntimeBinding,
  InputRuntimeProvider,
  type InputRuntimeBinding,
} from '../../../../inputCore/react';
import { GridAmountCell, GridDateCell } from '../../../../inputCore/react/fields';
import { createInputEvaluation } from '../../../../inputCore/inputReader';
import {
  createEvaluationSourceToken,
  createCollectionRef,
  toAnyFieldRef,
  buildFieldIssueSet,
  bindFieldIssueSnapshot,
  type InputCatalog,
  type FieldIssue,
} from '../../../../inputCore';
import { insertRow } from '../../../../inputCore/inputReducer';
import {
  createTestCatalog,
  belobField,
  renterFraField,
  makeRow,
  testRowOrigin,
  testLocation,
} from '../../testCatalog';
import { GridCoreProvider } from '../../../../components/tables/gridCore/gridCoreContext';
import type { GridCellCoord, GridCoreStateStore } from '../../../../components/tables/gridCore/gridCoreTypes';

// VÆRN: en celle-familie må ikke tabe den feedback, dens props lover.
//
// Fundet 2026-08-15: `BaseCellProps` erklærede BÅDE `warning` og `collectionRuleIssue`, men kun to af de
// syv celle-familier destrukturerede og videresendte dem. `GridAmountCell`, `GridIntegerCell`,
// `GridYearCell` og `GridWeekCell` lod dem falde på gulvet. Typesystemet accepterede kaldet, så en rød
// kryds-række-fejl eller en gul advarsel kunne sættes på en celle og bare aldrig blive vist — uden at
// noget blev rødt nogen steder.
//
// Værnet måler ADFÆRD: propsene sættes, og cellens synlige tilstand aflæses.

const FIELD_ADDR_ATTR = 'data-mineo-field-address';

let catalog: InputCatalog;
let store: SlimInputStore;
let registry: ActiveEditorRegistry;
let issues: FieldIssue[];

beforeEach(() => {
  sessionStorage.clear();
  catalog = createTestCatalog();
  store = __createSlimInputTestStore();
  registry = new ActiveEditorRegistry();
  issues = [];
});
afterEach(() => sessionStorage.clear());

const rentekravRef = () =>
  createCollectionRef({ section: 'renteberegning', path: [], collection: 'rentekravRows' });

const makeBinding = (): InputRuntimeBinding =>
  createInputRuntimeBinding(store, catalog, registry, () => {
    const state = store.getState();
    return createInputEvaluation({
      input: state.input,
      catalog,
      sourceToken: createEvaluationSourceToken(state.revision, state.settingsRevision),
    });
  }, () => {
    const state = store.getState();
    return bindFieldIssueSnapshot(
      buildFieldIssueSet(issues),
      createEvaluationSourceToken(state.revision, state.settingsRevision)
    );
  });

const gridCell: GridCellCoord = { rowId: 'r1', colIndex: 0 };
const gridStateStore: GridCoreStateStore = {
  subscribe: () => () => undefined,
  getFocusedCell: () => null,
  getEditingCell: () => null,
};

const renderCell = (node: React.ReactNode) => {
  dispatchInput(store, catalog, insertRow(rentekravRef(), makeRow('r1')), { origin: testRowOrigin() });
  return render(
    <InputRuntimeProvider binding={makeBinding()}>
      <GridCoreProvider value={{
        gridStateStore,
        openEditing: () => undefined,
        closeEditing: () => undefined,
        registerEditor: () => undefined,
        unregisterEditor: () => undefined,
        getEditor: () => null,
        requestFocusPlan: () => undefined,
      }}>
        {node}
      </GridCoreProvider>
    </InputRuntimeProvider>
  );
};

describe('grid-celler videresender advarsel og kryds-række-fejl', () => {
  it('beløbscellen viser en gul advarsel (den blev før tavst droppet)', () => {
    renderCell(
      <GridAmountCell
        gridCell={gridCell}
        cell={{ kind: 'existing', field: belobField.bind('r1'), location: testLocation('loc-amount') }}
        warning={{ severity: 'warning', message: 'Beløbet virker usædvanligt lavt' }}
      />
    );
    expect(screen.getByText('Beløbet virker usædvanligt lavt')).toBeInTheDocument();
  });

  it('beløbscellen viser en kryds-række-fejl og binder den til inputtet', () => {
    const ruleIssue: FieldIssue = Object.freeze({
      kind: 'field',
      code: 'test.dublet',
      severity: 'error',
      field: toAnyFieldRef(belobField.bind('r1')),
      reason: 'rule',
      message: 'To rækker har samme beløb',
    });
    renderCell(
      <GridAmountCell
        gridCell={gridCell}
        cell={{ kind: 'existing', field: belobField.bind('r1'), location: testLocation('loc-amount') }}
        collectionRuleIssue={ruleIssue}
      />
    );
    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    const describedBy = input.getAttribute('aria-describedby');
    expect(describedBy).not.toBeNull();
    expect(document.getElementById(describedBy ?? '')?.textContent).toBe('To rækker har samme beløb');
  });

  it('uden advarsel eller fejl bindes ingenting (måler den rigtige mekanisme)', () => {
    renderCell(
      <GridAmountCell
        gridCell={gridCell}
        cell={{ kind: 'existing', field: belobField.bind('r1'), location: testLocation('loc-amount') }}
      />
    );
    const input = screen.getByRole('textbox');
    expect(input.getAttribute('aria-describedby')).toBeNull();
    expect(input).toHaveAttribute('aria-invalid', 'false');
  });

  it('datocellen videresender også sin advarsel', () => {
    renderCell(
      <GridDateCell
        gridCell={gridCell}
        cell={{ kind: 'existing', field: renterFraField.bind('r1'), location: testLocation('loc-date') }}
        warning={{ severity: 'warning', message: 'Datoen ligger langt ude i fremtiden' }}
      />
    );
    expect(screen.getByText('Datoen ligger langt ude i fremtiden')).toBeInTheDocument();
  });

  it('cellen bærer sin feltidentitet, så testen måler den rigtige celle', () => {
    renderCell(
      <GridAmountCell
        gridCell={gridCell}
        cell={{ kind: 'existing', field: belobField.bind('r1'), location: testLocation('loc-amount') }}
      />
    );
    expect(screen.getByRole('textbox').getAttribute(FIELD_ADDR_ATTR)).not.toBeNull();
  });
});
