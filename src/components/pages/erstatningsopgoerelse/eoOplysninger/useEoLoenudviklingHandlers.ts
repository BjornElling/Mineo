import React from 'react';
import type { StyledDropdownChangeEvent } from '../../../inputs/StyledDropdown';
import type { CommitEvent } from '../../../../types/fieldEvents';
import {
  type EOAngivetLoenLoenudvikling,
  krlSatstabelEnum,
  loenudviklingBeregningsgrundlagEnum,
  loenudviklingStatistikModelEnum,
  offentligLoenTypeEnum,
} from '../../../../schemas/formSchemas';
import { EO_ANGIVET_LOEN_ID } from '../../../../domain/erstatningsopgoerelse/helpers/angivetLoenHelpers';
import { applyLoenudviklingBeregningsgrundlagChange } from '../../../../domain/erstatningsopgoerelse/helpers/loenindkomstStateCleanup';
import { normalizeOptionalFreeText } from '../../../../domain/erstatningsopgoerelse/helpers/eoSharedUtils';
import { isOffentligOverenskomstId } from '../../../../data/overenskomstRates';

const EO_LOENINDKOMST_INPUT_ERROR_SUFFIX = ':loenindkomst';

type UpdateEoLoenudvikling = (
  updater: (prev: EOAngivetLoenLoenudvikling) => EOAngivetLoenLoenudvikling,
  origin?: { fieldPath?: string }
) => void;

type ReportDynamicFieldError = (fieldKey: string, message: string | undefined) => void;

type Params = Readonly<{
  updateEoLoenudvikling: UpdateEoLoenudvikling;
  reportDynamicFieldError: ReportDynamicFieldError;
}>;

export type EoLoenudviklingHandlers = Readonly<{
  handleLoenudviklingBeregningsgrundlagChange: (event: StyledDropdownChangeEvent<string | undefined>) => void;
  handleLoenudviklingStatistikModelChange: (event: StyledDropdownChangeEvent<string | undefined>) => void;
  handleLoenudviklingKRLSatstabelChange: (event: StyledDropdownChangeEvent<string | undefined>) => void;
  handleEoOverenskomstFilterChange: (filterType: 'loenmodtager' | 'arbejdsgiver', value: string | undefined) => void;
  handleEoOverenskomstChange: (event: StyledDropdownChangeEvent<string | undefined>) => void;
  handleOffentligLoenTypeChange: (event: StyledDropdownChangeEvent<string | undefined>) => void;
  handleOffentligLoenTrinCommit: (event: CommitEvent<number | undefined>) => void;
  handleOffentligLoenGruppeCommit: (event: CommitEvent<number | undefined>) => void;
  handleOffentligLoenEkstraGrundloenCommit: (event: CommitEvent<EOAngivetLoenLoenudvikling['offentligLoenEkstraGrundloen']>) => void;
  handleEoAnciennitetstillaegToggleCommit: (event: CommitEvent<boolean>) => void;
  handleEoAnciennitetstillaegDatoCommit: (event: CommitEvent<EOAngivetLoenLoenudvikling['anciennitetstillaegDato']>) => void;
  handleEoAnciennitetstillaegSatsCommit: (event: CommitEvent<EOAngivetLoenLoenudvikling['anciennitetstillaegSats']>) => void;
  handleLoenudviklingManuelNavnCommit: (event: CommitEvent<string | undefined>) => void;
  handleLoenudviklingManuelTableChange: (
    tableData: EOAngivetLoenLoenudvikling['loenudviklingManuelTableData'],
    origin?: { fieldPath?: string }
  ) => void;
  handleLoenudviklingManuelProcentsatsTableChange: (
    tableData: EOAngivetLoenLoenudvikling['loenudviklingManuelProcentsatsTableData'],
    origin?: { fieldPath?: string }
  ) => void;
  handleLoenudviklingManuelInputErrorChange: (hasError: boolean) => void;
}>;

/**
 * Page-lokale commit-handlers for lønudviklings-feltgruppen i EO-oplysninger-fanen.
 *
 * Hver handler committer via `updateEoLoenudvikling` med eksplicit `fieldPath`
 * (jf. mineo-field-pattern "Felt-identitets-API"). Ren strukturel udtrækning: adfærd
 * og commit-semantik er identisk med den tidligere inline-implementering.
 */
