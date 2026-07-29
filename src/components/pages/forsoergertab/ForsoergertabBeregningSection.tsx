import React from 'react';
import { Box, Tooltip, Typography } from '@mui/material';

import ContentBox from '../../layout/ContentBox';
import DateField from '../../../inputCore/react/fields/DateField';
import InsertTodayDateButton from '../../inputs/InsertTodayDateButton';
import DocumentDownloadButton from '../../inputs/DocumentDownloadButton';
import { visibleDocumentFailureMessage } from '../../../document/definition/react/useDocumentDownload';
import { useForsoergertabVm } from './forsoergertabContext';

/**
 * Beregningsdato og download af specifikationen.
 *
 * Gate-årsagen vises som tekst VED SIDEN AF knappen, så en blokering aldrig er usynlig; fejlboksen nedenfor
 * viser derfor kun de udfald, tooltippet ikke bærer (stale-afbrud, DEV-serverfejl).
 */
const ForsoergertabBeregningSection = React.memo(() => {
  const vm = useForsoergertabVm();
  const { download } = vm;

  /**
   * Beskeden udledes HER — i den flade, der aktiverer downloaden — så aktivering og visning ikke kan
   * divergere (`document/activation-shows-outcome`). Gate-årsagen står allerede ved knappen ovenfor, så
   * `visibleDocumentFailureMessage` er den rigtige kilde: den udelader netop gate-årsagen og efterlader
   * stale-afbrud og DEV-serverfejl. Uventede runtimefejl routes centralt (§A5).
   *
   * Rækken er BEVIDST inline frem for `DocumentOutcomeMessage`: den kanoniske komponent sætter
   * `row--label-right-hover__content` på højre kolonne, hvor denne flade har en bar `<Box />`. Ensretningen af
   * de fem eksisterende rækkeudgaver er en synlig UI-ændring uden for R7-F01's adfærdsbevarende omfang og er
   * fortsat udestående fra R6-F02.
   */
  const failureMessage = visibleDocumentFailureMessage(download);

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
          {download.disabledReason !== undefined && (
            <Tooltip title={download.disabledReason} arrow>
              <Typography className="row--text" color="text.disabled">
                {download.disabledReason}
              </Typography>
            </Tooltip>
          )}
          <DocumentDownloadButton
            onClick={() => void download.download(undefined)}
            disabled={!download.canDownload}
            disabledReason={download.disabledReason}
            dataTestId="forsoergertab-download"
          />
        </Box>
      </Box>

      {failureMessage && (
        <Box className="row--label-right-hover">
          <Typography className="row--text" sx={{ color: 'error.main' }}>
            {failureMessage}
          </Typography>
          <Box />
        </Box>
      )}
    </ContentBox>
  );
});

ForsoergertabBeregningSection.displayName = 'ForsoergertabBeregningSection';

export default ForsoergertabBeregningSection;
