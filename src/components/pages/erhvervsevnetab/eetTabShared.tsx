import React from 'react';
import { Box, Typography } from '@mui/material';
import { ErrorOutline, WarningAmber } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import ContentBox from '../../layout/ContentBox';
import { useScrollToSectionWithRetry } from '../../../hooks/useScrollToSectionWithRetry';
import type { EetIssue } from '../../../domain/erhvervsevnetab/eetTypes';
import { type EetTabNavigation, resolveEetIssueNavigation } from './eetTabSharedUtils';

type IssuesBoxProps = Readonly<{
  issues: readonly EetIssue[];
  onGoToEetOplysninger: () => void;
}>;

export const EetIssuesBox: React.FC<IssuesBoxProps> = ({
  issues,
  onGoToEetOplysninger,
}) => {
  const navigate = useNavigate();
  const scrollToSectionWithRetry = useScrollToSectionWithRetry();

  const handleNavigate = React.useCallback(
    (navigation: EetTabNavigation) => {
      if (navigation.route === '/erhvervsevnetab') {
        onGoToEetOplysninger();
        scrollToSectionWithRetry(navigation.sectionId);
        return;
      }
      navigate(navigation.route);
      scrollToSectionWithRetry(navigation.sectionId);
    },
    [navigate, onGoToEetOplysninger, scrollToSectionWithRetry]
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
                    {navigation.pageName} {'->'}{' '}
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
                <ErrorOutline sx={{ color: 'red', fontSize: 20 }} />
              ) : (
                <WarningAmber sx={{ color: 'orange', fontSize: 20 }} />
              )}
            </Box>
          </Box>
        );
      })}
    </ContentBox>
  );
};

export const TextHoverRow: React.FC<Readonly<{ text: string }>> = ({ text }) => (
  <Box className="row--label-right-hover">
    <Typography className="row--text">{text}</Typography>
    <Box className="row--label-right-hover__content" />
  </Box>
);

export const UnderlinedHoverRow: React.FC<Readonly<{ text: string }>> = ({ text }) => (
  <Box className="row--label-right-hover">
    <Typography className="row--subheading-underlined">{text}</Typography>
    <Box className="row--label-right-hover__content" />
  </Box>
);
