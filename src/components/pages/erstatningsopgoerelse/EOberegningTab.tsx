import React from 'react';
import { Box, Typography, Checkbox, FormControlLabel, Tooltip, MenuItem } from '@mui/material';
import { Download, ErrorOutlined as ErrorOutline, WarningAmber } from '@mui/icons-material';
import ContentBox from '../../layout/ContentBox';
import InfoTooltipIcon from '../../common/InfoTooltipIcon';
import StyledDropdown from '../../inputs/StyledDropdown';
import { type EoBilagDynamicSelectionKey } from '../../../domain/erstatningsopgoerelse/helpers/eoBilagRules';
import {
  useEoBeregningViewModel,
  type EOberegningTabProps,
  type SystemIssueRow,
  type EetIssueRow,
} from './eoBeregning/useEoBeregningViewModel';

const EO_PDF_BLOCKED_BY_ERRORS_TOOLTIP = 'Opgørelse kan ikke hentes, når der er fejl ovenfor';

type SnapshotDownloadButtonProps = Readonly<{
  /** Om download er muligt for den aktuelle sag. */
  canDownload: boolean;
  /** Handler ved klik (kun aktiv når `canDownload`). */
  onClick: () => void;
  /** Brugervendt årsag til at download er spærret (vist som tooltip), eller null hvis ingen specifik årsag. */
  reason: string | null;
  /** Fallback-tooltip når `reason` er null. */
  fallbackTitle: string;
}>;

/**
 * Side-lokal download-ikonknap til snapshot-baserede dokumenter på beregningsfanen. Samler den tidligere
 * fire gange duplikerede ~95-linjers markup ét sted, så aktiv/spærret-tilstand, hover/active-styling og
 * tooltip er identiske på tværs af de fire knapper (opgørelse + tre alternative beregninger).
 */
const SnapshotDownloadButton = ({ canDownload, onClick, reason, fallbackTitle }: SnapshotDownloadButtonProps) => {
  if (canDownload) {
    return (
      <Box
        onClick={onClick}
        tabIndex={-1}
        sx={{
          width: '32px',
          height: '32px',
          borderRadius: '6px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          transition: 'background-color 0.2s',
          '&:hover': {
            backgroundColor: 'var(--color-icon-action-hover)',
          },
          '&:active': {
            backgroundColor: 'var(--color-icon-action-active)',
          },
        }}
      >
        <Download
          sx={{
            fontSize: '24px',
            color: 'primary.main',
          }}
        />
      </Box>
    );
  }

  return (
    <Tooltip title={reason ?? fallbackTitle} arrow placement="top">
      <Box
        tabIndex={-1}
        sx={{
          width: '32px',
          height: '32px',
          borderRadius: '6px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'default',
        }}
      >
        <Download
          sx={{
            fontSize: '24px',
            color: 'text.disabled',
          }}
        />
      </Box>
    </Tooltip>
  );
};

const FEJL_ADVARSLER_ROW_SX = {
  display: 'grid',
  gridTemplateColumns: '1fr max-content',
  alignItems: 'flex-start',
  gap: 1,
  '& > :first-of-type': {
    minWidth: 0,
    overflowWrap: 'break-word',
  },
  '& .row--label-right-hover__content': {
    minWidth: 'max-content',
    flexWrap: 'nowrap',
    whiteSpace: 'nowrap',
    alignSelf: 'flex-start',
  },
} as const;

