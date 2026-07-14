import React from 'react';
import { Box, Typography } from '@mui/material';
import DocumentDownloadButton from '../inputs/DocumentDownloadButton';
import StyledYearField from '../inputs/StyledYearField';
import { satserAngivAarYearBounds } from '../../data/lovbestemteRates';
import { downloadSatserDokument } from '../../document/service/documentService';
import { usePersistedForm } from '../../hooks/usePersistedForm';
import { satserSchema } from '../../schemas/formSchemas';
import {
  getCommittedChangeCounterSnapshot,
  getInvalidDraftForFieldSnapshot,
  getPersistedSectionSnapshot,
  useCombinedSectionRevisionSelector,
  useInvalidDraftForFieldSelector,
} from '../../hooks/useFormPersistenceSelectors';
import { useFormFieldErrorReporter } from '../../hooks/useFormFieldErrors';
import { useAppSettings } from '../../contexts/useAppSettings';
import { resolveSatserAargangErrorMessage } from '../../domain/policies';
import { documentGateFromBlockers } from '../../domain/inputIntegrity/inputBlockerGate';
import { SATSER_INITIAL_VALUES } from '../../domain/satser/satserInitialValues';
import { buildSatserInputProjection } from '../../domain/satser/satserInputProjection';
import { useOptionalCriticalActionCoordinator } from '../../criticalActions/CriticalActionContext';
import ContentBox from '../layout/ContentBox';
import InfoTooltipIcon from '../common/InfoTooltipIcon';
import { formatAsAmount, formatKr, formatPercent } from '../../utils/formatUtils';
import type { RetsinfoLink } from '../../data/retsinfoLinks';

/**
 * Formaterer et enkelt kronebeløb til dansk format via den kanoniske `formatKr`.
 * Null/undefined giver tom streng, så `DataRow` skjuler rækken.
 */
const formatKroner = (value: number | null | undefined): string =>
  value === null || value === undefined ? '' : formatKr(value, 0);

/**
 * Side-lokal komposition: to kronebeløb adskilt af "/". Bruger den kanoniske
 * `formatAsAmount` til talformatet og sætter selv den fælles "kr."-enhed til sidst.
 */
const formatKronerPair = (
  first: number | null | undefined,
  second: number | null | undefined
): string => {
  if (first === null || first === undefined || second === null || second === undefined) return '';
  return `${formatAsAmount(first, 0)} / ${formatAsAmount(second, 0)} kr.`;
};

/**
 * Side-lokal komposition: kronebeløb pr. enhed (fx "kr./sygedag"). Bygger på den
 * kanoniske `formatKr` og tilføjer enhedssuffikset.
 */
const formatKronerPerEnhed = (value: number | null | undefined, enhed: string): string => {
  if (value === null || value === undefined) return '';
  return `${formatKr(value, 0)}/${enhed}`;
};

const formatOptionalPercent = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return '';
  return formatPercent(value);
};

/**
 * Række-komponent for label-værdi par
 */
interface DataRowProps {
  label: string;
  value: React.ReactNode;
  rightAlign?: boolean;
}

const DataRow = ({ label, value, rightAlign = true }: DataRowProps) => {
  // Skjul hele rækken hvis der ikke er nogen værdi
  if (!value) return null;

  return (
    <Box className="row--label-right-hover">
      <Typography className="row--text">{label}:</Typography>
      <Box
        className="row--label-right-hover__content"
        sx={{
          justifyContent: rightAlign ? 'flex-end' : 'flex-start',
          textAlign: rightAlign ? 'right' : 'left',
        }}
      >
        {typeof value === 'string' ? (
          <Typography className="row--text">{value}</Typography>
        ) : (
          value
        )}
      </Box>
    </Box>
  );
};

interface MultiLineDataRowProps {
  rows: ReadonlyArray<Readonly<{ key: string; label: React.ReactNode; value: string | null | undefined }>>;
}

const MultiLineDataRow = ({ rows }: MultiLineDataRowProps) => {
  const visibleRows = rows.filter((row) => row.value);
  if (visibleRows.length === 0) return null;

  return (
    <Box className="row--label-right-hover">
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {visibleRows.map((row) => (
          <Typography key={row.key} className="row--text">{row.label}</Typography>
        ))}
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0, flex: 1, alignItems: 'flex-end', textAlign: 'right' }}>
        {visibleRows.map((row) => (
          <Typography key={row.key} className="row--text">{row.value}</Typography>
        ))}
      </Box>
    </Box>
  );
};

