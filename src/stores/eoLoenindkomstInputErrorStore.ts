import { createStore } from 'zustand/vanilla';

type EOLoenindkomstInputErrorState = {
  errors: Readonly<Record<string, true>>;
  setError: (ansaettelsesforholdId: string, hasError: boolean) => void;
  clearAll: () => void;
  replaceAll: (errors: Readonly<Record<string, true>>) => void;
};

const createEOLoenindkomstInputErrorStore = () =>
  createStore<EOLoenindkomstInputErrorState>((set) => ({
    errors: {},
    setError: (ansaettelsesforholdId, hasError) => {
      set((state) => {
        const nextHasError = Boolean(hasError);
        const prevHasError = Boolean(state.errors[ansaettelsesforholdId]);
        if (prevHasError === nextHasError) return state;
        const next = { ...state.errors };
        if (nextHasError) {
          next[ansaettelsesforholdId] = true;
        } else {
          delete next[ansaettelsesforholdId];
        }
        return { errors: next };
      });
    },
    clearAll: () => set({ errors: {} }),
    replaceAll: (errors) => set({ errors: { ...errors } }),
  }));

export const eoLoenindkomstInputErrorStore = createEOLoenindkomstInputErrorStore();
export const __createTestEOLoenindkomstInputErrorStore = createEOLoenindkomstInputErrorStore;
