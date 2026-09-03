import React from 'react';
import { Box, Typography } from '@mui/material';
import ContentBox from '../../layout/ContentBox';
import { formatIsoDateLong } from '../../../utils/dateFormatting';
import {
  buildKapitaliseringAfgoerelseHeading,
  buildKapitaliseringAfgoerelseRows,
  type KapitaliseringRow,
} from '../../../domain/erhvervsevnetab/eetKapitaliseringRows';
import EetIssuesBox from './EetIssuesBox';
import HoverRow from './HoverRow';
import DocumentDownloadButton from '../../inputs/DocumentDownloadButton';
import DocumentOutcomeMessage from '../../inputs/DocumentOutcomeMessage';
import EetDocumentDownloadBox from './EetDocumentDownloadBox';
import type { ErhvervsevnetabReaderProjection } from '../../../domain/erhvervsevnetab/erhvervsevnetabReaderProjection';
import { type DocumentDownloadHandle } from '../../../document/definition/react/useDocumentDownload';

type Props = Readonly<{
  onGoToEetOplysninger: () => void;
  projection: ErhvervsevnetabReaderProjection;
  /** Dokumentoutputtet, komponeret af siden. Fanen aktiverer det; den konfigurerer det ikke. */
  download: DocumentDownloadHandle<void>;
}>;



/**
 * Renderer de delte kapitaliserings-rækker i UI-idiomet (label-venstre/værdi-højre hover-rækker).
 * Sekvensen/synligheden ejes af `buildKapitaliseringAfgoerelseRows`; her oversættes hver række-`kind`
 * til JSX. Den første underoverskrift ("Grundydelse og regulering") har bevidst ingen top-margen,
 * modsat de efterfølgende – bevaret fra den oprindelige inline-JSX.
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

const EetKapitaliseringTab = ({ onGoToEetOplysninger, projection, download }: Props) => {
  const values = projection.values;
  const snapshot = projection.snapshot.kapitalisering;
  const issues = snapshot.issues;
  const hasBlockingErrors = snapshot.hasBlockingErrors;
  const computation = snapshot.computation;
  const afgoerelser = computation?.afgoerelser ?? [];

  return (
    <Box>
      <EetIssuesBox
        issues={issues}
        onGoToEetOplysninger={onGoToEetOplysninger}
      />

      {hasBlockingErrors && <EetDocumentDownloadBox download={download} />}

      {!hasBlockingErrors && (
        <ContentBox className="content-box">
          <Typography className="section-header">Beregning</Typography>

          <Box className="row--label-right-hover">
            <Typography className="row--text">Download specifikation</Typography>
            <Box className="row--label-right-hover__content">
              <DocumentDownloadButton
                onClick={() => void download.download(undefined)}
                disabled={!download.canDownload}
                disabledReason={download.disabledReason}
              />
            </Box>
          </Box>

          {/*
            Gate-blokeringer står allerede i `EetIssuesBox` ovenfor (og skjuler denne boks helt), så de
            vises ikke igen her. Tilbage er stale-afbrud og DEV-serverfejl, som ellers var lydløse.
          */}
          <DocumentOutcomeMessage message={download.errorMessage} />
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
              {buildKapitaliseringAfgoerelseHeading(
                afgoerelse.afgoerelsesdato,
                afgoerelse.eetPct,
                formatIsoDateLong
              )}
            </Typography>

            {/* Ingen Beregningsdato-række: fanen er bevidst uafhængig af beregningsdatoen
                (`eetSnapshot.ts`), så rækken var den eneste værdi i boksen, intet i boksen afhang af –
                og den stod ikke i dokumentet, så skærmen kunne ikke bruges som facit (BB-167). */}
            {renderKapitaliseringRows(
              buildKapitaliseringAfgoerelseRows(afgoerelse, {
                koen: values.koen ?? undefined,
                koenRowMode: 'always',
              })
            )}
          </ContentBox>
        ))}
    </Box>
  );
};

EetKapitaliseringTab.displayName = 'EetKapitaliseringTab';

export default EetKapitaliseringTab;
