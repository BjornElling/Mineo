/**
 * Fryser et JSON-kompatibelt objekt rekursivt. Inputaggregatet består udelukkende af
 * schema-validerede JSON-værdier, så samme revision ikke må kunne ændres gennem en delt reference.
 */
export const deepFreeze = <T>(value: T, seen = new WeakSet<object>()): DeepReadonly<T> => {
  if (value === null || typeof value !== 'object' || seen.has(value)) return value as DeepReadonly<T>;

  seen.add(value);
  for (const nested of Object.values(value)) deepFreeze(nested, seen);
  return Object.freeze(value) as DeepReadonly<T>;
};

/** Danner et isoleret, rekursivt frosset snapshot af schema-validerede JSON-data. */
export const cloneAndDeepFreeze = <T>(value: T): DeepReadonly<T> => deepFreeze(structuredClone(value));
export type DeepReadonly<T> = T extends string | number | boolean | bigint | symbol | null | undefined
  ? T
  : T extends (...args: never[]) => unknown
    ? T
    : T extends readonly (infer TItem)[]
      ? readonly DeepReadonly<TItem>[]
      : T extends object
        ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
        : T;
