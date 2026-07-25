import React from 'react';
import { Box, Typography } from '@mui/material';
import DocumentDownloadButton from '../inputs/DocumentDownloadButton';
import { downloadSatserDokument } from '../../document/service/documentService';
import { satserAargangField } from '../../inputCore/catalog/satserDescriptors';
import YearField from '../../inputCore/react/fields/YearField';
import { useCriticalInputActions, useInputEvaluation } from '../../inputCore/react/useInputEvaluation';
import { captureProductionEvaluationSource } from '../../inputCore/react/productionInputRuntime';
import { APP_ROUTES } from '../../config/pageNavigation';
import { projectSatser } from '../../domain/satser/satserProjection';
import { projectStamdataForDocument } from '../../domain/stamdata/stamdataDocumentProjection';
import ContentBox from '../layout/ContentBox';
import InfoTooltipIcon from '../common/InfoTooltipIcon';
import { formatAsAmount, formatKr, formatPercent } from '../../utils/formatUtils';
import type { RetsinfoLink } from '../../data/retsinfoLinks';

// Greenfield-migreret (§2.4 formularrækkefølge trin 2 + Fase 3 Satser-slice). Erstatter den legacy
// Den gamle persistence-/feltfejl-/projektionvej er erstattet med:
//  - `YearField` (field = descriptor.bind(), location = stabilt locationId) — ingen value/onCommit/
//    minYear/maxYear/onFieldError; satsårets min/maxYear-bounds er en canonical bounds-feltvalidator → rødt issue.
//  - `projectSatser(reader)` over den offentlige `InputReader` (`useInputEvaluation`) til visning OG gate.
//  - samme runtimebindings coordinator + frisk typed evaluation til download-preflight (§1.4/§3.9).
// Brevhovedet går gennem en typed Stamdata-projektion; rå sektioner forlader aldrig runtimebindingen.
// Default-satsåret for en frisk sag seedes committed ved bootstrap (`seedSatserNewCase`), ikke som skygge-visning.

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

// Stabil felt-ref + editorlokation (§3.2): locationId er editor-metadata, ikke datafeltets identitet.
const aargangRef = satserAargangField.bind();
// route er eksplicit navigation-metadata (§3.7); Satser er en side uden faner (tabKey: null).
const aargangLocation = { locationId: 'satser:aargang', route: APP_ROUTES.satser, tabKey: null } as const;

/**
 * Satser-komponent til visning af lovbestemte satser
 *
 * Indeholder information om relevante satser for erstatningsberegninger.
 */
const Satser = React.memo(() => {
  const evaluation = useInputEvaluation();
  const criticalActions = useCriticalInputActions();

  // Vist = beregnet (§3.9): både sidevisning og downloadgate udledes af SAMME reader-projektion. Et out-of-bounds
  // eller tomt år giver `blocked` → satser skjules og download blokeres; kun et gyldigt år giver `ready`.
  const projection = React.useMemo(() => projectSatser(evaluation.reader), [evaluation]);
  const stamdataProjection = React.useMemo(
    () => projectStamdataForDocument(evaluation.reader, 'document.satser'),
    [evaluation]
  );
  const effectiveYear = projection.status === 'ready' ? projection.value.year : undefined;
  const satser = projection.status === 'ready' ? projection.value.satser : null;
  const canDownload = projection.status === 'ready' && stamdataProjection.status === 'ready';
  const disabledReason = projection.status === 'blocked'
    ? projection.issues[0]?.message
    : stamdataProjection.status === 'blocked'
      ? stamdataProjection.issues[0]?.message
      : undefined;

  // Håndter download af PDF
  const handleDownloadPdf = React.useCallback(async () => {
    // §1.4: download settler først den åbne editor og evaluerer derefter et frisk kildesnapshot.
    const preparation = await criticalActions.prepare('download');
    if (preparation.status !== 'committed') {
      if (preparation.status !== 'blocked') return;
      preparation.target?.focus();
      return;
    }

    // Frisk, stabilt kildesnapshot efter settle (§3.9): projektion + freshness-closure bygges HER, ikke fra render.
    const source = captureProductionEvaluationSource();
    const latest = projectSatser(source.evaluation.reader);
    const latestStamdata = projectStamdataForDocument(source.evaluation.reader, 'document.satser');
    if (latest.status !== 'ready' || latestStamdata.status !== 'ready') return;

    await downloadSatserDokument({
      year: latest.value.year,
      satser: latest.value.satser,
      isSourceCurrent: source.isSourceCurrent,
      settings: source.settings,
      persistedStamdata: latestStamdata.value,
    });
  }, [criticalActions]);

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
            <YearField name="aargang" field={aargangRef} location={aargangLocation} width={80} />
          </Box>
        </Box>

        <Box className="row--label-right-hover">
          <Typography className="row--text">Download specifikation:</Typography>
          <Box className="row--label-right-hover__content">
            <DocumentDownloadButton
              onClick={() => void handleDownloadPdf()}
              disabled={!canDownload}
              disabledReason={disabledReason}
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