/**
 * Satser-komponent til visning af lovbestemte satser
 *
 * Indeholder information om relevante satser for erstatningsberegninger.
 */
const Satser = React.memo(() => {
  const MIN_SATSER_YEAR = satserAngivAarYearBounds.minYear;
  const MAX_SATSER_YEAR = satserAngivAarYearBounds.maxYear;

  const { values, setFieldValue } = usePersistedForm(
    satserSchema,
    'satser',
    SATSER_INITIAL_VALUES
  );

  const { settings } = useAppSettings();
  const criticalActions = useOptionalCriticalActionCoordinator();
  const inputRevision = useCombinedSectionRevisionSelector();

  // Binding til invalidDrafts (obligatorisk for persisterede sagsfelter, jf. mineo-field-pattern.md
  // "Felt-identitets-API" punkt 5). Uden denne binding ville en afsluttet ugyldig årgang kun leve i
  // useDraftField's lokale useState-fallback og aldrig nå store/read-model/download-gate.
  const aargangErrorReporter = useFormFieldErrorReporter('satser', 'aargang');
  const aargangInvalidDraft = useInvalidDraftForFieldSelector('satser', 'aargang');

  /**
   * Håndterer commit af årgangs-feltet (committed model value)
   */
  const handleYearCommit = React.useCallback(
    (e: { target: { value: number | undefined } }) => {
      return setFieldValue('aargang', e.target.value);
    },
    [setFieldValue]
  );

  // Opdater satser når årstal ændres og er gyldigt
  const inputProjection = React.useMemo(
    () => buildSatserInputProjection({
      values,
      aargangInvalidDraft,
      minYear: MIN_SATSER_YEAR,
      maxYear: MAX_SATSER_YEAR,
      revision: inputRevision,
    }),
    [MAX_SATSER_YEAR, MIN_SATSER_YEAR, aargangInvalidDraft, inputRevision, values]
  );
  const effectiveYear = inputProjection.status === 'ready' ? inputProjection.data.year : undefined;
  const yearErrorMessage = React.useMemo(
    () => resolveSatserAargangErrorMessage(values, MIN_SATSER_YEAR, MAX_SATSER_YEAR),
    [MAX_SATSER_YEAR, MIN_SATSER_YEAR, values]
  );
  const yearError = yearErrorMessage ? { message: yearErrorMessage } : undefined;

  // Download-gate: et afsluttet ugyldigt årstal (invalidDrafts) skal blokere download, også når der
  // bag masken ligger en tidligere gyldig committed årgang (document-output-contract.md §A2.1). Er
  // der ingen ugyldig draft, falder vi tilbage på den committed-afledte gate (manglende/uden-for-interval).
  const pdfGate = React.useMemo(
    () => inputProjection.status === 'ready'
      ? documentGateFromBlockers([], 'satser')
      : documentGateFromBlockers(inputProjection.blockers, 'satser'),
    [inputProjection]
  );
  const canDownload = pdfGate.canDownload;

  // Vis kun satser for et gyldigt, valgt år. Er året ugyldigt/uden for interval
  // (feltet viser rød fejl), nedtones rate-sektionerne i stedet for at vise
  // satser for et tilfældigt fallback-år (tidligere MAX_SATSER_YEAR), som ville
  // være vildledende for brugeren.
  const satser = inputProjection.status === 'ready' ? inputProjection.data.satser : null;

  // Håndter download af PDF
  const handleDownloadPdf = React.useCallback(async () => {
    const preparation = criticalActions === null
      ? { status: 'committed' as const }
      : await criticalActions.prepare('download');
    if (preparation.status === 'blocked') {
      preparation.target?.focus();
      return;
    }

    const latestProjection = buildSatserInputProjection({
      values: getPersistedSectionSnapshot('satser'),
      aargangInvalidDraft: getInvalidDraftForFieldSnapshot('satser', 'aargang'),
      minYear: MIN_SATSER_YEAR,
      maxYear: MAX_SATSER_YEAR,
      revision: getCommittedChangeCounterSnapshot(),
    });
    if (latestProjection.status === 'blocked') return;

    await downloadSatserDokument({
      year: latestProjection.data.year,
      satser: latestProjection.data.satser,
      inputRevision: latestProjection.revision,
      settings,
      persistedStamdata: getPersistedSectionSnapshot('stamdata'),
    });
  }, [MAX_SATSER_YEAR, MIN_SATSER_YEAR, criticalActions, settings]);

  const renderReferenceValue = React.useCallback((links: readonly RetsinfoLink[]) => {
    if (links.length === 0) return '';

    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap', width: '100%' }}>
        {links.map((link, index) => (
          <React.Fragment key={`${link.label}-${link.url}`}>
            {index > 0 ? (
              <Typography component="span" className="row--text" sx={{ whiteSpace: 'pre' }}>
                {' og '}
              </Typography>
            ) : null}
            <Typography
              component="a"
              className="row--text icon-text-link"
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              {link.label}
            </Typography>
          </React.Fragment>
        ))}
      </Box>
    );
  }, []);

  return (
    <Box>
      {/* Side-header — årstal vises kun for et gyldigt valgt år */}
      <Typography className="page-title">
        {effectiveYear !== undefined ? `Arbejdsskadesatser ${effectiveYear}` : 'Arbejdsskadesatser'}
      </Typography>

      {/* Årstal sektion */}
      <ContentBox className="content-box">
        <Typography className="section-header">Årstal</Typography>

        <Box className="row--label-right-hover">
          <Typography className="row--text">Vis satser for år:</Typography>
          <Box className="row--label-right-hover__content">
            <StyledYearField
              name="aargang"
              value={values.aargang}
              onCommit={handleYearCommit}
              onFieldError={aargangErrorReporter}
              minYear={MIN_SATSER_YEAR}
              maxYear={MAX_SATSER_YEAR}
              width={80}
              externalError={yearError}
            />
          </Box>
        </Box>

        <Box className="row--label-right-hover">
          <Typography className="row--text">Download specifikation:</Typography>
          <Box className="row--label-right-hover__content">
            <DocumentDownloadButton
              onClick={() => void handleDownloadPdf()}
              disabled={!canDownload}
              disabledReason={pdfGate.reasons[0]?.message}
            />
          </Box>
        </Box>
      </ContentBox>

      {/* Rate-sektioner vises kun for et gyldigt valgt år. Ellers nedtones området
          med en kort vejledning, så der ikke vises satser for et tilfældigt fallback-år. */}
      {satser === null ? (
        <ContentBox className="content-box">
          <Typography
            className="row--text"
            sx={{ fontStyle: 'italic', color: 'text.secondary' }}
          >
            Vælg et gyldigt år for at se satserne.
          </Typography>
        </ContentBox>
      ) : (
        <>
      {/* Erstatningsansvarsloven sektion */}
      <ContentBox className="content-box">
        <Typography className="section-header">Erstatningsansvarsloven</Typography>

        <DataRow
          label="Godtgørelse for svie og smerte"
          value={satser ? formatKronerPerEnhed(satser.eal.svieSmertePrDag, 'sygedag') : ''}
        />
        <DataRow
          label="Maksimum for svie og smerte"
          value={satser ? formatKroner(satser.eal.svieSmerteMax) : ''}
        />
        <DataRow
          label="Maksimum for erhvervsevnetabserstatning"
          value={satser ? formatKroner(satser.eal.erhvervsevnetabEalMax) : ''}
        />
        <DataRow
          label="Mindstebeløb for forsørgertab"
          value={satser ? formatKroner(satser.eal.foersoergertabEalMin) : ''}
        />
        <DataRow
          label="Vejledende udtalelse om erhvervsevnetab"
          value={satser ? formatKroner(satser.eal.vejledendeUdtalelseEet) : ''}
        />
      </ContentBox>

      {/* Arbejdsskadesikringsloven sektion */}
      <ContentBox className="content-box">
        <Typography className="section-header">Arbejdsskadesikringsloven</Typography>

        <DataRow
          label="Godtgørelse for varige mén"
          value={satser ? formatKronerPerEnhed(satser.asl.varigeMenPrGrad, 'méngrad') : ''}
        />
        <DataRow
          label="Maksimum årsløn"
          value={satser ? formatKroner(satser.asl.aarsloenAslMax) : ''}
        />
        <DataRow
          label="Minimum årsløn"
          value={satser ? formatKroner(satser.asl.aarsloenMin) : ''}
        />
        <DataRow
          label="Minimum årsløn (skader før 1.7.2024)"
          value={satser ? formatKroner(satser.asl.aarsloenMinFoer2024) : ''}
        />
        <DataRow
          label="Minimum årsløn (skader fra 1.7.2024)"
          value={satser ? formatKroner(satser.asl.aarsloenMinFra2024) : ''}
        />
        <DataRow
          label="Overgangsbeløb"
          value={satser ? formatKroner(satser.asl.overgangsbelob) : ''}
        />
        <DataRow
          label="Reguleringsprocent for erhvervsevnetab"
          value={satser ? formatOptionalPercent(satser.asl.reguleringProcentErhvervsevnetab) : ''}
        />
        <DataRow
          label="Reguleringsprocent for erhvervsevnetab (før 2024)"
          value={satser ? formatOptionalPercent(satser.asl.reguleringProcentErhvervsevnetabFoer2024) : ''}
        />
        <DataRow
          label="Reguleringsprocent for erhvervsevnetab (fra 2024)"
          value={satser ? formatOptionalPercent(satser.asl.reguleringProcentErhvervsevnetabFra2024) : ''}
        />
      </ContentBox>

      {/* Diverse sektion */}
      <ContentBox className="content-box">
        <Typography className="section-header">Diverse</Typography>

        <MultiLineDataRow
          rows={[
            {
              key: 'fri-proces',
              label: (
                <>
                  Beløbsgrænse for fri proces (enlig/samlevende):
                  <InfoTooltipIcon title={'Personlig indkomst\n+ positiv kapitalindkomst'} />
                </>
              ),
              value: satser
                ? formatKronerPair(
                    satser.diverse.friProcesEnlig,
                    satser.diverse.friProcesSamlevende
                  )
                : '',
            },
            {
              key: 'fri-proces-barn',
              label: '+ Tillæg per barn under 18 år:',
              value: satser ? formatKroner(satser.diverse.friProcesBarn) : '',
            },
          ]}
        />
        <DataRow
          label="Reguleringssats"
          value={satser ? formatOptionalPercent(satser.diverse.reguleringssats) : ''}
        />
      </ContentBox>

      {/* Referencer sektion */}
      <ContentBox className="content-box">
        <Typography className="section-header">Referencer</Typography>

        <DataRow
          label="Erstatningsansvarsloven"
          value={satser ? renderReferenceValue(satser.referencer.ealReferenceLinks) : ''}
        />
        <DataRow
          label="Arbejdsskadesikringsloven"
          value={satser ? renderReferenceValue(satser.referencer.aslReferenceLinks) : ''}
        />
        <DataRow
          label="Kapitalisering"
          value={satser ? renderReferenceValue(satser.referencer.kapitaliseringLinks) : ''}
        />
        <DataRow
          label="Kapitalisering (skade fra 1.1.2011)"
          value={satser ? renderReferenceValue(satser.referencer.kapitaliseringSkadeFra2011Links) : ''}
        />
        <DataRow
          label="Kapitalisering (skade før 1.1.2011)"
          value={satser ? renderReferenceValue(satser.referencer.kapitaliseringSkadeFoer2011Links) : ''}
        />
        <DataRow
          label="Kapitalisering (skade fra 1.7.2007)"
          value={satser ? renderReferenceValue(satser.referencer.kapitaliseringSkadeFra2007Links) : ''}
        />
        <DataRow
          label="Kapitalisering (skade før 1.7.2007)"
          value={satser ? renderReferenceValue(satser.referencer.kapitaliseringSkadeFoer2007Links) : ''}
        />
        <DataRow
          label="Fri proces"
          value={satser ? renderReferenceValue(satser.referencer.friProcesReferenceLinks) : ''}
        />
        <DataRow
          label="Reguleringssatser"
          value={satser ? renderReferenceValue(satser.referencer.reguleringssatsReferenceLinks) : ''}
        />
      </ContentBox>
        </>
      )}
    </Box>
  );
});

Satser.displayName = 'Satser';

export default Satser;
