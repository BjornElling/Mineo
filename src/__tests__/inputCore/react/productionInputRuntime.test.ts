// @vitest-environment jsdom
import { bootstrapProductionInputRuntime } from '../../../inputCore/react/productionInputRuntime';
import { slimInputStore } from '../../../inputCore/runtime/slimInputStore';

describe('bootstrapProductionInputRuntime', () => {
  it('er idempotent og rehydrerer ikke ved gentagne kald', () => {
    sessionStorage.clear();
    const first = bootstrapProductionInputRuntime();
    const revision = slimInputStore.getState().revision;

    const second = bootstrapProductionInputRuntime();

    expect(second).toBe(first);
    expect(second.binding).toBe(first.binding);
    expect(slimInputStore.getState().revision).toBe(revision);
  });
});
