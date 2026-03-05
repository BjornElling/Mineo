import * as React from 'react';
import { Alert, AlertTitle, Box, Typography } from '@mui/material';
import { Check, ErrorOutline, WarningAmber } from '@mui/icons-material';
import ContentBox from '../../layout/ContentBox';
import { useEOLoenindkomstInputErrors } from '../../../hooks/useEOLoenindkomstInputErrors';
import { useAppSettings } from '../../../contexts/AppSettingsContext';
import { eoSnapshotToDebugView } from '../../../domain/erstatningsopgoerelse/eoSnapshotToDebugView';
import { getSammentaellingControlStatus, type SammentaellingDisplayRow } from '../../../domain/debug/eoDebugSammentaelling';
import type { EoSnapshot } from '../../../domain/erstatningsopgoerelse/eoSnapshot';
import EODebugLoenSections from './EODebugLoenSections';
import EODebugRegulationSections from './EODebugRegulationSections';
import EODebugRowsSection from './EODebugRowsSection';

type EODebugProps = Readonly<{
  eoSnapshot?: EoSnapshot | null;
}>;

const getControlIcon = (row: SammentaellingDisplayRow): React.ReactElement => {
  const status = getSammentaellingControlStatus(row.control);
  switch (status) {
    case 'error':
      return <ErrorOutline sx={{ color: 'red', fontSize: 20 }} />;
    case 'warning':
      return <WarningAmber sx={{ color: 'orange', fontSize: 20 }} />;
    case 'ok':
      return <Check sx={{ color: 'green', fontSize: 20 }} />;
  }
};

const EODebugSammentaellingSection = React.memo<{
  rows: readonly SammentaellingDisplayRow[];
}>(({ rows }) => {
  if (rows.length === 0) {
    return null;
  }

  return (
    <ContentBox className="content-box">
      <Typography className="section-header">Sammentælling</Typography>

      {rows.map((row) => (
        <Box key={row.key} className="row--label-right-hover" sx={{ '--label-width': '360px' }}>
          <Typography className="row--text">{row.label}</Typography>
          <Box className="row--label-right-hover__content" sx={{ gap: 2 }}>
            <Typography className="row--text">
              Beregnet: {row.control.beregnetDisplay} | Tabel: {row.control.tabelDisplay}
            </Typography>
            {getControlIcon(row)}
          </Box>
        </Box>
      ))}
    </ContentBox>
  );
});

EODebugSammentaellingSection.displayName = 'EODebugSammentaellingSection';

const EODebug = ({ eoSnapshot = null }: EODebugProps) => {
  const manuelReguleringInputErrors = useEOLoenindkomstInputErrors();
  const { settings } = useAppSettings();

  const view = React.useMemo(() => eoSnapshotToDebugView({
    snapshot: eoSnapshot,
    appSettings: settings,
    loenindkomstManuelReguleringInputErrors: manuelReguleringInputErrors,
  }), [eoSnapshot, manuelReguleringInputErrors, settings]);

  if (view.kind === 'blocked') {
    return (
      <ContentBox className="content-box">
        <Alert severity={view.severity} sx={{ borderRadius: '10px' }}>
          <AlertTitle sx={{ fontWeight: 500 }}>{view.title}</AlertTitle>
          {view.message}
        </Alert>
      </ContentBox>
    );
  }

  const { erstatningsopgoerelseValues, rowsBySection } = view;
  const viserMidlertidigtEet = erstatningsopgoerelseValues.midlertidigtEetAfgorelse === 'Ja';
  const viserEndeligtEet = erstatningsopgoerelseValues.endeligtEetAfgorelse === 'Ja';
  const aesRows = rowsBySection.get('aes') ?? [];
  const filtreredeAesRows = aesRows.filter((row) => {
    if (!viserMidlertidigtEet && row.group === 'aes.midlertidigtEet') return false;
    if (!viserEndeligtEet && row.group === 'aes.endeligtEet') return false;
    return true;
  });

  return (
    <Box>
      <EODebugRowsSection title="Stamdata" rows={rowsBySection.get('stamdata') ?? []} />
      <EODebugRowsSection title="Erstatningsopgørelse" rows={rowsBySection.get('erstatningsopgoerelse') ?? []} />
      <EODebugRowsSection title="Forlig" rows={rowsBySection.get('forlig') ?? []} />
      <EODebugRowsSection title="AES" rows={filtreredeAesRows} />
      <EODebugRowsSection title="Lønindkomst" rows={rowsBySection.get('loenindkomst') ?? []} />
      <EODebugRowsSection title="Offentlige ydelser" rows={rowsBySection.get('offentlige-ydelser') ?? []} />
      <EODebugRowsSection title="Svie og smerte" rows={rowsBySection.get('sviesmerte') ?? []} />
      <EODebugRowsSection title="TAF beregningsgrundlag" rows={rowsBySection.get('taf-beregningsgrundlag') ?? []} />
      <EODebugRowsSection title="TAF" rows={rowsBySection.get('taf') ?? []} />

      {view.regulationSections.length > 0 && (
        <ContentBox className="content-box">
          <Typography className="section-header">Regulering</Typography>
          <EODebugRegulationSections sections={view.regulationSections} />
        </ContentBox>
      )}

      {view.loenSections.length > 0 && (
        <ContentBox className="content-box">
          <Typography className="section-header">Lønoversigter</Typography>
          <EODebugLoenSections sections={view.loenSections} />
        </ContentBox>
      )}

      <EODebugRowsSection title="Øvrige erstatningskrav" rows={rowsBySection.get('oevrige-krav') ?? []} />
      <EODebugRowsSection title="Eventuelle særlige kommentarer" rows={rowsBySection.get('saerlige-kommentarer') ?? []} />
      <EODebugSammentaellingSection rows={view.debugSnapshot.sammentaellingRows} />
    </Box>
  );
};

export default EODebug;
