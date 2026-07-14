import React from 'react';
import type { CommitEvent, CommitHandler } from '../../../../types/fieldEvents';
import type { UsePersistedFormReturn } from '../../../../hooks/usePersistedForm';
import {
  type ErstatningsopgoerelseValues,
  type JaNejSkjul,
  jaNejSkjulEnum,
} from '../../../../schemas/formSchemas';
import type { AmountValue } from '../../../../schemas/amountExpressionSchema';
import type { ISODateString } from '../../../../types/branded';
import { coerceToISODateString } from '../../../../types/branded';

type JaNej = 'Ja' | 'Nej';

type StringLikeKeys = {
  [K in keyof ErstatningsopgoerelseValues]-?: ErstatningsopgoerelseValues[K] extends string | undefined ? K : never;
}[keyof ErstatningsopgoerelseValues];

type NumberLikeKeys = {
  [K in keyof ErstatningsopgoerelseValues]-?: ErstatningsopgoerelseValues[K] extends number | undefined ? K : never;
}[keyof ErstatningsopgoerelseValues];

type AmountLikeKeys = {
  [K in keyof ErstatningsopgoerelseValues]-?: ErstatningsopgoerelseValues[K] extends AmountValue | undefined ? K : never;
}[keyof ErstatningsopgoerelseValues];

type ToggleFieldName = {
  [K in keyof ErstatningsopgoerelseValues]-?: ErstatningsopgoerelseValues[K] extends JaNej ? K : never
}[keyof ErstatningsopgoerelseValues];

type JaNejSkjulFieldName = {
  [K in keyof ErstatningsopgoerelseValues]-?: ErstatningsopgoerelseValues[K] extends JaNejSkjul ? K : never
}[keyof ErstatningsopgoerelseValues];

export type IsoDateFieldName =
  | 'vedroererPeriodeFra'
  | 'vedroererPeriodeTil'
  | 'opgørelseLavetDen'
  | 'forligDato'
  | 'menAfgoerelseDato'
  | 'midlertidigEETAfgoerelseDato'
  | 'midlertidigEETVirkningsdato'
  | 'endeligEETAfgoerelseDato'
  | 'endeligEETVirkningsdato'
  | 'differencekravDato'
  | 'sidsteDagAnsaettelsesforhold'
  | 'tafBeregningsperiodeFra'
  | 'tafBeregningsperiodeTil'
  | 'angivetMaanedsloenOpreguleresFraDato'
  | 'angivetDagsloenOpreguleresFraDato';

type FormApi = Pick<UsePersistedFormReturn<ErstatningsopgoerelseValues>, 'setValues' | 'setFieldValue'>;

export type EoFieldCommitHandlers = Readonly<{
  handleToggleChange: (fieldName: ToggleFieldName) => CommitHandler<boolean>;
  handleJaNejSkjulChange: (fieldName: JaNejSkjulFieldName) => CommitHandler<string | undefined>;
  handleStringBlur: <K extends StringLikeKeys>(fieldName: K) => CommitHandler<string | undefined>;
  handleIntegerBlur: <K extends NumberLikeKeys>(fieldName: K) => CommitHandler<number | undefined>;
  handleNumberBlur: <K extends NumberLikeKeys>(fieldName: K) => CommitHandler<number | undefined>;
  handleAmountBlur: <K extends AmountLikeKeys>(fieldName: K) => CommitHandler<AmountValue | undefined>;
  commitField: <K extends keyof ErstatningsopgoerelseValues>(
    fieldName: K
  ) => CommitHandler<ErstatningsopgoerelseValues[K]>;
  handleIsoDateBlur: (fieldName: IsoDateFieldName) => CommitHandler<ISODateString | undefined>;
}>;

/**
 * Page-lokale commit-handler-factories for erstatningsopgørelse-feltgrupperne.
 *
 * Hver factory binder et feltnavn til en commit-handler, der committer via
 * setValues/setFieldValue og altid sender `fieldPath` (jf. mineo-field-pattern
 * "Felt-identitets-API"), så undo-fokus lander korrekt. Ren strukturel udtrækning:
 * adfærd og commit-semantik er identisk med den tidligere inline-implementering.
 */
