import React from 'react';
import { Box, Typography } from '@mui/material';
import { ErrorOutlined as ErrorOutline, WarningAmber } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import ContentBox from '../../layout/ContentBox';
import type { EetIssue } from '../../../domain/erhvervsevnetab/eetTypes';
import { type EetTabNavigation, resolveEetIssueNavigation } from '../../../domain/erhvervsevnetab/eetFormatUtils';
import { APP_ROUTES } from '../../../config/pageNavigation';
import {
  scrollToCollectionFieldTemplate,
  scrollToFieldAddress,
} from '../../../utils/scrollToFieldAddress';
import { scrollToSection } from '../../../utils/scrollToSection';

type Props = Readonly<{
  issues: readonly EetIssue[];
  onGoToEetOplysninger: () => void;
}>;

const EetIssuesBox = ({ issues, onGoToEetOplysninger }: Props) => {
  const navigate = useNavigate();

  const handleNavigate = React.useCallback(
    (navigation: EetTabNavigation) => {
      if (navigation.route === APP_ROUTES.erhvervsevnetab) {
        onGoToEetOplysninger();
      } else {
        navigate(navigation.route);
      }

      // Navigationshandlingen kan unmount'e denne boks ved route-skift. Retryforskydningen må derfor
      // være en selvstændig, begrænset DOM-operation — ikke en hook, hvis cleanup afbryder den før
      // destinationens editor når at mounte. Et konkret felt vinder; dernæst den tomme
      // indtastningsrækkes celle, når issuet efterspørger en række, brugeren ikke har oprettet endnu;
      // sektionen bruges kun ved regler med flere mulige årsagsfelter eller ved systemdata, der ikke
      // kan rettes i ét input.
      if (navigation.focusFieldAddress) {
        scrollToFieldAddress(navigation.focusFieldAddress);
      } else if (navigation.focusFirstRowField) {
        scrollToCollectionFieldTemplate(navigation.focusFirstRowField);
      } else {
        scrollToSection(navigation.sectionId, { attention: true });
      }
    },
    [navigate, onGoToEetOplysninger]
  );

  if (issues.length === 0) return null;

  return (
    <ContentBox className="content-box">
      <Typography className="section-header">Fejl og advarsler</Typography>

      {issues.map((issue) => {
        const navigation = resolveEetIssueNavigation(issue.id);
        return (
          <Box
            key={`${issue.severity}-${issue.id}-${issue.message}`}
            className="row--label-right-hover"
          >
            <Typography
              className="row--text"
              sx={{ flex: '1 1 auto', minWidth: 0, mr: 4, whiteSpace: 'normal', overflowWrap: 'break-word' }}
            >
              {issue.message}
            </Typography>
            <Box
              className="row--label-right-hover__content"
              sx={{ flex: '0 0 auto', minWidth: 'unset', gap: 1 }}
            >
              {navigation && (
                <>
                  <Typography className="row--text">
                    {navigation.pageName} {'→'}{' '}
                  </Typography>
                  <Typography
                    className="row--text icon-text-link"
                    component="button"
                    type="button"
                    onClick={() => handleNavigate(navigation)}
                    sx={{
                      cursor: 'pointer',
                      border: 0,
                      background: 'transparent',
                      p: 0,
                      m: 0,
                      font: 'inherit',
                    }}
                  >
                    {navigation.sectionName}
                  </Typography>
                </>
              )}
              {issue.severity === 'error' ? (
                <ErrorOutline sx={{ color: 'var(--color-status-error)', fontSize: 20 }} />
              ) : (
                <WarningAmber sx={{ color: 'var(--color-status-warning)', fontSize: 20 }} />
              )}
            </Box>
          </Box>
        );
      })}
    </ContentBox>
  );
};

EetIssuesBox.displayName = 'EetIssuesBox';

export default EetIssuesBox;
