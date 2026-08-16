import type { StamdataValues } from '../../schemas/formSchemas';
import { isoToDanish, type ISODateString } from '../../types/branded';
import { resolveStamdataDatoReference } from '../policies/stamdataCalculations';

export type StamdataDateOrderField = 'skadedato' | 'skadelidteFodselsdato';

export type StamdataDateOrderIssue = Readonly<{
  field: StamdataDateOrderField;
  message: string;
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
    & Partial<Pick<StamdataValues, 'skadestype'>>
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
          {
            field: 'skadedato',
            message: `Der er angivet en ${resolveStamdataDatoReference(values.skadestype).label.toLowerCase()} før skadelidtes fødselsdato (${isoToDanish(skadelidteFodselsdato)})`,
          },
          {
            field: 'skadelidteFodselsdato',
            message: `Fødselsdatoen ligger efter den angivne ${resolveStamdataDatoReference(values.skadestype).label.toLowerCase()} (${isoToDanish(skadedato)})`,
          },
        ]
      : [],
  };
};