export const useEoFieldCommitHandlers = ({ setValues, setFieldValue }: FormApi): EoFieldCommitHandlers => {
  const handleToggleChange = React.useCallback(
    (fieldName: ToggleFieldName): CommitHandler<boolean> =>
      (event: CommitEvent<boolean>) => {
        // Immediate-commit widget: send fieldPath, ellers gætter undo-origin via focus-trackeren,
        // som peger på det forrige (tekst)felt — derfor lander undo-fokus forkert (fejl B).
        return setValues((prev) => ({ ...prev, [fieldName]: event.target.value ? 'Ja' : 'Nej' }), {
          fieldPath: String(fieldName),
          clearInvalidDrafts: fieldName === 'oevrigtFravaerUdenLoen' && !event.target.value
            ? [{ pageKey: 'erstatningsopgoerelse', fieldPath: 'oevrigeFravaersdage' }]
            : [],
        });
      },
    [setValues]
  );

  // Immediate-commit radio for tre-tilstands-emnevalg (Ja/Nej/Skjul). Sender fieldPath af samme
  // undo-origin-grund som handleToggleChange.
  const handleJaNejSkjulChange = React.useCallback(
    (fieldName: JaNejSkjulFieldName): CommitHandler<string | undefined> =>
      (event: CommitEvent<string | undefined>) => {
        const parsed = jaNejSkjulEnum.safeParse(event.target.value);
        if (!parsed.success) return false;
        return setValues((prev) => ({ ...prev, [fieldName]: parsed.data }), { fieldPath: String(fieldName) });
      },
    [setValues]
  );

  /**
   * Handler til onBlur for string-felter (StyledTextField)
   * Trimmer og normaliserer til undefined hvis tom
   */
  const handleStringBlur = React.useCallback(
    <K extends StringLikeKeys>(fieldName: K) =>
      (event: CommitEvent<string | undefined>) => {
        const raw = event.target.value;
        const asString = typeof raw === 'string' ? raw : raw == null ? '' : String(raw);
        const trimmed = asString.trim();
        const nextValue = trimmed || undefined;
        return setValues((prev) => ({ ...prev, [fieldName]: nextValue }), { fieldPath: String(fieldName) });
      },
    [setValues]
  );

  /**
   * Handler til onBlur for integer-felter (StyledIntegerField)
   * Komponenten parser allerede til number | undefined
   */
  const handleIntegerBlur = React.useCallback(
    <K extends NumberLikeKeys>(fieldName: K) =>
      (event: CommitEvent<number | undefined>) => {
        return setValues((prev) => ({ ...prev, [fieldName]: event.target.value }), { fieldPath: String(fieldName) });
      },
    [setValues]
  );

  /**
   * Handler til onBlur for amount/percent/year-felter
   * Komponenten parser allerede til number | undefined
   */
  const handleNumberBlur = React.useCallback(
    <K extends NumberLikeKeys>(fieldName: K) =>
      (event: CommitEvent<number | undefined>) => {
        return setValues((prev) => ({ ...prev, [fieldName]: event.target.value }), { fieldPath: String(fieldName) });
      },
    [setValues]
  );

  /**
   * Handler til onBlur for amount-felter (expression-aware)
   */
  const handleAmountBlur = React.useCallback(
    <K extends AmountLikeKeys>(fieldName: K) =>
      (event: CommitEvent<AmountValue | undefined>) => {
        return setValues((prev) => ({ ...prev, [fieldName]: event.target.value }), { fieldPath: String(fieldName) });
      },
    [setValues]
  );

  const commitField = React.useCallback(
    <K extends keyof ErstatningsopgoerelseValues>(fieldName: K) =>
      (event: CommitEvent<ErstatningsopgoerelseValues[K]>) => {
        return setFieldValue(fieldName, event.target.value);
      },
    [setFieldValue]
  );

  const handleIsoDateBlur = React.useCallback(
    (fieldName: IsoDateFieldName) =>
      (event: CommitEvent<ISODateString | undefined>) => {
        const nextValue = coerceToISODateString(event.target.value ?? undefined);
        return setValues((prev) => {
          const next: ErstatningsopgoerelseValues = { ...prev };
          next[fieldName] = nextValue;
          return next;
        }, { fieldPath: String(fieldName) });
      },
    [setValues]
  );

  return {
    handleToggleChange,
    handleJaNejSkjulChange,
    handleStringBlur,
    handleIntegerBlur,
    handleNumberBlur,
    handleAmountBlur,
    commitField,
    handleIsoDateBlur,
  };
};
