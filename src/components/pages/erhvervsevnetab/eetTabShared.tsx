import React from 'react';
import { Box, Typography } from '@mui/material';
import { ErrorOutline, WarningAmber } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import ContentBox from '../../layout/ContentBox';
import { useScrollToSectionWithRetry } from '../../../hooks/useScrollToSectionWithRetry';
import { formatAsAmount } from '../../../utils/formatUtils';
import type { EetIssue } from '../../../domain/erhvervsevnetab/eetTypes';

export type EetTabNavigation = Readonly<{
  pageName: string;
  sectionName: string;
  route: '/stamdata' | '/erhvervsevnetab';
  sectionId: string;
}>;

export const formatKr = (value: number, precision: 0 | 2 = 0): string =>
  `${formatAsAmount(value, precision)} kr.`;

export const toFieldIssue = (
  id: string,
  message: string | undefined
): EetIssue | null => {
  if (!message || message.trim() === '') return null;
  return { id, severity: 'error', message: message.trim() };
};

export const NAVIGATION_SORT_ORDER: Record<string, number> = {
  'stamdata-skadelidte': 0,
  'eet-oplysninger-stamdata': 1,
  'eet-oplysninger-asl': 2,
  'eet-oplysninger-eal': 3,
};

const NAV_STAMDATA_SKADELIDTE: EetTabNavigation = {
  pageName: 'Stamdata',
  sectionName: 'Skadelidte',
  route: '/stamdata',
  sectionId: 'stamdata-skadelidte',
};

const NAV_EET_GRUNDLAEGGENDE: EetTabNavigation = {
  pageName: 'EET oplysninger',
  sectionName: 'Grundlæggende oplysninger',
  route: '/erhvervsevnetab',
  sectionId: 'eet-oplysninger-stamdata',
};

const NAV_EET_ASL: EetTabNavigation = {
  pageName: 'EET oplysninger',
  sectionName: 'Arbejdsskadesikringsloven',
  route: '/erhvervsevnetab',
  sectionId: 'eet-oplysninger-asl',
};

const NAV_EET_EAL: EetTabNavigation = {
  pageName: 'EET oplysninger',
  sectionName: 'Erstatningsansvarsloven',
  route: '/erhvervsevnetab',
  sectionId: 'eet-oplysninger-eal',
};

// IDs der navigerer til Stamdata → Skadelidte på alle faner.
const STAMDATA_IDS = new Set([
  'fodselsdato-missing',
  'field-fodselsdato',
  'skadesdato-missing',
  'field-skadesdato',
  'alder-unresolved',
]);

// IDs der navigerer til EET oplysninger → Grundlæggende oplysninger på alle faner.
const GRUNDLAEGGENDE_IDS = new Set([
  'beregningsdato-missing',
  'beregningsdato-invalid',
  'field-beregningsdato',
  'eet-max-missing',
  'proforma-kapitaliseringsbekendtgoerelse-missing',
  'proforma-kapitaliseringstabel-missing',
  'proforma-kapitaliseringsalder-under-minimum',
  'proforma-kapitaliseringsfaktor-unresolved',
  'proforma-reguleringssats-missing',
]);

// IDs der navigerer til EET oplysninger → Erstatningsansvarsloven på alle faner.
const EAL_IDS = new Set([
  'eal-aarsloen-missing',
  'eal-aarsloen-zero',
  'eal-eet-pct-invalid',
  'eet-pct-missing',
  'field-aarsloen-eal',
  'field-eal-eet-pct',
  'warn-eal-eet-under-15',
  'warn-eal-aarsloen-is-max',
  'warn-eal-aarsloen-empty-for-2024-07-01',
]);

// IDs der navigerer til EET oplysninger → Arbejdsskadesikringsloven på alle faner.
// Alle øvrige IDs (catch-all) returnerer null.
const ASL_IDS = new Set([
  'aarsloen-missing',
  'aarsloen-zero',
  'asl-aarsloen-missing',
  'field-aarsloen-asl',
  'field-asl-afgoerelser',
  'asl-identiske-afgoerelser',
  'asl-afgoerelser-empty',
  'asl-selected-eet-pct-invalid',
  'missing-afgoerelsesdato',
  'missing-eet-pct',
  'missing-afgoerelseType',
  'no-endelig-afgoerelser',
  'endelig-under-50-missing-kapitalisering',
  'delvist-endelig-missing-kapitalisering',
  'kap-dato-without-kap-pct',
  'kap-pct-without-kap-dato',
  'missing-kap-dato',
  'missing-kap-pct',
  'missing-koen',
  'virkningsdato-after-tidlkap-dato',
  'kap-dato-not-after-tidlkap-dato',
  'kapitaliseringsbekendtgoerelse-missing-control-date',
  'kapitaliseringsbekendtgoerelse-missing-effective-date',
  'kapitaliseringstabel-missing',
  'kapitaliseringsalder-under-minimum',
  'kapitaliseringsfaktor-unresolved',
  'reguleringssats-missing',
  'reguleringssats-missing-2024',
  'aarsloen-max-missing',
  'warn-asl-eet-under-15',
  'warn-asl-aarsloen-is-max',
  'warn-invalid-eet-pct-after-2024-07-01',
  'warn-non-endelig-after-endelig',
  'warn-afgoerelsesdato-after-beregningsdato',
  'warn-virkningsdato-after-beregningsdato',
  'warn-kap-dato-after-beregningsdato',
  'warn-kap-pct-under-15',
  'warn-ingen-kap-input',
]);

/**
 * Centralt navigationsmapping for alle EET-issue-IDs.
 * Alle faner bruger denne funktion — divergerende navigation pr. fane håndteres
 * ikke, da ingen kendte IDs kræver det (den tidligere F3-fejl med warn-kap-pct-under-15
 * er rettet her).
 */
export const resolveEetIssueNavigation = (issueId: string): EetTabNavigation | null => {
  if (STAMDATA_IDS.has(issueId)) return NAV_STAMDATA_SKADELIDTE;
  if (GRUNDLAEGGENDE_IDS.has(issueId)) return NAV_EET_GRUNDLAEGGENDE;
  if (EAL_IDS.has(issueId)) return NAV_EET_EAL;
  if (ASL_IDS.has(issueId)) return NAV_EET_ASL;
  return null;
};

export const navigationSortKey = (issueId: string): number => {
  const nav = resolveEetIssueNavigation(issueId);
  return nav !== null ? (NAVIGATION_SORT_ORDER[nav.sectionId] ?? 99) : 99;
};

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
