import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, Checkbox, FormControlLabel, Tooltip } from '@mui/material';
import { Download, ErrorOutline, WarningAmber } from '@mui/icons-material';
import ContentBox from '../../layout/ContentBox';
import { useFieldErrorsBySourceForSection } from '../../../hooks/useFormFieldErrors';
import { usePersistedSection } from '../../../hooks/usePersistedSection';
import { collectAllDebugRows } from '../../../domain/erstatningsopgoerelse/eoDebugRowAggregator';
import type { NavigationTarget } from '../../../domain/erstatningsopgoerelse/eoDebugNavigationMap';
import { scrollToSection } from '../../../utils/scrollToSection';
import { loadErstatningsopgoerelsePdfModule } from '../../../utils/pdf/pdfLoader';
import { formatISOToDanish } from '../../../utils/dateValidation';
import { MONTH_NAMES_DA } from '../../../utils/dateFormatting';
import { useErstatningsopgoerelseAggregation } from '../../../calculation/useErstatningsopgoerelseAggregation';
import AggregationResultView from './components/AggregationResultView';
import { useAppSettings } from '../../../contexts/AppSettingsContext';
import { getVisBrevhoved } from '../../../utils/pdf/pdfBrevhoved';

const formatDateLongDisplay = (isoDate: string | undefined): string => {
  const danish = formatISOToDanish(isoDate ?? '');
  if (!danish) return '-';
  const [day, month, year] = danish.split('-');
  const dayNumber = parseInt(day, 10);
  const monthIndex = parseInt(month, 10) - 1;
  if (
    !Number.isFinite(dayNumber) ||
    !Number.isFinite(monthIndex) ||
    monthIndex < 0 ||
    monthIndex >= MONTH_NAMES_DA.length
  ) {
    return '-';
  }
  return `${dayNumber}. ${MONTH_NAMES_DA[monthIndex]} ${year}`;
};

type TabKey = 'eo_oplysninger' | 'loenindkomst' | 'offentlige_ydelser' | 'beregning' | 'debug' | 'debug_tabel';

interface BeregningTabProps {
  setActiveTab: (tab: TabKey) => void;
  isActive: boolean;
}

/**
 * Beregning-fanen - Viser fejl/warnings fra EODebug + download-funktionalitet
 *
 * Denne komponent er en "dumb" visningsside der:
 * - Genbruger al EODebug-funktionalitet via eoDebugRowAggregator
 * - Viser fejl og warnings i separate ContentBox'e
 * - Tilbyder navigation til fejlkilder med scroll-to-sektion
 * - Forbereder download-funktionalitet (inaktiv i denne version)
 */
