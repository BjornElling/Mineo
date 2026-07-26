import * as React from 'react';
import { Alert, AlertTitle, Box } from '@mui/material';
import ContentBox from '../../layout/ContentBox';
import { useAppSettings } from '../../../contexts/useAppSettings';
import { projectEoRowPolicy, projectSourceSettings } from '../../../settings/sourceSettings';
import { buildEOInspektionPageViewModel } from '../../../domain/eoInspektion/eoInspektionPageViewModel';
import { eoSnapshotToInspektionView } from '../../../domain/erstatningsopgoerelse/snapshot/eoSnapshotToInspektionView';
import type { EoSnapshot } from '../../../domain/erstatningsopgoerelse/snapshot/eoSnapshot';
import EOInspektionRegulationSections from './EOInspektionRegulationSections';
import EOInspektionRowsSection from './EOInspektionRowsSection';
import EOInspektionEmploymentSections from './EOInspektionEmploymentSections';
import EOInspektionGroupedRowsSection from './EOInspektionGroupedRowsSection';

type EOInspektionProps = Readonly<{
  eoSnapshot?: EoSnapshot | null;
  manuelReguleringInputErrors: Readonly<Record<string, true>>;
}>;

const EOInspektion = ({ eoSnapshot = null, manuelReguleringInputErrors }: EOInspektionProps) => {
  const { settings } = useAppSettings();

  // Rækkeevalueringen får KUN politikken (de to regulerings-toggles), aldrig hele `AppSettings`.
  // `buildEOInspektionPageViewModel` nedenfor beholder den brede type: dens tomheds-prædikat er
  // DEV-inspektionens eget og indgår ikke i nogen download-gate.
  const rowPolicy = React.useMemo(
    () => projectEoRowPolicy(projectSourceSettings(settings)),
    [settings]
  );

  const view = React.useMemo(() => eoSnapshotToInspektionView({
    snapshot: eoSnapshot,
    rowPolicy,
    loenindkomstManuelReguleringInputErrors: manuelReguleringInputErrors,
  }), [eoSnapshot, manuelReguleringInputErrors, rowPolicy]);

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

  const pageView = buildEOInspektionPageViewModel(
    view,
    settings
  );

  return (
    <Box>
      <EOInspektionRowsSection title="Stamdata" rows={pageView.stamdataRows} />
      <EOInspektionRowsSection title="Erstatningsopgørelse" rows={pageView.erstatningsopgoerelseRows} />
      <EOInspektionRowsSection title="Forlig" rows={pageView.forligRows} />
      <EOInspektionRowsSection title="AES" rows={pageView.aesRows} />
      {pageView.showSvieSmerteSection && (
        <EOInspektionRowsSection title="Svie og smerte" rows={pageView.svieSmerteRows} />
      )}
      {pageView.showTabtArbejdsfortjenesteSections && (
        <EOInspektionRowsSection title="Tabt arbejdsfortjeneste" rows={pageView.tafRows} />
      )}
      {pageView.showTabtArbejdsfortjenesteSections && (
        <EOInspektionRowsSection title="TAF beregningsgrundlag" rows={pageView.tafBeregningsgrundlagRows} />
      )}
      {pageView.showTabtArbejdsfortjenesteSections && (
        pageView.employmentSections.length > 0
          ? <EOInspektionEmploymentSections sections={pageView.employmentSections} />
          : (
            <EOInspektionRowsSection title="Lønindkomst" rows={pageView.loenindkomstRows} />
          )
      )}
      {pageView.showTabtArbejdsfortjenesteSections && (
        <EOInspektionRowsSection
          title="Offentlige ydelser"
          rows={pageView.offentligeYdelserRows}
          tables={pageView.offentligeYdelserTables}
        />
      )}
      {pageView.showTabtArbejdsfortjenesteSections && pageView.orphanSfggSections.length > 0 && (
        <EOInspektionGroupedRowsSection title="Sygeferiegodtgørelse" sections={pageView.orphanSfggSections} />
      )}

      {pageView.showTabtArbejdsfortjenesteSections && pageView.orphanRegulationSections.length > 0 && (
        <EOInspektionRegulationSections sections={pageView.orphanRegulationSections} />
      )}

      <EOInspektionRowsSection title="Øvrige erstatningskrav" rows={pageView.oevrigeKravRows} />
      <EOInspektionRowsSection title="Eventuelle særlige kommentarer" rows={pageView.saerligeKommentarerRows} />
      <EOInspektionRowsSection title="Bilagsnumre" rows={pageView.bilagsnumreRows} />
    </Box>
  );
};

export default EOInspektion;