export const useEoLoenudviklingHandlers = ({
  updateEoLoenudvikling,
  reportDynamicFieldError,
}: Params): EoLoenudviklingHandlers => {
  const handleLoenudviklingBeregningsgrundlagChange = React.useCallback((event: StyledDropdownChangeEvent<string | undefined>) => {
    const parsed = loenudviklingBeregningsgrundlagEnum.safeParse(event.target.value);
    const next = parsed.success ? parsed.data : undefined;
    // Paritet med useLoenindkomstViewModel: når de manuelle reguleringstabeller afmonteres,
    // ryddes deres input-fejlflag — et efterladt ':loenindkomst'-flag ville ellers blokere
    // Gem som et usynligt spøgelses-mål.
    if (next !== 'Manuelt angivet' && next !== 'Manuel procentsats') {
      reportDynamicFieldError(`${EO_ANGIVET_LOEN_ID}${EO_LOENINDKOMST_INPUT_ERROR_SUFFIX}`, undefined);
    }
    updateEoLoenudvikling(
      (prev) => applyLoenudviklingBeregningsgrundlagChange(prev, next),
      { fieldPath: 'loenudviklingBeregningsgrundlag' }
    );
  }, [reportDynamicFieldError, updateEoLoenudvikling]);

  const handleLoenudviklingStatistikModelChange = React.useCallback((event: StyledDropdownChangeEvent<string | undefined>) => {
    const parsed = loenudviklingStatistikModelEnum.safeParse(event.target.value);
    updateEoLoenudvikling((prev) => ({
      ...prev,
      loenudviklingStatistikModel: parsed.success ? parsed.data : undefined,
    }), { fieldPath: 'loenudviklingStatistikModel' });
  }, [updateEoLoenudvikling]);

  const handleLoenudviklingKRLSatstabelChange = React.useCallback((event: StyledDropdownChangeEvent<string | undefined>) => {
    const parsed = krlSatstabelEnum.safeParse(event.target.value);
    updateEoLoenudvikling((prev) => ({
      ...prev,
      loenudviklingKRLSatstabel: parsed.success ? parsed.data : undefined,
    }), { fieldPath: 'loenudviklingKRLSatstabel' });
  }, [updateEoLoenudvikling]);

  const handleEoOverenskomstFilterChange = React.useCallback(
    (filterType: 'loenmodtager' | 'arbejdsgiver', value: string | undefined) => {
      updateEoLoenudvikling((prev) => ({
        ...prev,
        overenskomstFilter: {
          ...prev.overenskomstFilter,
          [filterType]: value,
        },
      }), { fieldPath: `overenskomstFilter.${filterType}` });
    },
    [updateEoLoenudvikling]
  );

  const handleEoOverenskomstChange = React.useCallback(
    (event: StyledDropdownChangeEvent<string | undefined>) => {
      const nextOverenskomstId = normalizeOptionalFreeText(event.target.value);
      updateEoLoenudvikling((prev) => ({
        ...prev,
        overenskomstId: nextOverenskomstId,
        loenudviklingBeregningsgrundlag: 'Overenskomst',
        offentligLoenType:
          nextOverenskomstId && isOffentligOverenskomstId(nextOverenskomstId)
            ? (prev.offentligLoenType ?? 'Månedsløn')
            : prev.offentligLoenType,
      }), { fieldPath: 'overenskomstId' });
    },
    [updateEoLoenudvikling]
  );

  const handleOffentligLoenTypeChange = React.useCallback((event: StyledDropdownChangeEvent<string | undefined>) => {
    const parsed = offentligLoenTypeEnum.safeParse(event.target.value);
    updateEoLoenudvikling((prev) => ({
      ...prev,
      offentligLoenType: parsed.success ? parsed.data : prev.offentligLoenType,
    }), { fieldPath: 'offentligLoenType' });
  }, [updateEoLoenudvikling]);

  const handleOffentligLoenTrinCommit = React.useCallback((event: CommitEvent<number | undefined>) => {
    updateEoLoenudvikling((prev) => ({
      ...prev,
      offentligLoenTrin: event.target.value,
    }), { fieldPath: 'offentligLoenTrin' });
  }, [updateEoLoenudvikling]);

  const handleOffentligLoenGruppeCommit = React.useCallback((event: CommitEvent<number | undefined>) => {
    updateEoLoenudvikling((prev) => ({
      ...prev,
      offentligLoenGruppe: event.target.value,
    }), { fieldPath: 'offentligLoenGruppe' });
  }, [updateEoLoenudvikling]);

  const handleOffentligLoenEkstraGrundloenCommit = React.useCallback((event: CommitEvent<EOAngivetLoenLoenudvikling['offentligLoenEkstraGrundloen']>) => {
    updateEoLoenudvikling((prev) => ({
      ...prev,
      offentligLoenEkstraGrundloen: event.target.value,
    }), { fieldPath: 'offentligLoenEkstraGrundloen' });
  }, [updateEoLoenudvikling]);

  const handleEoAnciennitetstillaegToggleCommit = React.useCallback((event: CommitEvent<boolean>) => {
    updateEoLoenudvikling((prev) => ({
      ...prev,
      harAnciennitetstillaegEfterSkadedatoen: event.target.value,
    }), { fieldPath: 'harAnciennitetstillaegEfterSkadedatoen' });
  }, [updateEoLoenudvikling]);

  const handleEoAnciennitetstillaegDatoCommit = React.useCallback((event: CommitEvent<EOAngivetLoenLoenudvikling['anciennitetstillaegDato']>) => {
    updateEoLoenudvikling((prev) => ({
      ...prev,
      anciennitetstillaegDato: event.target.value,
    }), { fieldPath: 'anciennitetstillaegDato' });
  }, [updateEoLoenudvikling]);

  const handleEoAnciennitetstillaegSatsCommit = React.useCallback((event: CommitEvent<EOAngivetLoenLoenudvikling['anciennitetstillaegSats']>) => {
    updateEoLoenudvikling((prev) => ({
      ...prev,
      anciennitetstillaegSats: event.target.value,
    }), { fieldPath: 'anciennitetstillaegSats' });
  }, [updateEoLoenudvikling]);

  const handleLoenudviklingManuelNavnCommit = React.useCallback((event: CommitEvent<string | undefined>) => {
    const trimmed = (event.target.value ?? '').trim();
    updateEoLoenudvikling((prev) => ({
      ...prev,
      loenudviklingManuelNavn: trimmed,
    }), { fieldPath: 'loenudviklingManuelNavn' });
  }, [updateEoLoenudvikling]);

  const handleLoenudviklingManuelTableChange = React.useCallback((
    tableData: EOAngivetLoenLoenudvikling['loenudviklingManuelTableData'],
    origin?: { fieldPath?: string }
  ) => {
    updateEoLoenudvikling((prev) => ({
      ...prev,
      loenudviklingManuelTableData: tableData,
    }), origin);
  }, [updateEoLoenudvikling]);

  const handleLoenudviklingManuelProcentsatsTableChange = React.useCallback((
    tableData: EOAngivetLoenLoenudvikling['loenudviklingManuelProcentsatsTableData'],
    origin?: { fieldPath?: string }
  ) => {
    updateEoLoenudvikling((prev) => ({
      ...prev,
      loenudviklingManuelProcentsatsTableData: tableData,
    }), origin);
  }, [updateEoLoenudvikling]);

  const handleLoenudviklingManuelInputErrorChange = React.useCallback((hasError: boolean) => {
    reportDynamicFieldError(
      `${EO_ANGIVET_LOEN_ID}${EO_LOENINDKOMST_INPUT_ERROR_SUFFIX}`,
      hasError ? 'Ugyldig manuel regulering' : undefined
    );
  }, [reportDynamicFieldError]);

  return {
    handleLoenudviklingBeregningsgrundlagChange,
    handleLoenudviklingStatistikModelChange,
    handleLoenudviklingKRLSatstabelChange,
    handleEoOverenskomstFilterChange,
    handleEoOverenskomstChange,
    handleOffentligLoenTypeChange,
    handleOffentligLoenTrinCommit,
    handleOffentligLoenGruppeCommit,
    handleOffentligLoenEkstraGrundloenCommit,
    handleEoAnciennitetstillaegToggleCommit,
    handleEoAnciennitetstillaegDatoCommit,
    handleEoAnciennitetstillaegSatsCommit,
    handleLoenudviklingManuelNavnCommit,
    handleLoenudviklingManuelTableChange,
    handleLoenudviklingManuelProcentsatsTableChange,
    handleLoenudviklingManuelInputErrorChange,
  };
};
