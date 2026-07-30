import React from 'react';
import { Box, Typography } from '@mui/material';

import ContentBox from '../../layout/ContentBox';
import DateField from '../../../inputCore/react/fields/DateField';
import InsertTodayDateButton from '../../inputs/InsertTodayDateButton';
import DocumentDownloadButton from '../../inputs/DocumentDownloadButton';
import DocumentOutcomeMessage from '../../inputs/DocumentOutcomeMessage';
import { useForsoergertabVm } from './forsoergertabContext';

/**
 * Beregningsdato og download af specifikationen.
 *
 * Gate-årsagen står KUN i download-ikonets tooltip. Den stod tidligere OGSÅ som nedtonet tekst ved
 * siden af knappen, så brugeren læste den samme besked to gange.
 */
const ForsoergertabBeregningSection = React.memo(() => {
  const vm = useForsoergertabVm();
  const { download } = vm;

  /**
   * Beskeden udledes HER — i den flade, der aktiverer downloaden — så aktivering og visning ikke kan
   * divergere (`document/activation-shows-outcome`).
   *
   * Kilden er `download.errorMessage` RÅT og IKKE `visibleDocumentFailureMessage`: denne flade har
   * ingen shake-/fokus-feedback på et blokeret klik, og gate-årsagen står nu kun i tooltippet — som ikke er
   * fremme, når brugeren netop har klikket. En gate-blokering kan ramme selve AKTIVERINGEN, fordi preflighten
   * gater EFTER commit-barrieren: et klik med en åben editor kan blokere, fordi settlet gjorde værdien
   * ugyldig. Filtrerede vi den væk, ville netop det klik være lydløst — i strid med "ingen usynlig
   * blokering"-invarianten.
   */
  const failureMessage = download.errorMessage;

  return (
    <ContentBox className="content-box">
      <Typography className="section-header">Beregning</Typography>

      <Box className="row--label-right-hover">
        <Typography className="row--text">Beregningsdato</Typography>
        <Box className="row--label-right-hover__content" sx={{ gap: 1 }}>
          <DateField
            field={vm.fields.beregningsdato}
            location={vm.locations.beregningsdato}
            name="beregningsdato"
            inputRef={vm.beregningsdatoInputRef}
          />
          <InsertTodayDateButton
            onCommit={vm.settleBeregningsdato}
            focusRef={vm.beregningsdatoInputRef}
          />
        </Box>
      </Box>

      <Box className="row--label-right-hover">
        <Typography className="row--text">Download specifikation</Typography>
        <Box className="row--label-right-hover__content" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <DocumentDownloadButton
            onClick={() => void download.download(undefined)}
            disabled={!download.canDownload}
            disabledReason={download.disabledReason}
            dataTestId="forsoergertab-download"
          />
        </Box>
      </Box>

      <DocumentOutcomeMessage message={failureMessage} />
    </ContentBox>
  );
});

ForsoergertabBeregningSection.displayName = 'ForsoergertabBeregningSection';

export default ForsoergertabBeregningSection;