const BeregningTab = React.memo<BeregningTabProps>(({ setActiveTab, isActive }) => {
  // ============================================================================
  // DATA INDSAMLING FRA FORMPERSISTENCE
  // ============================================================================

  const navigate = useNavigate();
  const { settings } = useAppSettings();
  const stamdataValues = usePersistedSection('stamdata');
  const eoValues = usePersistedSection('erstatningsopgoerelse');
  const stamdataErrors = useFieldErrorsBySourceForSection('stamdata');
  const eoErrors = useFieldErrorsBySourceForSection('erstatningsopgoerelse');

  // ============================================================================
  // SAMLE ALLE DEBUG-ROWS MED NAVIGATION
  // ============================================================================

  const { errors, warnings, allRows } = React.useMemo(() => {
    if (!isActive) {
      return { errors: [], warnings: [], allRows: [] };
    }
    // Return tom liste hvis data ikke er loaded endnu
    if (!stamdataValues || !eoValues) {
      return { errors: [], warnings: [], allRows: [] };
    }

    return collectAllDebugRows(stamdataValues, stamdataErrors, eoValues, eoErrors);
  }, [isActive, stamdataValues, stamdataErrors, eoValues, eoErrors]);

  // ============================================================================
  // SAMLET ERSTATNINGSOPGØRELSE (AGGREGATION)
  // ============================================================================

  const aggregationResult = useErstatningsopgoerelseAggregation(isActive);

  // ============================================================================
  // NAVIGATION-HÅNDTERING
  // ============================================================================

  /**
   * Ekstraher fejlmeddelelse fra displayValue
   *
   * Format: "Fejl (meddelelse)" eller "Advarsel (meddelelse)" eller bare værdi
   * Returner: meddelelsen UDEN "Fejl:" prefix, eller "(Indtastning mangler)" hvis tom værdi
   */
  const extractErrorMessage = React.useCallback((displayValue: string): string => {
    // Tjek om værdien er tom (bindestreg)
    if (displayValue === '-' || displayValue.trim() === '') {
      return '(Indtastning mangler)';
    }

    // Tjek om displayValue indeholder "Fejl (" eller "Advarsel ("
    const fejlMatch = displayValue.match(/^Fejl \((.+)\)$/);
    if (fejlMatch) {
      return `(${fejlMatch[1]})`;
    }

    const advarselMatch = displayValue.match(/^Advarsel \((.+)\)$/);
    if (advarselMatch) {
      return `(${advarselMatch[1]})`;
    }

    // Hvis displayValue ikke matcher pattern, returner "(Indtastning mangler)"
    return '(Indtastning mangler)';
  }, []);

  const handleNavigate = React.useCallback(
    (target: NavigationTarget) => {
      switch (target.kind) {
        case 'erstatningsopgoerelse-tab':
          // Switch til korrekt fane
          setActiveTab(target.tabId);
          // Scroll til sektion hvis angivet
          if (target.sectionId) {
            scrollToSection(target.sectionId);
          }
          break;

        case 'stamdata-page':
          // Naviger til Stamdata-siden
          navigate('/stamdata');
          break;

        case 'unsupported':
          if (process.env.NODE_ENV === 'development') {
            console.warn(`Navigation ikke understøttet: ${target.reason}`);
          }
          break;

        default: {
          // Exhaustiveness check - TypeScript sikrer at alle cases er håndteret
          const _exhaustive: never = target;
          return _exhaustive;
        }
      }
    },
    [setActiveTab, navigate]
  );

  // ============================================================================
  // CHECKBOX STATE FOR ERSTATNINGSOPGØRELSE-DOWNLOAD
  // ============================================================================

  const selectedElements = React.useMemo(
    () => ({
      opgoerelse: true,
      loenindkomst: false,
      offentligeYdelser: false,
      shDage: false,
      regulering: false,
      okSatser: false,
      sygeferiegodtgoerelse: false,
    }),
    []
  );

  const skadelidteNavn = typeof stamdataValues?.skadelidte === 'string' ? stamdataValues.skadelidte.trim() : '';
  const visSkadelidteNavn = skadelidteNavn !== '';

  const svieSmerteRow = allRows.find((row) => row.id === 'sviesmerte.beregnetPeriode');
  const svieSmerteDisplayParts = (svieSmerteRow?.displayValue ?? '-')
    .split('\n')
    .map((value) => value.trim())
    .filter((value) => value !== '' && value !== '-');
  const svieSmerteLines = svieSmerteDisplayParts;
  const svieSmerteLabel = svieSmerteLines.length > 1 ? 'Svie/smerteperioder' : 'Svie/smerteperiode';
  const harSvieSmertePerioder =
    (eoValues?.svieSmertePerioder ?? []).some((row) => row.fra || row.til || row.tilstand) && svieSmerteLines.length > 0;

  const tafRows = allRows.filter((row) => row.id.startsWith('taf.periode.'));
  const tafPerioderLabels = tafRows
    .filter((row) => row.id !== 'taf.periode.empty' && row.label.trim() !== '-')
    .map((row) => {
      const match = row.label.match(/\(([^)]+)\)/);
      return match ? match[1].trim() : row.label.trim();
    })
    .filter((value) => value !== '');
  const harTafPerioder =
    (eoValues?.tafPerioder ?? []).some((row) => row.fra || row.til || typeof row.loseFeriedage === 'number') &&
    tafPerioderLabels.length > 0;
  const tafPerioderLines = tafPerioderLabels;
  const tafPerioderLabel = tafPerioderLines.length > 1 ? 'TAF-perioder' : 'TAF-periode';

  const erErhvervssygdom = stamdataValues?.skadestype === 'Erhvervssygdom';
  const skadesdatoLabel = erErhvervssygdom ? 'Anmeldelsesdato' : 'Skadesdato';
  const skadesdatoDisplay = formatDateLongDisplay(stamdataValues?.skadesdato);

  const erRevideret = eoValues?.revideretOpgoerelse === 'Ja';
  const revideretPrefix = erRevideret ? 'Revideret ' : '';
  const erstatningsord = erRevideret ? 'erstatningsopgørelse' : 'Erstatningsopgørelse';
  const eoNummer = eoValues?.eoNummer?.trim() ?? '';
  const eoLedsagetekst = eoValues?.eoLedsagetekst?.trim() ?? '';
  const eoNummerPart = eoNummer ? ` ${eoNummer}` : '';
  const eoLedsagetekstPart = eoLedsagetekst ? ` (${eoLedsagetekst})` : '';
  const erstatningsopgoerelseTitel = `${revideretPrefix}${erstatningsord}${eoNummerPart}${eoLedsagetekstPart}`.trim();

  // ============================================================================
  // PDF DOWNLOAD-HÅNDTERING
  // ============================================================================

  const handleDownloadPdf = React.useCallback(async () => {
    if (!stamdataValues || !eoValues) {
      console.error('Manglende data for PDF-generering');
      return;
    }

    // Udled visBrevhoved fra settings
    const visBrevhoved = getVisBrevhoved(settings, 'erstatningsopgoerelse');

    try {
      const { generateErstatningsopgoerelsePdf } = await loadErstatningsopgoerelsePdfModule();
      generateErstatningsopgoerelsePdf(stamdataValues, eoValues, selectedElements, { visBrevhoved });
    } catch (error) {
      console.error('Kunne ikke indlæse PDF-modulet for erstatningsopgørelse:', error);
    }
  }, [stamdataValues, eoValues, selectedElements, settings]);

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <Box>
      {/* ========================================================================
          CONTENTBOX 1: FEJL
          ======================================================================== */}
      {errors.length > 0 && (
        <ContentBox>
          <Typography className="section-header">Fejl</Typography>
          {errors.map((row) => {
            const errorMessage = extractErrorMessage(row.displayValue);
            return (
              <Box key={row.id} className="row--label-right-hover" sx={{ '--label-width': '400px' }}>
                <Typography className="row--text">
                  {row.label} {errorMessage}
                </Typography>
                <Box className="row--label-right-hover__content" sx={{ gap: 1 }}>
                  {row.navigation.kind === 'erstatningsopgoerelse-tab' && (
                    <>
                      <Typography className="row--text">
                        {row.navigation.tabName} {'->'}{' '}
                      </Typography>
                      <Typography
                        className="row--text icon-text-link"
                        component="span"
                        onClick={() => handleNavigate(row.navigation)}
                        sx={{ cursor: 'pointer' }}
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
                        component="span"
                        onClick={() => handleNavigate(row.navigation)}
                        sx={{ cursor: 'pointer' }}
                      >
                        {row.navigation.sectionTitle}
                      </Typography>
                    </>
                  )}
                  {row.navigation.kind === 'unsupported' && (
                    <Typography className="row--text">{row.navigation.displayPath}</Typography>
                  )}
                  <ErrorOutline sx={{ color: 'red', fontSize: 20 }} />
                </Box>
              </Box>
            );
          })}
        </ContentBox>
      )}
      {/* ========================================================================
          CONTENTBOX 2: ADVARSLER
          ======================================================================== */}
      {warnings.length > 0 && (
        <ContentBox>
          <Typography className="section-header">Advarsler</Typography>
          {warnings.map((row) => {
            const warningMessage = extractErrorMessage(row.displayValue);
            return (
              <Box key={row.id} className="row--label-right-hover" sx={{ '--label-width': '400px' }}>
                <Typography className="row--text">
                  {row.label} {warningMessage}
                </Typography>
                <Box className="row--label-right-hover__content" sx={{ gap: 1 }}>
                  {row.navigation.kind === 'erstatningsopgoerelse-tab' && (
                    <>
                      <Typography className="row--text">
                        {row.navigation.tabName} {'->'}{' '}
                      </Typography>
                      <Typography
                        className="row--text icon-text-link"
                        component="span"
                        onClick={() => handleNavigate(row.navigation)}
                        sx={{ cursor: 'pointer' }}
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
                        component="span"
                        onClick={() => handleNavigate(row.navigation)}
                        sx={{ cursor: 'pointer' }}
                      >
                        {row.navigation.sectionTitle}
                      </Typography>
                    </>
                  )}
                  {row.navigation.kind === 'unsupported' && (
                    <Typography className="row--text">{row.navigation.displayPath}</Typography>
                  )}
                  <WarningAmber sx={{ color: 'orange', fontSize: 20 }} />
                </Box>
              </Box>
            );
          })}
        </ContentBox>
      )}
      {/* ========================================================================
          CONTENTBOX 3: ERSTATNINGSOPGØRELSE (DOWNLOAD)
          ======================================================================== */}
      <ContentBox>
        <Typography className="section-header">Beregning</Typography>

        {visSkadelidteNavn ? (
          <Box className="row--label-right-hover">
            <Typography className="row--text" sx={{ fontWeight: '500 !important' }}>
              {skadelidteNavn}
            </Typography>
            <Box className="row--label-right-hover__content">
              <Typography className="row--text" sx={{ fontWeight: '500 !important' }}>
                {erstatningsopgoerelseTitel}
              </Typography>
            </Box>
          </Box>
        ) : (
          <Box className="row--label-right-hover">
            <Typography className="row--text" sx={{ fontWeight: '500 !important' }}>
              {erstatningsopgoerelseTitel}
            </Typography>
            <Box className="row--label-right-hover__content" />
          </Box>
        )}

        <Box className="row--label-right-hover">
          <Typography className="row--text">{skadesdatoLabel}</Typography>
          <Box className="row--label-right-hover__content">
            <Typography className="row--text">{skadesdatoDisplay}</Typography>
          </Box>
        </Box>

        {aggregationResult?.kind === 'ok' && (
          <Box className="row--label-right-hover">
            <Typography className="row--text">Samlet erstatningsopgørelse</Typography>
            <Box className="row--label-right-hover__content" sx={{ flexDirection: 'column', alignItems: 'flex-end' }}>
              <AggregationResultView total={aggregationResult.total} />
            </Box>
          </Box>
        )}

        {harSvieSmertePerioder && (
          <Box className="row--label-right-hover">
            <Typography className="row--text">{svieSmerteLabel}</Typography>
            <Box
              className="row--label-right-hover__content"
              sx={{
                flexDirection: 'column',
                alignItems: 'flex-end',
                gap: 0,
              }}
            >
              {svieSmerteLines.map((line, index) => (
                <Typography key={`${line}-${index}`} className="row--text" sx={{ minHeight: 'unset', lineHeight: 1.2 }}>
                  {line}
                </Typography>
              ))}
            </Box>
          </Box>
        )}

        {harTafPerioder && (
          <Box className="row--label-right-hover">
            <Typography className="row--text">{tafPerioderLabel}</Typography>
            <Box
              className="row--label-right-hover__content"
              sx={{
                flexDirection: 'column',
                alignItems: 'flex-end',
                gap: 0,
              }}
            >
              {tafPerioderLines.map((line, index) => (
                <Typography key={`${line}-${index}`} className="row--text" sx={{ minHeight: 'unset', lineHeight: 1.2 }}>
                  {line}
                </Typography>
              ))}
            </Box>
          </Box>
        )}

        {/* Download-knap */}
        <Box className="row--label-right-hover">
          <Typography className="row--text">Hent opgørelse</Typography>
          <Box className="row--label-right-hover__content">
            {errors.length === 0 && (
              <Box
                onClick={handleDownloadPdf}
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
                    backgroundColor: '#e3f2fd',
                  },
                  '&:active': {
                    backgroundColor: '#bbdefb',
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
            )}
            {errors.length > 0 && (
              <Tooltip
                title="Download ikke mulig, så længe der er fejl ovenfor"
                arrow
                placement="top"
              >
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
            )}
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
            className="row--label-right-hover__content"
            sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: 0,
              alignItems: 'flex-end',
              '& .MuiFormControlLabel-label.Mui-disabled': {
                color: 'text.primary',
                opacity: 1,
              },
            }}
          >
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <FormControlLabel
                control={<Checkbox checked={selectedElements.opgoerelse} disabled />}
                label="Opgørelse"
              />
            </Box>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <FormControlLabel
                control={<Checkbox checked={selectedElements.loenindkomst} disabled />}
                label="Lønindkomst"
              />
              <FormControlLabel
                control={<Checkbox checked={selectedElements.offentligeYdelser} disabled />}
                label="Offentlige ydelser"
              />
            </Box>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <FormControlLabel
                control={<Checkbox checked={selectedElements.shDage} disabled />}
                label="SH-dage"
              />
              <FormControlLabel
                control={<Checkbox checked={selectedElements.regulering} disabled />}
                label="Regulering"
              />
              <FormControlLabel
                control={<Checkbox checked={selectedElements.okSatser} disabled />}
                label="OK-satser"
              />
            </Box>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <FormControlLabel
                control={<Checkbox checked={selectedElements.sygeferiegodtgoerelse} disabled />}
                label="Sygeferiegodtgørelse"
              />
            </Box>
          </Box>
        </Box>
      </ContentBox>
    </Box>
  );
});

BeregningTab.displayName = 'BeregningTab';

export default BeregningTab;






