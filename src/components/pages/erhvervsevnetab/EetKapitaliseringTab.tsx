import React from 'react';
import { Box, Typography } from '@mui/material';
import ContentBox from '../../layout/ContentBox';
import type { ErhvervsevnetabComposedValues, StamdataValues } from '../../../schemas/formSchemas';
import { useAppSettings } from '../../../contexts/useAppSettings';
import { formatIsoDateLong, formatISOToDanish } from '../../../utils/dateFormatting';
import { coerceToISODateString } from '../../../types/branded';
import {
  buildKapitaliseringAfgoerelseRows,
  type KapitaliseringRow,
} from '../../../domain/erhvervsevnetab/eetKapitaliseringRows';
import { downloadKapitaliseringDokument } from '../../../document/service/documentService';
import EetIssuesBox from './EetIssuesBox';
import HoverRow from './HoverRow';
import DocumentDownloadButton from '../../inputs/DocumentDownloadButton';
import { useShakeFlag } from '../../../hooks/useShakeFlag';
import type { EetSnapshot } from '../../../domain/erhvervsevnetab/eetSnapshot';

type Props = Readonly<{
  values: ErhvervsevnetabComposedValues;
  onGoToEetOplysninger: () => void;
  stamdata: StamdataValues | null;
  snapshot: EetSnapshot['kapitalisering'];
}>;


/**
 * Renderer de delte kapitaliserings-rækker i UI-idiomet (label-venstre/værdi-højre hover-rækker).
 * Sekvensen/synligheden ejes af `buildKapitaliseringAfgoerelseRows`; her oversættes hver række-`kind`
 * til JSX. Den første underoverskrift ("Grundydelse og regulering") har bevidst ingen top-margen,
 * modsat de efterfølgende — bevaret fra den oprindelige inline-JSX.
 */
const renderKapitaliseringRows = (rows: readonly KapitaliseringRow[]): React.ReactNode => {
  let seenSubheading = false;
  return rows.map((row, index) => {
    switch (row.kind) {
      case 'subheading': {
        const isFirstSubheading = !seenSubheading;
        seenSubheading = true;
        return (
          <Typography
            key={`sub-${index}`}
            className="row--subheading"
            sx={isFirstSubheading ? undefined : { mt: 2 }}
          >
            {row.text}
          </Typography>
        );
      }
      case 'labelValue':
        return (
          <Box key={`lv-${index}`} className="row--label-right-hover">
            <Typography className="row--text">{row.label}</Typography>
            <Box className="row--label-right-hover__content">
              <Typography className={row.bold ? 'row--text text-bold' : 'row--text'}>{row.value}</Typography>
            </Box>
          </Box>
        );
      case 'grundydelse':
        return (
          <Box key={`gy-${index}`} className="row--label-right-hover">
            <Typography className="row--text">{row.label}</Typography>
            <Box className="row--label-right-hover__content">
              <Typography className="row--text">{row.expressionWithResult}</Typography>
            </Box>
          </Box>
        );
      default: {
        const _exhaustive: never = row;
        return _exhaustive;
      }
    }
  });
};

const EetKapitaliseringTab = ({ values, onGoToEetOplysninger, stamdata, snapshot }: Props) => {
  const { settings } = useAppSettings();
  const { shake: downloadShake, triggerShake: triggerDownloadShake } = useShakeFlag();
  const issues = snapshot.issues;
  const hasBlockingErrors = snapshot.hasBlockingErrors;
  const computation = snapshot.computation;
  const afgoerelser = computation?.afgoerelser ?? [];

  const handlePdfDownload = React.useCallback(async () => {
    if (!computation) {
      triggerDownloadShake();
      return;
    }
    await downloadKapitaliseringDokument({
      computation,
      koen: values.koen ?? undefined,
      settings,
      persistedStamdata: stamdata,
    });
  }, [computation, values.koen, settings, stamdata, triggerDownloadShake]);

  return (
    <Box>
      <EetIssuesBox
        issues={issues}
        onGoToEetOplysninger={onGoToEetOplysninger}
      />

      {!hasBlockingErrors && (
        <ContentBox className="content-box">
          <Typography className="section-header">Beregning</Typography>

          <Box className="row--label-right-hover">
            <Typography className="row--text">Download specifikation</Typography>
            <Box className="row--label-right-hover__content">
              <DocumentDownloadButton onClick={handlePdfDownload} shake={downloadShake} />
            </Box>
          </Box>
        </ContentBox>
      )}

      {!hasBlockingErrors && afgoerelser.length === 0 && (
        <ContentBox className="content-box">
          <Typography className="section-header">Specifikation</Typography>
          <HoverRow text="Der er ingen kapitaliserede afgørelser i sagen." />
        </ContentBox>
      )}

      {!hasBlockingErrors &&
        afgoerelser.map((afgoerelse) => (
          <ContentBox key={afgoerelse.rowId} className="content-box">
            <Typography className="section-header">
              Afgørelse {formatIsoDateLong(afgoerelse.afgoerelsesdato)}
            </Typography>

            {/* Beregningsdato stammer fra de løse formværdier (ikke fra afgørelses-beregningen) og er
                bevidst kun i UI'en — derfor uden for den delte præsentationsmodel. */}
            <Box className="row--label-right-hover">
              <Typography className="row--text">Beregningsdato</Typography>
              <Box className="row--label-right-hover__content">
                <Typography className="row--text">{formatISOToDanish(coerceToISODateString(values.beregningsdato))}</Typography>
              </Box>
            </Box>

            {renderKapitaliseringRows(
              buildKapitaliseringAfgoerelseRows(afgoerelse, {
                koen: values.koen ?? undefined,
                koenRowMode: 'always',
                saerfaktorLabel: 'Særfaktor (< 2 år til folkepension)',
                formatReguleringsdato: formatIsoDateLong,
              })
            )}
          </ContentBox>
        ))}
    </Box>
  );
};

EetKapitaliseringTab.displayName = 'EetKapitaliseringTab';

export default EetKapitaliseringTab;
