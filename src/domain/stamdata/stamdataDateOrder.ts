import type { StamdataValues } from '../../schemas/formSchemas';
import type { ISODateString } from '../../types/branded';

export const STAMDATA_DATE_ORDER_ERROR_MESSAGE = 'Skadedato er før fødselsdato.';

export type StamdataDateOrderField = 'skadedato' | 'skadelidteFodselsdato';

export type StamdataDateOrderIssue = Readonly<{
  field: StamdataDateOrderField;
  message: typeof STAMDATA_DATE_ORDER_ERROR_MESSAGE;
}>;

export type StamdataDateOrderResolution = Readonly<{
  skadedatoMin: ISODateString | undefined;
  skadelidteFodselsdatoMax: ISODateString | undefined;
  issues: readonly StamdataDateOrderIssue[];
}>;

/**
 * Ren domænevalidering af datoordenen. Persistence-schemaet validerer kun ISO-syntaks;
 * relationen forbliver derfor canonical og vises som et afledt issue på begge felter.
 */
export const resolveStamdataDateOrder = (
  values: Pick<StamdataValues, 'skadedato' | 'skadelidteFodselsdato'>
): StamdataDateOrderResolution => {
  const { skadedato, skadelidteFodselsdato } = values;
  const hasIssue = skadedato !== undefined
    && skadelidteFodselsdato !== undefined
    && skadedato < skadelidteFodselsdato;

  return {
    skadedatoMin: skadelidteFodselsdato,
    skadelidteFodselsdatoMax: skadedato,
    issues: hasIssue
      ? [
          { field: 'skadedato', message: STAMDATA_DATE_ORDER_ERROR_MESSAGE },
          { field: 'skadelidteFodselsdato', message: STAMDATA_DATE_ORDER_ERROR_MESSAGE },
        ]
      : [],
  };
};
