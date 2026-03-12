import React from 'react';
import { Box, Fab, Tooltip, type BoxProps } from '@mui/material';
import BugReportIcon from '@mui/icons-material/BugReport';
import { useLocation } from 'react-router-dom';
import { useAppSettings } from '../../contexts/useAppSettings';
import ContentBoxReportDialog from '../reports/ContentBoxReportDialog';
import type { ContentBoxIdentity } from '../../utils/bugReport';

type ContentBoxProps = BoxProps & {
  disableReport?: boolean;
};

const getTextContent = (element: Element | null): string | undefined => {
  const text = element?.textContent?.trim();
  return text && text.length > 0 ? text : undefined;
};

const ContentBox = React.memo(({ className, sx, children, disableReport = false, ...rest }: ContentBoxProps) => {
  const { settings } = useAppSettings();
  const location = useLocation();
  const contentBoxRef = React.useRef<HTMLDivElement>(null);
  const [reportOpen, setReportOpen] = React.useState(false);
  const [identity, setIdentity] = React.useState<ContentBoxIdentity>({ routePath: location.pathname });

  const contentBoxId = React.useId().replace(/:/g, '');

  const resolvedClassName = React.useMemo(() => {
    if (!className) return 'content-box';
    return className.includes('content-box') ? className : `content-box ${className}`;
  }, [className]);

  const resolvedSx = React.useMemo(() => {
    const base = { position: 'relative' as const };
    if (!sx) return base;
    return Array.isArray(sx) ? [base, ...sx] : [base, sx];
  }, [sx]);

  const resolveIdentity = React.useCallback((): ContentBoxIdentity => {
    const element = contentBoxRef.current;
    const allBoxes = Array.from(document.querySelectorAll('.content-box'));
    const index = element ? allBoxes.indexOf(element) : -1;
    const sectionTitle = element ? getTextContent(element.querySelector('.section-header')) : undefined;
    const pageTitle = getTextContent(document.querySelector('.page-title'));

    return {
      routePath: location.pathname,
      pageTitle,
      sectionTitle,
      boxIndex: index >= 0 ? index + 1 : undefined,
      boxCount: allBoxes.length > 0 ? allBoxes.length : undefined,
      contentBoxId,
    };
  }, [contentBoxId, location.pathname]);

  const handleOpenReport = React.useCallback(() => {
    setIdentity(resolveIdentity());
    setReportOpen(true);
  }, [resolveIdentity]);

  return (
    <Box
      ref={contentBoxRef}
      className={resolvedClassName}
      sx={resolvedSx}
      data-mineo-content-box="true"
      data-mineo-content-box-id={contentBoxId}
      {...rest}
    >
      {settings.showContentBoxReportButton && !disableReport ? (
        <Tooltip title="Rapportér fejl eller forbedringsønske" arrow placement="top-start">
          <Fab
            size="small"
            className="content-box-report-btn"
            onClick={handleOpenReport}
            tabIndex={-1}
            sx={{
              position: 'absolute',
              top: -16,
              left: -16,
              width: 36,
              height: 36,
              minHeight: 36,
              minWidth: 36,
              boxShadow: 2,
              backgroundColor: '#eef2f6',
              color: 'text.secondary',
              border: '1px solid rgba(0, 0, 0, 0.08)',
              '&:hover': {
                backgroundColor: '#e4eaf2',
                boxShadow: 4,
              },
            }}
          >
            <BugReportIcon sx={{ fontSize: 18 }} />
          </Fab>
        </Tooltip>
      ) : null}

      {children}

      <ContentBoxReportDialog
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        identity={identity}
        contentBoxRef={contentBoxRef}
      />
    </Box>
  );
});

ContentBox.displayName = 'ContentBox';

export default ContentBox;