const EOberegningTab = React.memo<EOberegningTabProps>((props) => {
  // View-model-laget ejer al afledt visningstilstand: debug-/issue-rækker, snapshot-projektioner,
  // download-gates, bilag-valg og PDF-handlers (jf. A1). Fanen beholder kun præsentations-render-helpers
  // + selve JSX'en.
  const vm = useEoBeregningViewModel(props);
  const {
    errors,
    warnings,
    eetLoebendeIssueRows,
    eetLoebendeErrorRows,
    eetLoebendeWarningRows,
    systemIssueRows,
    pdfDownloadErrorMessage,
    hasBlockingDebugErrors,
    eoPdfDisabledReason,
    tafPdfDisabledReason,
    tafOpreguleretPdfDisabledReason,
    tafKravGrafPdfDisabledReason,
    canDownloadSnapshotEoPdf,
    canDownloadSnapshotTafPdf,
    canDownloadSnapshotTafOpreguleretPdf,
    canDownloadSnapshotTafKravGrafPdf,
    handleDownloadPdf,
    handleDownloadTafFordeltPdf,
    handleDownloadTafOpreguleretPdf,
    handleDownloadTafKravGrafPdf,
    handleNavigate,
    selectedElements,
    bilagAvailability,
    updateSelectedElement,
    loenindkomstOgOffentligeYdelserIndgaar,
    updateLoenindkomstOgOffentligeYdelserIndgaar,
    svieSmerteSummaryLabel,
    svieSmerteSummaryLines,
    tafSummaryLabel,
    tafSummaryLines,
    skadedatoLabel,
    skadedatoDisplay,
    erstatningsopgoerelseTitel,
    formatSummaryText,
  } = vm;

  const renderDebugRows = React.useCallback((
    rows: ReadonlyArray<(typeof errors)[number]>,
    severity: 'error' | 'warning'
  ) => {
    const icon = severity === 'error'
      ? <ErrorOutline sx={{ color: 'var(--color-status-error)', fontSize: 20 }} />
      : <WarningAmber sx={{ color: 'var(--color-status-warning)', fontSize: 20 }} />;

    return rows.map((row) => (
      <Box
        key={row.id}
        className="row--label-right-hover"
        sx={{
          '--label-width': '400px',
          ...FEJL_ADVARSLER_ROW_SX,
        }}
      >
        <Typography className="row--text">{formatSummaryText(row)}</Typography>
        <Box className="row--label-right-hover__content" sx={{ gap: 1 }}>
          {row.navigation.kind === 'erstatningsopgoerelse-tab' && (
            <>
              <Typography className="row--text">
                {row.navigation.tabName} {'->'}{' '}
              </Typography>
              <Typography
                className="row--text icon-text-link"
                component="button"
                type="button"
                onClick={() => handleNavigate(row.navigation, row.id)}
                sx={{
                  cursor: 'pointer',
                  border: 0,
                  background: 'transparent',
                  p: 0,
                  m: 0,
                  font: 'inherit',
                }}
              >
                {row.navigation.sectionTitle}
              </Typography>
            </>
          )}
          {row.navigation.kind === 'stamdata-page' && (
            <>
              <Typography className="row--text">
                {row.navigation.pageName} {'->'}{' '}
              </Typography>
              <Typography
                className="row--text icon-text-link"
                component="button"
                type="button"
                onClick={() => handleNavigate(row.navigation, row.id)}
                sx={{
                  cursor: 'pointer',
                  border: 0,
                  background: 'transparent',
                  p: 0,
                  m: 0,
                  font: 'inherit',
                }}
              >
                {row.navigation.sectionTitle}
              </Typography>
            </>
          )}
          {row.navigation.kind === 'unsupported' && (
            <Typography className="row--text">{row.navigation.displayPath}</Typography>
          )}
          {icon}
        </Box>
      </Box>
    ));
  }, [formatSummaryText, handleNavigate]);

  const renderSystemIssueRows = React.useCallback((rows: readonly SystemIssueRow[]) => {
    return rows.map((row) => (
      <Box
        key={row.id}
        className="row--label-right-hover"
        sx={{
          '--label-width': '400px',
          ...FEJL_ADVARSLER_ROW_SX,
        }}
      >
        <Typography className="row--text">{row.message}</Typography>
        <Box
          className="row--label-right-hover__content"
          sx={{
            gap: 1,
            alignItems: row.actionLabel ? 'center' : 'flex-start',
          }}
        >
          {row.actionLabel && row.onAction && (
            <Typography
              className="row--text icon-text-link"
              component="button"
              type="button"
              onClick={row.onAction}
              sx={{
                cursor: 'pointer',
                border: 0,
                background: 'transparent',
                p: 0,
                m: 0,
                font: 'inherit',
              }}
            >
              {row.actionLabel}
            </Typography>
          )}
          <ErrorOutline
            sx={{
              color: 'var(--color-status-error)',
              fontSize: 20,
              alignSelf: row.actionLabel ? 'center' : 'flex-start',
            }}
          />
        </Box>
      </Box>
    ));
  }, []);

  const renderEetLoebendeIssueRows = React.useCallback((rows: readonly EetIssueRow[]) => {
    return rows.map((row) => (
      <Box
        key={row.id}
        className="row--label-right-hover"
        sx={{
          '--label-width': '400px',
          ...FEJL_ADVARSLER_ROW_SX,
        }}
      >
        <Typography className="row--text">{row.message}</Typography>
        <Box className="row--label-right-hover__content" sx={{ gap: 1 }}>
          <Typography className="row--text">
            Erhvervsevnetab {'->'}{' '}
          </Typography>
          <Typography
            className="row--text icon-text-link"
            component="button"
            type="button"
            onClick={row.onAction}
            sx={{
              cursor: 'pointer',
              border: 0,
              background: 'transparent',
              p: 0,
              m: 0,
              font: 'inherit',
            }}
          >
            Løbende ydelser
          </Typography>
          {row.severity === 'error' ? (
            <ErrorOutline sx={{ color: 'var(--color-status-error)', fontSize: 20 }} />
          ) : (
            <WarningAmber sx={{ color: 'var(--color-status-warning)', fontSize: 20 }} />
          )}
        </Box>
      </Box>
    ));
  }, []);

  const renderBilagCheckbox = React.useCallback((
    key: EoBilagDynamicSelectionKey,
    label: string
  ) => {
    const availability = bilagAvailability[key];
    const checkbox = (
      <FormControlLabel
        className="mineo-disabled-hover-target"
        control={(
          <Checkbox
            id={`eo-bilag-${key}`}
            name={`eo-bilag-${key}`}
            slotProps={{ input: { id: `eo-bilag-${key}`, name: `eo-bilag-${key}` } }}
            checked={selectedElements[key]}
            disabled={!availability.enabled}
            onChange={(event) => {
              updateSelectedElement(key, event.target.checked);
            }}
          />
        )}
        label={label}
        sx={{ mr: 0 }}
      />
    );

    if (availability.enabled || !availability.disabledReason) {
      return <React.Fragment key={key}>{checkbox}</React.Fragment>;
    }

    return (
      <Tooltip key={key} title={availability.disabledReason} arrow placement="top">
        <Box component="span" className="mineo-disabled-hover-target">{checkbox}</Box>
      </Tooltip>
    );
  }, [bilagAvailability, selectedElements, updateSelectedElement]);

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <Box>
      {(pdfDownloadErrorMessage || systemIssueRows.length > 0 || errors.length > 0 || warnings.length > 0 || eetLoebendeIssueRows.length > 0) && (
        <ContentBox>
          <Typography className="section-header">Fejl og advarsler</Typography>
          {pdfDownloadErrorMessage && (
            <Box
              className="row--label-right-hover"
              sx={{
                '--label-width': '400px',
                ...FEJL_ADVARSLER_ROW_SX,
              }}
            >
              <Typography className="row--text">{pdfDownloadErrorMessage}</Typography>
              <Box className="row--label-right-hover__content" sx={{ gap: 1 }}>
                <ErrorOutline sx={{ color: 'var(--color-status-error)', fontSize: 20 }} />
              </Box>
            </Box>
          )}
          {renderSystemIssueRows(systemIssueRows)}
          {renderDebugRows(errors, 'error')}
          {renderEetLoebendeIssueRows(eetLoebendeErrorRows)}
          {renderDebugRows(warnings, 'warning')}
          {renderEetLoebendeIssueRows(eetLoebendeWarningRows)}
        </ContentBox>
      )}
      <ContentBox>
        <Typography className="section-header">Beregning</Typography>

        <Box className="row--label-right-hover">
          <Typography className="row--text" sx={{ fontWeight: '500 !important' }}>
            {erstatningsopgoerelseTitel}
          </Typography>
          <Box className="row--label-right-hover__content" />
        </Box>

        <Box className="row--label-right-hover">
          <Typography className="row--text">{skadedatoLabel}</Typography>
          <Box className="row--label-right-hover__content">
            <Typography className="row--text">{skadedatoDisplay}</Typography>
          </Box>
        </Box>

        <Box className="row--label-right-hover">
          <Typography className="row--text">{svieSmerteSummaryLabel}</Typography>
          <Box
            className="row--label-right-hover__content"
            sx={{
              flexDirection: 'column',
              alignItems: 'flex-end',
              gap: 0,
            }}
          >
            {svieSmerteSummaryLines.map((line, index) => (
              <Typography key={`${line}-${index}`} className="row--text" sx={{ minHeight: 'unset', lineHeight: 1.2 }}>
                {line}
              </Typography>
            ))}
          </Box>
        </Box>

        <Box className="row--label-right-hover">
          <Typography className="row--text">{tafSummaryLabel}</Typography>
          <Box
            className="row--label-right-hover__content"
            sx={{
              flexDirection: 'column',
              alignItems: 'flex-end',
              gap: 0,
            }}
          >
            {tafSummaryLines.map((line, index) => (
              <Typography key={`${line}-${index}`} className="row--text" sx={{ minHeight: 'unset', lineHeight: 1.2 }}>
                {line}
              </Typography>
            ))}
          </Box>
        </Box>

        {/* Download-knap */}
        <Box className="row--label-right-hover">
          <Typography className="row--text">Hent opgørelse</Typography>
          <Box className="row--label-right-hover__content">
            <SnapshotDownloadButton
              canDownload={canDownloadSnapshotEoPdf}
              onClick={handleDownloadPdf}
              reason={hasBlockingDebugErrors ? EO_PDF_BLOCKED_BY_ERRORS_TOOLTIP : eoPdfDisabledReason}
              fallbackTitle="Opgørelsen kan ikke hentes for den aktuelle sag."
            />
          </Box>
        </Box>
      </ContentBox>

      <ContentBox>
        <Typography className="section-header">Bilag</Typography>

        <Box className="row--label-right-hover">
          <Typography className="row--text" sx={{ alignSelf: 'flex-start' }}>
            Vælg elementer, der skal indgå
          </Typography>
          <Box
            className="row--label-right-hover__content disabled-hover-checkbox-group"
            sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: 0,
              alignItems: 'flex-end',
              '& .MuiFormControlLabel-label': {
                fontFamily: 'var(--font-family-base)',
                fontSize: '15px',
                fontWeight: 'var(--font-weight-regular)',
                lineHeight: 'var(--line-height-base)',
                color: 'var(--mineo-color-row-text)',
              },
            }}
          >
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <Box component="span" className="mineo-disabled-hover-target">
                <FormControlLabel
                  className="mineo-disabled-hover-target"
                  control={(
                    <Checkbox
                      id="eo-bilag-opgoerelse"
                      name="eo-bilag-opgoerelse"
                      slotProps={{ input: { id: 'eo-bilag-opgoerelse', name: 'eo-bilag-opgoerelse' } }}
                      checked={selectedElements.opgoerelse}
                      disabled
                    />
                  )}
                  label="Opgørelse"
                />
              </Box>
              {renderBilagCheckbox('loenindkomst', 'Lønindkomst')}
              {renderBilagCheckbox('offentligeYdelser', 'Offentlige ydelser')}
              {renderBilagCheckbox('midlertidigEet', 'Midlertidig EET')}
            </Box>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {renderBilagCheckbox('regulering', 'Regulering')}
              {renderBilagCheckbox('shDage', 'SH-dage')}
              {renderBilagCheckbox('sygeferiegodtgoerelse', 'Sygeferiegodtgørelse')}
            </Box>
          </Box>
        </Box>

        <Box className="row--label-right-hover">
          <Typography className="row--text">Lønindkomst og offentlige ydelser, der indsættes som bilag</Typography>
          <Box className="row--label-right-hover__content">
            <StyledDropdown
              name="eoBilagLoenindkomstOgOffentligeYdelserIndgaar"
              allowEmpty={false}
              value={loenindkomstOgOffentligeYdelserIndgaar}
              onChange={updateLoenindkomstOgOffentligeYdelserIndgaar}
              width={150}
            >
              <MenuItem value="Alle">Alle</MenuItem>
              <MenuItem value="Perioden">Perioden</MenuItem>
            </StyledDropdown>
          </Box>
        </Box>
      </ContentBox>

      <ContentBox>
        <Typography className="section-header">Alternative beregninger</Typography>

        <Box className="row--label-right-hover">
          <Typography className="row--text">
            TAF-krav fordelt på kalenderår
            <InfoTooltipIcon title={'Til brug for skattemyndighedernes\nfordeling på relevante skatteår'} />
          </Typography>
          <Box className="row--label-right-hover__content">
            <SnapshotDownloadButton
              canDownload={canDownloadSnapshotTafPdf}
              onClick={handleDownloadTafFordeltPdf}
              reason={tafPdfDisabledReason}
              fallbackTitle="TAF fordelt på år kan ikke genereres for den aktuelle sag."
            />
          </Box>
        </Box>

        <Box className="row--label-right-hover">
          <Typography className="row--text">
            TAF opreguleret til beregningsåret
            <InfoTooltipIcon title={'Svarende til beregning ved offererstatning og patientskade'} />
          </Typography>
          <Box className="row--label-right-hover__content">
            <SnapshotDownloadButton
              canDownload={canDownloadSnapshotTafOpreguleretPdf}
              onClick={handleDownloadTafOpreguleretPdf}
              reason={tafOpreguleretPdfDisabledReason}
              fallbackTitle="TAF opreguleret til beregningsåret kan ikke genereres for den aktuelle sag."
            />
          </Box>
        </Box>

        <Box className="row--label-right-hover">
          <Typography className="row--text">
            Visuel graf over indtægtsniveau
          </Typography>
          <Box className="row--label-right-hover__content">
            <SnapshotDownloadButton
              canDownload={canDownloadSnapshotTafKravGrafPdf}
              onClick={handleDownloadTafKravGrafPdf}
              reason={tafKravGrafPdfDisabledReason}
              fallbackTitle="Visuel graf over indtægtsniveau kan ikke genereres for den aktuelle sag."
            />
          </Box>
        </Box>
      </ContentBox>

    </Box>
  );
});

EOberegningTab.displayName = 'EOberegningTab';

export default EOberegningTab;
