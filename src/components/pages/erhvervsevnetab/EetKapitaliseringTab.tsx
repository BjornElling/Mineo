import React from 'react';
import { Box, Tooltip, Typography } from '@mui/material';
import { Download, ErrorOutline, WarningAmber } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import ContentBox from '../../layout/ContentBox';
import type { ErhvervsevnetabValues } from '../../../schemas/formSchemas';
import { usePersistedSection } from '../../../hooks/usePersistedSection';
import { useFormFieldErrors } from '../../../hooks/useFormFieldErrors';
import { useScrollToSectionWithRetry } from '../../../hooks/useScrollToSectionWithRetry';
import { formatIsoDateLong, formatIsoDateShort } from '../../../utils/dateFormatting';
import { formatAsAmount, formatAsAmountTrimmed } from '../../../utils/formatUtils';
import { dedupeIssuesBySeverityAndMessage } from '../../../utils/issueUtils';
import {
  computeEetKapitaliseringCalculation,
  formatKapitaliseringsPct,
  type EetKapitaliseringIssue,
} from '../../../domain/erhvervsevnetab/eetKapitaliseringCalculation';

type Props = Readonly<{
  values: ErhvervsevnetabValues;
  onGoToEetOplysninger: () => void;
}>;

type ErrorNavigation = Readonly<{
  pageName: string;
  sectionName: string;
  route: '/stamdata' | '/erhvervsevnetab';
  sectionId: string;
}>;

const formatKr = (value: number, precision: 0 | 2 = 0): string => `${formatAsAmount(value, precision)} kr.`;
const formatJaNej = (value: boolean): string => (value ? 'Ja' : 'Nej');
const formatFaktor = (value: number): string => formatAsAmount(value, 3);

const TextHoverRow: React.FC<Readonly<{ text: string }>> = ({ text }) => (
  <Box className="row--label-right-hover">
    <Typography className="row--text">{text}</Typography>
    <Box className="row--label-right-hover__content" />
  </Box>
);

const toFieldIssue = (id: string, message: string | undefined): EetKapitaliseringIssue | null => {
  if (!message || message.trim() === '') return null;
  return { id, severity: 'error', message: message.trim() };
};

const resolveIssueNavigation = (issueId: string): ErrorNavigation | null => {
  if (issueId === 'fodselsdato-missing' || issueId === 'field-fodselsdato' || issueId === 'skadesdato-missing' || issueId === 'field-skadesdato') {
    return {
      pageName: 'Stamdata',
      sectionName: 'Skadelidte',
      route: '/stamdata',
      sectionId: 'stamdata-skadelidte',
    };
  }

  return {
    pageName: 'EET oplysninger',
    sectionName: 'Arbejdsskadesikringsloven',
    route: '/erhvervsevnetab',
    sectionId: 'eet-oplysninger-asl',
  };
};

const NAVIGATION_SORT_ORDER: Record<string, number> = {
  'stamdata-skadelidte': 0,
  'eet-oplysninger-stamdata': 1,
  'eet-oplysninger-asl': 2,
  'eet-oplysninger-eal': 3,
};

const navigationSortKey = (issueId: string): number => {
  const nav = resolveIssueNavigation(issueId);
  return nav !== null ? (NAVIGATION_SORT_ORDER[nav.sectionId] ?? 99) : 99;
};

