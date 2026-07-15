// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import {
  useDraftLifecycle,
  type DraftSettleEffects,
  type UseDraftLifecycleConfig,
} from '../../../hooks/fieldState/useDraftLifecycle';
import type { FieldSettleParse } from '../../../hooks/fieldState/fieldSettleMachine';

/**
 * Kontrakttest for den delte draft-livscyklus, som både `useDraftField` (form) og `useTableInputCore`
 * (grid) driver. Testen hævder settle-forgreningens observerbare udfald (commit/noop/inert/invalid),
 * pending-guarden mod silent-rollback, den autoritative epoch-resync og rollback ved effektfejl —
 * uafhængigt af begge surfaces.
 */

const noopEffects = <TValue,>(overrides: Partial<DraftSettleEffects<TValue>> = {}): DraftSettleEffects<TValue> => ({
  writeInvalidDraft: () => true,
  commitValue: () => true,
  ...overrides,
});

const validParse = <TValue,>(value: TValue): FieldSettleParse<TValue> => ({ status: 'valid', value });
const invalidParse = <TValue,>(): FieldSettleParse<TValue> => ({ status: 'invalid' });
const inertParse = <TValue,>(): FieldSettleParse<TValue> => ({ status: 'inert' });

describe('useDraftLifecycle', () => {
  const baseConfig = (overrides: Partial<UseDraftLifecycleConfig> = {}): UseDraftLifecycleConfig => ({
    initialDraft: '',
    authoritativeEpoch: 0,
    externalSource: '',
    currentFormattedValue: '',
    isActivelyEditing: () => false,
    onAuthoritativeReplace: () => {},
    ...overrides,
  });

  it('initialiserer draften fra initialDraft (surfaces mounter med initialDraft === externalSource)', () => {
    const { result } = renderHook(() =>
      useDraftLifecycle<number>(baseConfig({ initialDraft: '12,,3', externalSource: '12,,3', currentFormattedValue: '5' }))
    );
    expect(result.current.draft).toBe('12,,3');
    expect(result.current.draftRef.current).toBe('12,,3');
  });

  it('settle: gyldig værdi committer, synker draften til target og sætter pending-guard', () => {
    const commitValue = vi.fn(() => true);
    const { result } = renderHook(() =>
      useDraftLifecycle<number>(baseConfig({ initialDraft: '5', currentFormattedValue: '5', externalSource: '5' }))
    );

    let ok = false;
    act(() => {
      ok = result.current.executeSettle('7', {
        parse: validParse(7),
        isNoop: false,
        formattedValueAtCommit: '5',
        target: '7',
      }, noopEffects({ commitValue }));
    });

    expect(ok).toBe(true);
    expect(commitValue).toHaveBeenCalledWith(7);
    expect(result.current.draft).toBe('7');
    // Pending-guard sat, fordi target ('7') afviger fra formattedValueAtCommit ('5').
    expect(result.current.pendingRef.current).toEqual({ formattedValueAtCommit: '5' });
  });

  it('settle: no-op commit rører ikke commitValue men kalder onNoopCommit', () => {
    const commitValue = vi.fn(() => true);
    const onNoopCommit = vi.fn(() => true);
    const { result } = renderHook(() =>
      useDraftLifecycle<number>(baseConfig({ initialDraft: '5', currentFormattedValue: '5', externalSource: '5' }))
    );

    let ok = false;
    act(() => {
      ok = result.current.executeSettle('5', {
        parse: validParse(5),
        isNoop: true,
        formattedValueAtCommit: '5',
        target: '5',
      }, noopEffects({ commitValue, onNoopCommit }));
    });

    expect(ok).toBe(true);
    expect(commitValue).not.toHaveBeenCalled();
    expect(onNoopCommit).toHaveBeenCalledTimes(1);
    expect(result.current.pendingRef.current).toBeNull();
  });

  it('settle: inert (tom/partial uden besked) committer intet og rører ikke slotten via writeInvalidDraft', () => {
    const writeInvalidDraft = vi.fn(() => true);
    const onInert = vi.fn(() => true);
    const { result } = renderHook(() => useDraftLifecycle<number>(baseConfig()));

    let ok = false;
    act(() => {
      ok = result.current.executeSettle('', {
        parse: inertParse(),
        isNoop: false,
        formattedValueAtCommit: '',
        target: '',
      }, noopEffects({ writeInvalidDraft, onInert }));
    });

    expect(ok).toBe(true);
    expect(writeInvalidDraft).not.toHaveBeenCalled();
    expect(onInert).toHaveBeenCalledTimes(1);
  });

  it('settle: ugyldig råstreng skriver til slotten, viser den rå draft og returnerer false', () => {
    const writeInvalidDraft = vi.fn(() => true);
    const { result } = renderHook(() =>
      useDraftLifecycle<number>(baseConfig({ initialDraft: '5', currentFormattedValue: '5', externalSource: '5' }))
    );

    let ok = true;
    act(() => {
      ok = result.current.executeSettle('12,,3', {
        parse: invalidParse(),
        isNoop: false,
        formattedValueAtCommit: '5',
        target: '5',
      }, noopEffects({ writeInvalidDraft }));
    });

    expect(ok).toBe(false);
    expect(writeInvalidDraft).toHaveBeenCalledWith('12,,3');
    expect(result.current.draft).toBe('12,,3');
    expect(result.current.pendingRef.current).toBeNull();
  });

  it('settle: fejlende commitValue ruller draften tilbage til externalSource (default)', () => {
    const { result } = renderHook(() =>
      useDraftLifecycle<number>(baseConfig({ initialDraft: '5', currentFormattedValue: '5', externalSource: '5' }))
    );

    let ok = true;
    act(() => {
      ok = result.current.executeSettle('7', {
        parse: validParse(7),
        isNoop: false,
        formattedValueAtCommit: '5',
        target: '7',
      }, noopEffects({ commitValue: () => false }));
    });

    expect(ok).toBe(false);
    expect(result.current.draft).toBe('5');
    expect(result.current.pendingRef.current).toBeNull();
  });

  it('settle: rollbackDraft-override ruller tilbage til den rene visning (grid-divergens)', () => {
    const { result } = renderHook(() =>
      useDraftLifecycle<number>(baseConfig({
        initialDraft: '12,,3',
        currentFormattedValue: '5',
        externalSource: '12,,3', // effectiveInvalidDraft ?? format(value)
        rollbackDraft: '5', // committedDisplayValue
      }))
    );

    act(() => {
      result.current.executeSettle('7', {
        parse: validParse(7),
        isNoop: false,
        formattedValueAtCommit: '5',
        target: '7',
      }, noopEffects({ commitValue: () => false }));
    });

    // Grid ruller til den rene committede visning, ikke den tilbageværende rå draft.
    expect(result.current.draft).toBe('5');
  });

  it('resync: autoritativt epoch-skift vinder over aktiv redigering og kalder onAuthoritativeReplace', () => {
    const onAuthoritativeReplace = vi.fn();
    let epoch = 0;
    const { result, rerender } = renderHook(
      (props: { epoch: number; externalSource: string }) =>
        useDraftLifecycle<number>(baseConfig({
          initialDraft: 'gammel',
          authoritativeEpoch: props.epoch,
          externalSource: props.externalSource,
          currentFormattedValue: props.externalSource,
          isActivelyEditing: () => true, // aktivt redigeret — men epoch-bump vinder
          onAuthoritativeReplace,
        })),
      { initialProps: { epoch, externalSource: 'gammel' } }
    );

    epoch = 1;
    act(() => rerender({ epoch, externalSource: 'ny' }));

    expect(result.current.draft).toBe('ny');
    expect(onAuthoritativeReplace).toHaveBeenCalledTimes(1);
  });

  it('resync: aktiv redigering uden epoch-skift trækker IKKE draften væk under brugeren', () => {
    const { result, rerender } = renderHook(
      (props: { externalSource: string }) =>
        useDraftLifecycle<number>(baseConfig({
          initialDraft: 'bruger-taster',
          externalSource: props.externalSource,
          currentFormattedValue: props.externalSource,
          isActivelyEditing: () => true,
        })),
      { initialProps: { externalSource: 'gammel' } }
    );

    act(() => rerender({ externalSource: 'ekstern-ændret' }));

    expect(result.current.draft).toBe('bruger-taster');
  });

  it('resync: idle felt følger den eksterne kilde (committed value-ændring)', () => {
    const { result, rerender } = renderHook(
      (props: { externalSource: string }) =>
        useDraftLifecycle<number>(baseConfig({
          initialDraft: 'gammel',
          externalSource: props.externalSource,
          currentFormattedValue: props.externalSource,
          isActivelyEditing: () => false,
        })),
      { initialProps: { externalSource: 'gammel' } }
    );

    act(() => rerender({ externalSource: 'ny' }));

    expect(result.current.draft).toBe('ny');
  });

  it('setDraft opdaterer både state og eager ref synkront', () => {
    const { result } = renderHook(() => useDraftLifecycle<number>(baseConfig()));
    act(() => result.current.setDraft('kladde'));
    expect(result.current.draft).toBe('kladde');
    expect(result.current.draftRef.current).toBe('kladde');
  });

  it('settle: en efterfølgende inert-settle rydder en tidligere reel commits pending-guard', () => {
    // Regression: pending-guarden må ikke overleve en inert-settle. Ellers undertrykker et stale hold
    // en efterfølgende resync (fieldResyncMachine.isPendingHold), selvom draften ikke længere committer.
    const { result } = renderHook(() =>
      useDraftLifecycle<number>(baseConfig({ initialDraft: '5', currentFormattedValue: '5', externalSource: '5' }))
    );

    // Reelt commit sætter pending-guarden (target '7' != formattedValueAtCommit '5').
    act(() => {
      result.current.executeSettle('7', {
        parse: validParse(7),
        isNoop: false,
        formattedValueAtCommit: '5',
        target: '7',
      }, noopEffects());
    });
    expect(result.current.pendingRef.current).not.toBeNull();

    // Inert-settle (tom draft uden krav) skal rydde guarden.
    act(() => {
      result.current.executeSettle('', {
        parse: inertParse(),
        isNoop: false,
        formattedValueAtCommit: '7',
        target: '7',
      }, noopEffects());
    });
    expect(result.current.pendingRef.current).toBeNull();
  });

  it('resync: en resyncDep-ændring re-kører resync selv når externalSource er uændret', () => {
    // Regression: uden resyncDeps ville en editor-luk / fokus-tab (isEditing/isFocused-skift) uden
    // ekstern kildeændring ikke re-køre resync, og en forældet draft kunne blive stående.
    let editing = true;
    const { result, rerender } = renderHook(
      (props: { editing: boolean }) =>
        useDraftLifecycle<number>(baseConfig({
          initialDraft: 'bruger-taster',
          externalSource: 'ekstern',
          currentFormattedValue: 'ekstern',
          isActivelyEditing: () => props.editing,
          resyncDeps: [props.editing],
        })),
      { initialProps: { editing } }
    );

    // Aktivt redigeret: draften holdes (ingen resync-væk).
    expect(result.current.draft).toBe('bruger-taster');

    // Redigering slutter (isEditing → false) UDEN ekstern kildeændring → resyncDep udløser genkørsel.
    editing = false;
    act(() => rerender({ editing }));
    expect(result.current.draft).toBe('ekstern');
  });
});
