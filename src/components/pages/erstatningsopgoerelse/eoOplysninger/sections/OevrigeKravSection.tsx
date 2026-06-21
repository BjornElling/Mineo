import { Box, Typography } from '@mui/material';
import ContentBox from '../../../../layout/ContentBox';
import StyledRadioButton from '../../../../inputs/StyledRadioButton';
import OevrigeKravTable from '../../../../tables/OevrigeKravTable';
import { CellInvalidDraftScopeProvider } from '../../../../../contexts/CellInvalidDraftScopeContext';
import { CELL_TABLE_IDS } from '../../../../../config/cellInvalidDraftScopes';
import { dateRanges_erstatningsopgoerelse } from '../../../../../config/dateRanges';
import { erOevrigeKravSektionAktiv } from '../../../../../domain/erstatningsopgoerelse/helpers/eoInputRelevance';
import { useEoOplysningerVm } from '../eoOplysningerContext';
import { KRAV_JA_NEJ_SKJUL_OPTIONS } from '../eoOplysningerConstants';

/** Sektion 7: Øvrige erstatningskrav. */
export default function OevrigeKravSection() {
  const {
    values,
    handleJaNejSkjulChange,
    oevrigeKrav,
    oevrigeKravMinDate,
    skadedatoMinRule,
  } = useEoOplysningerVm();

  return (
      <ContentBox className="content-box" data-section-id="oevrige-krav">
        <Typography className="section-header">Øvrige erstatningskrav</Typography>

        <Box className="row--label-right-hover">
          <Typography className="row--text">Er der øvrige krav i erstatningsperioden</Typography>
          <Box className="row--label-right-hover__content">
            <StyledRadioButton
              name="kravPaaOevrigeErstatningskrav"
              value={values.kravPaaOevrigeErstatningskrav}
              onCommit={handleJaNejSkjulChange('kravPaaOevrigeErstatningskrav')}
              row={true}
              options={[...KRAV_JA_NEJ_SKJUL_OPTIONS]}
            />
          </Box>
        </Box>

        {erOevrigeKravSektionAktiv(values) && (
          <CellInvalidDraftScopeProvider pageKey="erstatningsopgoerelse" tableId={CELL_TABLE_IDS.eoOevrigeKrav}>
          <OevrigeKravTable
            rows={oevrigeKrav.draftRows}
            committedById={oevrigeKrav.committedById}
            onFieldChange={oevrigeKrav.onFieldChange}
            onRowBlur={oevrigeKrav.onRowBlur}
            onDeleteRow={oevrigeKrav.removeRow}
            onRowsReorder={oevrigeKrav.reorderRows}
            minDate={oevrigeKravMinDate}
            maxDate={dateRanges_erstatningsopgoerelse.tabelOevrigeKravDato.max}
            specialRangeErrors={{
              minBoundKind: skadedatoMinRule.minBoundKind,
              minBoundReferenceISO: skadedatoMinRule.minBoundReferenceISO,
            }}
            saveOrderPath="erstatningsopgoerelse.oevrigeKravPerioder"
          />
          </CellInvalidDraftScopeProvider>
        )}
      </ContentBox>
  );
}
