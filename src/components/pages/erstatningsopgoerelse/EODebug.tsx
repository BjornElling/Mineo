import * as React from 'react';
import { Alert, AlertTitle, Box } from '@mui/material';
import ContentBox from '../../layout/ContentBox';
import { useEOLoenindkomstInputErrors } from '../../../hooks/useEOLoenindkomstInputErrors';
import { useAppSettings } from '../../../contexts/useAppSettings';
import { buildEODebugPageViewModel } from '../../../domain/debug/eoDebugPageViewModel';
import { eoSnapshotToDebugView } from '../../../domain/erstatningsopgoerelse/eoSnapshotToDebugView';
import type { EoSnapshot } from '../../../domain/erstatningsopgoerelse/eoSnapshot';
import EODebugRegulationSections from './EODebugRegulationSections';
import EODebugRowsSection from './EODebugRowsSection';
import EODebugEmploymentSections from './EODebugEmploymentSections';
import EODebugGroupedRowsSection from './EODebugGroupedRowsSection';

type EODebugProps = Readonly<{
  eoSnapshot?: EoSnapshot | null;
}>;

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

  const pageView = buildEODebugPageViewModel(view, settings);

  return (
    <Box>
      <EODebugRowsSection title="Stamdata" rows={pageView.stamdataRows} />
      <EODebugRowsSection title="Erstatningsopgørelse" rows={pageView.erstatningsopgoerelseRows} />
      <EODebugRowsSection title="Forlig" rows={pageView.forligRows} />
      <EODebugRowsSection title="AES" rows={pageView.aesRows} />
      {pageView.showSvieSmerteSection && (
        <EODebugRowsSection title="Svie og smerte" rows={pageView.svieSmerteRows} />
      )}
      {pageView.showTabtArbejdsfortjenesteSections && (
        <EODebugRowsSection title="Tabt arbejdsfortjeneste" rows={pageView.tafRows} />
      )}
      {pageView.showTabtArbejdsfortjenesteSections && (
        <EODebugRowsSection title="TAF beregningsgrundlag" rows={pageView.tafBeregningsgrundlagRows} />
      )}
      {pageView.showTabtArbejdsfortjenesteSections && (
        pageView.employmentSections.length > 0
          ? <EODebugEmploymentSections sections={pageView.employmentSections} />
          : (
            <EODebugRowsSection title="Lønindkomst" rows={pageView.loenindkomstRows} />
          )
      )}
      {pageView.showTabtArbejdsfortjenesteSections && (
        <EODebugRowsSection title="Offentlige ydelser" rows={pageView.offentligeYdelserRows} />
      )}
      {pageView.showTabtArbejdsfortjenesteSections && pageView.orphanSfggSections.length > 0 && (
        <EODebugGroupedRowsSection title="Sygeferiegodtgørelse" sections={pageView.orphanSfggSections} />
      )}

      {pageView.showTabtArbejdsfortjenesteSections && pageView.orphanRegulationSections.length > 0 && (
        <EODebugRegulationSections sections={pageView.orphanRegulationSections} />
      )}

      <EODebugRowsSection title="Øvrige erstatningskrav" rows={pageView.oevrigeKravRows} />
      <EODebugRowsSection title="Eventuelle særlige kommentarer" rows={pageView.saerligeKommentarerRows} />
      <EODebugRowsSection title="Bilagsnumre" rows={pageView.bilagsnumreRows} />
    </Box>
  );
};

export default EODebug;