const EetKapitaliseringTab: React.FC<Props> = ({ values, onGoToEetOplysninger }) => {
  const navigate = useNavigate();
  const stamdata = usePersistedSection('stamdata');
  const stamdataFieldErrors = useFormFieldErrors('stamdata');
  const eetFieldErrors = useFormFieldErrors('erhvervsevnetab');
  const scrollToSectionWithRetry = useScrollToSectionWithRetry();

  const calculationResult = React.useMemo(
    () =>
      computeEetKapitaliseringCalculation({
        erhvervsevnetab: values,
        skadesdato: stamdata?.skadesdato,
        fodselsdato: stamdata?.fodselsdato,
      }),
    [stamdata?.fodselsdato, stamdata?.skadesdato, values]
  );

  const fieldIssues = React.useMemo(() => {
    return [
      toFieldIssue('field-aarsloen-asl', eetFieldErrors.aslAarsloen?.message),
      toFieldIssue('field-asl-afgoerelser', eetFieldErrors.aslAfgoerelser?.message),
      toFieldIssue('field-fodselsdato', stamdataFieldErrors.fodselsdato?.message),
      toFieldIssue('field-skadesdato', stamdataFieldErrors.skadesdato?.message),
    ].filter((issue): issue is EetKapitaliseringIssue => issue !== null);
  }, [
    eetFieldErrors.aslAfgoerelser?.message,
    eetFieldErrors.aslAarsloen?.message,
    stamdataFieldErrors.fodselsdato?.message,
    stamdataFieldErrors.skadesdato?.message,
  ]);

  const issues = React.useMemo(
    () =>
      dedupeIssuesBySeverityAndMessage([...calculationResult.issues, ...fieldIssues]).sort(
        (a, b) => navigationSortKey(a.id) - navigationSortKey(b.id)
      ),
    [calculationResult.issues, fieldIssues]
  );

  const hasBlockingErrors = issues.some((issue) => issue.severity === 'error');
  const computation = calculationResult.computation;
  const afgoerelser = computation?.afgoerelser ?? [];

  const handleNavigate = React.useCallback(
    (navigation: ErrorNavigation) => {
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

  return (
    <Box>
      {issues.length > 0 && (
        <ContentBox className="content-box">
          <Typography className="section-header">Fejl og advarsler</Typography>

          {issues.map((issue) => {
            const navigation = resolveIssueNavigation(issue.id);
            return (
              <Box key={`${issue.severity}-${issue.id}-${issue.message}`} className="row--label-right-hover">
                <Typography className="row--text">{issue.message}</Typography>
                <Box className="row--label-right-hover__content" sx={{ gap: 1 }}>
                  {navigation && (
                    <>
                      <Typography className="row--text">{navigation.pageName} {'->'} </Typography>
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
      )}

      {!hasBlockingErrors && (
        <ContentBox className="content-box">
          <Typography className="section-header">Beregning</Typography>

          <Box className="row--label-right-hover">
            <Typography className="row--text">Download specifikation</Typography>
            <Box className="row--label-right-hover__content">
              <Tooltip title="Download bliver tilgængelig, når PDF-specifikationen er defineret" arrow placement="top">
                <Box
                  tabIndex={-1}
                  sx={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'default',
                  }}
                >
                  <Download sx={{ fontSize: '24px', color: 'text.disabled' }} />
                </Box>
              </Tooltip>
            </Box>
          </Box>
        </ContentBox>
      )}

      {!hasBlockingErrors && afgoerelser.length === 0 && (
        <ContentBox className="content-box">
          <Typography className="section-header">Specifikation</Typography>
          <TextHoverRow text="Der er ingen kapitaliserede afgørelser i sagen." />
        </ContentBox>
      )}

      {!hasBlockingErrors &&
        afgoerelser.map((afgoerelse) => (
          <ContentBox key={afgoerelse.rowId} className="content-box">
            <Typography className="section-header">
              Afgørelse {formatIsoDateLong(afgoerelse.afgoerelsesdato)}
            </Typography>

            <Box className="row--label-right-hover">
              <Typography className="row--text">Kapitaliseringsdato</Typography>
              <Box className="row--label-right-hover__content">
                <Typography className="row--text">{formatIsoDateShort(afgoerelse.kapitaliseringsdato)}</Typography>
              </Box>
            </Box>

            <Typography className="row--subheading">Grundydelse og regulering</Typography>

            <Box className="row--label-right-hover">
              <Typography className="row--text">Kapitalisering</Typography>
              <Box className="row--label-right-hover__content">
                <Typography className="row--text">{formatKapitaliseringsPct(afgoerelse.kapitaliseringspct)}</Typography>
              </Box>
            </Box>

            <Box className="row--label-right-hover">
              <Typography className="row--text">
                Grundydelse ({formatKapitaliseringsPct(afgoerelse.kapitaliseringspct)}): Grundløn × EET × Erstatningsniveau × (100 % − AM-bidrag)
              </Typography>
              <Box className="row--label-right-hover__content">
                <Typography className="row--text">
                  {formatKr(afgoerelse.grundloen, 0)} × {formatKapitaliseringsPct(afgoerelse.kapitaliseringspct)} × {afgoerelse.erstatningsniveauPct} % × {100 - afgoerelse.amBidragPct} % = {formatKr(afgoerelse.grundydelse, 2)}
                </Typography>
              </Box>
            </Box>

            <Box className="row--label-right-hover">
              <Typography className="row--text">Reguleringsprocent ({formatIsoDateLong(afgoerelse.kapitaliseringsdato)})</Typography>
              <Box className="row--label-right-hover__content">
                <Typography className="row--text">{`${formatAsAmountTrimmed(afgoerelse.reguleringsPctRounded4, 4)} %`}</Typography>
              </Box>
            </Box>

            <Box className="row--label-right-hover">
              <Typography className="row--text">{`Årlig ydelse (${formatKr(afgoerelse.grundydelse, 2)} x ${formatAsAmountTrimmed(100 + afgoerelse.reguleringsPctRounded4, 4)} %)`}</Typography>
              <Box className="row--label-right-hover__content">
                <Typography className="row--text">{formatKr(afgoerelse.aarsydelse, 2)}</Typography>
              </Box>
            </Box>

            <Typography className="row--subheading" sx={{ mt: 2 }}>Kapitaliseringsbekendtgørelse og tabel</Typography>

            <Box className="row--label-right-hover">
              <Typography className="row--text">Kapitaliseringsbekendtgørelse</Typography>
              <Box className="row--label-right-hover__content">
                <Typography className="row--text">{afgoerelse.kapitaliseringsbekendtgoerelseLabel}</Typography>
              </Box>
            </Box>

            <Box className="row--label-right-hover">
              <Typography className="row--text">Alder ved kapitalisering</Typography>
              <Box className="row--label-right-hover__content">
                <Typography className="row--text">{`${afgoerelse.alderAar} år, ${afgoerelse.alderMaaneder} måneder`}</Typography>
              </Box>
            </Box>

            <Box className="row--label-right-hover">
              <Typography className="row--text">Folkepensionsalder</Typography>
              <Box className="row--label-right-hover__content">
                <Typography className="row--text">{afgoerelse.folkepensionsalderLabel}</Typography>
              </Box>
            </Box>

            <Box className="row--label-right-hover">
              <Typography className="row--text">Kapitaliseret pga. &lt; 2 år til folkepension?</Typography>
              <Box className="row--label-right-hover__content">
                <Typography className="row--text">{formatJaNej(afgoerelse.kapitaliseretPgaUnderToAarTilFp)}</Typography>
              </Box>
            </Box>

            {afgoerelse.kapitaliseretPgaUnderToAarTilFp && (
              <Box className="row--label-right-hover">
                <Typography className="row--text">Særfaktor (&lt; 2 år til folkepension)</Typography>
                <Box className="row--label-right-hover__content">
                  <Typography className="row--text">{afgoerelse.saerfaktor === null ? '-' : formatFaktor(afgoerelse.saerfaktor)}</Typography>
                </Box>
              </Box>
            )}

            {!afgoerelse.kapitaliseretPgaUnderToAarTilFp && (
              <>
                <Typography className="row--subheading" sx={{ mt: 2 }}>Kapitaliseringsfaktor</Typography>

                <Box className="row--label-right-hover">
                  <Typography className="row--text">Faktor måneds-afhængig?</Typography>
                  <Box className="row--label-right-hover__content">
                    <Typography className="row--text">{afgoerelse.faktorMaanedsAfhaengig ? 'Ja' : 'Nej'}</Typography>
                  </Box>
                </Box>

                {afgoerelse.koenOpdelt && (
                  <Box className="row--label-right-hover">
                    <Typography className="row--text">Køn</Typography>
                    <Box className="row--label-right-hover__content">
                      <Typography className="row--text">{values.koen}</Typography>
                    </Box>
                  </Box>
                )}

                <Box className="row--label-right-hover">
                  <Typography className="row--text">Kapitaliseringsfaktor</Typography>
                  <Box className="row--label-right-hover__content">
                    <Typography className="row--text">{formatFaktor(afgoerelse.kapitaliseringsfaktor)}</Typography>
                  </Box>
                </Box>
              </>
            )}

            <Typography className="row--subheading" sx={{ mt: 2 }}>Kapitalbeløb</Typography>

            <Box className="row--label-right-hover">
              <Typography className="row--text">{`Beregnet kapitalbeløb (${formatKr(afgoerelse.aarsydelse, 2)} x ${formatFaktor(afgoerelse.kapitaliseringsfaktor)})`}</Typography>
              <Box className="row--label-right-hover__content">
                <Typography className="row--text" sx={{ fontWeight: 700 }}>{formatKr(afgoerelse.kapitalbelob, 0)}</Typography>
              </Box>
            </Box>
          </ContentBox>
        ))}
    </Box>
  );
};

export default EetKapitaliseringTab;
