import type { FieldCodec, FieldDecimalPolicy } from '../../fieldCodec';
import type { FieldRef } from '../../fieldDescriptor';

/** Procentfeltets decimalregel læses fra codecets construction-time-konfiguration på alle UI-flader. */
export const codecAllowsDecimals = <T>(codec: FieldCodec<T>): boolean =>
  codec.decimalPolicy === 'decimal';

export const fieldAllowsDecimals = <T>(field: FieldRef<T>): boolean =>
  codecAllowsDecimals(field.descriptor.codec);

export const fieldDecimalPolicy = <T>(field: FieldRef<T>): FieldDecimalPolicy | undefined =>
  field.descriptor.codec.decimalPolicy;
