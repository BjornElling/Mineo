import React from 'react';
import { Alert, AlertTitle, Box, Button, Typography } from '@mui/material';
import BugReportButton from './BugReportButton';
import type { BugReportExtraSection } from '../../utils/bugReport';
import type { DevtoolsIssueSnapshot } from '../../utils/devtoolsMonitor';
import { formatUtcTimestampSeconds } from '../../utils/dateFormatting';

interface DevtoolsIssueNoticeProps {
  snapshot: DevtoolsIssueSnapshot;
  onDismiss: () => void;
  getExtraSections: () => BugReportExtraSection[];
}

const formatTimestamp = (timestamp: string): string => {
  const date = new Date(timestamp);
  return formatUtcTimestampSeconds(date);
};

const formatSystemIssueSummary = (snapshot: DevtoolsIssueSnapshot): string | null => {
  const systemIssue = snapshot.lastIssue?.systemIssue;
  if (!systemIssue) return null;
  const segments = [
    `Kode: ${systemIssue.code}`,
    `Område: ${systemIssue.area}`,
    systemIssue.revision ? `Revision: ${systemIssue.revision}` : null,
  ].filter(Boolean);
  return segments.length > 0 ? segments.join(' · ') : null;
};

const DevtoolsIssueNotice = ({
  snapshot,
  onDismiss,
  getExtraSections,
}: DevtoolsIssueNoticeProps) => {
  const [showDetails, setShowDetails] = React.useState(false);

  const hasErrors = snapshot.counts.error > 0;
  const title = hasErrors ? 'Teknisk fejl registreret' : 'Teknisk advarsel registreret';
  const lastIssue = snapshot.lastIssue;
  const summary = lastIssue
    ? `${lastIssue.level.toUpperCase()} · ${formatTimestamp(lastIssue.timestamp)}`
    : 'Ingen detaljer tilgængelige';
  const structuredSummary = formatSystemIssueSummary(snapshot);

  const guidance =
    'Der er fundet en fejl i den underliggende kode. Hvis programmet stadig virker, er det ikke et egentligt problem. ' +
    'Betragt det som en gul advarselslampe i din bil om, at den skal efterses på et værksted ved lejlighed. ' +
    'Du kan fortsætte med at bruge programmet som hidtil, men gennemgå gerne dine beregninger grundigt.';

  const detailItems = snapshot.issues.slice(0, 6);

  return (
    <Box
      sx={{
        position: 'fixed',
        right: 24,
        bottom: 24,
        zIndex: 1300,
        maxWidth: 640,
        width: '100%',
        pointerEvents: 'auto',
      }}
    >
      <Alert
        severity="warning"
        sx={{
          borderRadius: '20px',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.2)',
        }}
      >
        <AlertTitle sx={{ fontSize: '18px', fontWeight: 500 }}>{title}</AlertTitle>

        <Typography variant="body1" sx={{ marginBottom: 1.5 }}>
          {guidance}
        </Typography>

        <Typography variant="body2" color="text.secondary" sx={{ marginBottom: 2 }}>
          Registrerede hændelser: {snapshot.counts.error} fejl · {snapshot.counts.warn} advarsler
          {lastIssue ? ` · Seneste: ${summary}` : ''}
        </Typography>

        {structuredSummary && (
          <Typography variant="body2" color="text.secondary" sx={{ marginBottom: 2 }}>
            {structuredSummary}
          </Typography>
        )}

        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button variant="outlined" onClick={onDismiss} sx={{ borderRadius: '10px' }}>
            Skjul
          </Button>

          <BugReportButton
            variant="outlined"
            label="Send fejloplysninger"
            context={{
              source: 'DevTools monitor',
            }}
            getExtraSections={getExtraSections}
          />

          {snapshot.issues.length > 0 && (
            <Button variant="text" onClick={() => setShowDetails((prev) => !prev)} sx={{ borderRadius: '10px' }}>
              {showDetails ? 'Skjul' : 'Vis'} tekniske detaljer
            </Button>
          )}
        </Box>

        {showDetails && snapshot.issues.length > 0 && (
          <Box
            sx={{
              marginTop: 2,
              padding: 2,
              backgroundColor: 'var(--color-background-white)',
              borderRadius: '10px',
              border: '1px solid rgba(0, 0, 0, 0.12)',
              maxHeight: 260,
              overflow: 'auto',
            }}
          >
            {detailItems.map((issue) => (
              <Box key={issue.id} sx={{ marginBottom: 1.5 }}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                  {issue.level.toUpperCase()} · {formatTimestamp(issue.timestamp)} · {issue.source}
                </Typography>
                <Typography
                  variant="body2"
                  component="pre"
                  sx={{
                    fontFamily: 'monospace',
                    fontSize: '11px',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    margin: 0,
                  }}
                >
                  {issue.message}
                </Typography>
                {issue.systemIssue && (
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: 'block', marginTop: 0.5, whiteSpace: 'pre-wrap' }}
                  >
                    {`Kode: ${issue.systemIssue.code} · Område: ${issue.systemIssue.area}${issue.systemIssue.revision ? ` · Revision: ${issue.systemIssue.revision}` : ''}`}
                  </Typography>
                )}
              </Box>
            ))}
            {snapshot.issues.length > detailItems.length && (
              <Typography variant="caption" color="text.secondary">
                ... +{snapshot.issues.length - detailItems.length} flere
              </Typography>
            )}
          </Box>
        )}
      </Alert>
    </Box>
  );
};

export default DevtoolsIssueNotice;
