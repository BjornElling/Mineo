export type Primitive = string | number | boolean | bigint | symbol | null | undefined;

export type DeepReadonly<T> = T extends Primitive
  ? T
  : T extends (...args: never[]) => unknown
    ? T
    : T extends ReadonlyArray<infer U>
      ? ReadonlyArray<DeepReadonly<U>>
      : T extends object
        ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
        : T;
