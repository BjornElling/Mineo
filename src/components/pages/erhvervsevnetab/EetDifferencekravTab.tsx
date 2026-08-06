import React from 'react';
import { Box, Typography } from '@mui/material';
import ContentBox from '../../layout/ContentBox';
import CheckboxField from '../../../inputCore/react/fields/CheckboxField';
import ToggleField from '../../../inputCore/react/fields/ToggleField';
import PercentField from '../../../inputCore/react/fields/PercentField';
import FractionField from '../../../inputCore/react/fields/FractionField';
import DateField from '../../../inputCore/react/fields/DateField';
import { buildBeregnetDifferencekravLabel } from '../../../domain/erhvervsevnetab/eetDifferencekravPresentation';
import { ERHVERVSEVNETAB_TAB_KEYS } from '../../../domain/erhvervsevnetab/eetIssueNavigation';
import { APP_ROUTES } from '../../../config/pageNavigation';
import { buildForligIndgaaetSaetning } from '../../../domain/erstatningsopgoerelse/engines/forligsgrad';
import { formatIsoDateLong, formatISOToDanish } from '../../../utils/dateFormatting';
import EetIssuesBox from './EetIssuesBox';
import HoverRow from './HoverRow';
import { EetProformaKapitaliseringBox } from './differencekrav/EetProformaKapitaliseringBox';
import { EetMerErstatningPensionsalderBox } from './differencekrav/EetMerErstatningPensionsalderBox';
import DocumentDownloadButton from '../../inputs/DocumentDownloadButton';
import DocumentOutcomeMessage from '../../inputs/DocumentOutcomeMessage';
import InfoTooltipIcon from '../../common/InfoTooltipIcon';
import { formatMaaneder, formatPct as formatKapPct } from '../../../domain/erhvervsevnetab/eetFormatUtils';
import { formatKr } from '../../../utils/formatUtils';
import { toKroner } from '../../../domain/money/money';
import type { ErhvervsevnetabReaderProjection } from '../../../domain/erhvervsevnetab/erhvervsevnetabReaderProjection';
import { type DocumentDownloadHandle } from '../../../document/definition/react/useDocumentDownload';
import {
  erhvervsevnetabBilagEetEfterEalField,
  erhvervsevnetabBilagKapitaliseringField,
  erhvervsevnetabBilagLoebendeYdelserField,
  erhvervsevnetabBilagMerErstatningPensionsalderField,
  erhvervsevnetabBilagProformaKapitaliseringField,
  erhvervsevnetabBilagVisUdvidetSpecLoebendeField,
  erhvervsevnetabEndeligEetTilbagevirkendeField,
  erhvervsevnetabIndregnMerErstatningField,
} from '../../../inputCore/catalog/erhvervsevnetabDescriptors';
import { forligInputFields } from '../../../domain/erstatningsopgoerelse/forligInputPort';

type Props = Readonly<{
  onGoToEetOplysninger: () => void;
  projection: ErhvervsevnetabReaderProjection;
  /** Dokumentoutputtet, komponeret af siden. Fanen aktiverer det; den konfigurerer det ikke. */
  download: DocumentDownloadHandle<void>;
}>;

const refs = {
  loebendeYdelser: erhvervsevnetabBilagLoebendeYdelserField.bind(),
  kapitalisering: erhvervsevnetabBilagKapitaliseringField.bind(),
  eetEfterEal: erhvervsevnetabBilagEetEfterEalField.bind(),
  proformaKapitalisering: erhvervsevnetabBilagProformaKapitaliseringField.bind(),
  merErstatningPensionsalder: erhvervsevnetabBilagMerErstatningPensionsalderField.bind(),
  visUdvidetSpecifikationLoebendeYdelserBilag: erhvervsevnetabBilagVisUdvidetSpecLoebendeField.bind(),
  tilbagevirkende: erhvervsevnetabEndeligEetTilbagevirkendeField.bind(),
  merErstatning: erhvervsevnetabIndregnMerErstatningField.bind(),
  forligProcent: forligInputFields.procent.bind(),
  forligBroek: forligInputFields.broek.bind(),
  forligDato: forligInputFields.dato.bind(),
} as const;

// route + tabKey er eksplicit navigation-metadata (§3.7); alle felter bor på differencekrav-fanen.
const location = (field: string) => ({
  locationId: `erhvervsevnetab:differencekrav:${field}`,
  route: APP_ROUTES.erhvervsevnetab,
  tabKey: ERHVERVSEVNETAB_TAB_KEYS.DIFFERENCEKRAV,
});


const EetDifferencekravTab = ({ onGoToEetOplysninger, projection, download }: Props) => {
  const values = projection.values;
  const snapshot = projection.snapshot.differencekrav;
  const issues = snapshot.issues;
  const hasBlockingErrors = snapshot.hasBlockingErrors;
  const computation = snapshot.computation;

  return (
    <Box>
      <EetIssuesBox
        issues={issues}
        onGoToEetOplysninger={onGoToEetOplysninger}
      />

      {/* Beregning */}
      {!hasBlockingErrors && computation && (
        <ContentBox className="content-box">
          <Typography className="section-header">Beregning</Typography>

          <Box className="row--label-right-hover">
            <Typography className="row--text">Beregningsdato</Typography>
            <Box className="row--label-right-hover__content">
              <Typography className="row--text">{formatIsoDateLong(computation.beregningsdato)}</Typography>
            </Box>
          </Box>

          <Box className="row--label-right-hover">
            <Typography className="row--text">Download specifikation</Typography>
            <Box className="row--label-right-hover__content">
              <DocumentDownloadButton
                onClick={() => void download.download(undefined)}
                disabled={!download.canDownload}
                disabledReason={download.disabledReason}
              />
            </Box>
          </Box>

          {/*
            Gate-blokeringer står allerede i `EetIssuesBox` ovenfor (og skjuler denne boks helt), så de
            vises ikke igen her. Tilbage er stale-afbrud og DEV-serverfejl, som ellers var lydløse.
          */}
          <DocumentOutcomeMessage message={download.errorMessage} />

          <Box className="row--label-right-hover">
            <Typography className="row--text">Bilag, der indsættes</Typography>
            <Box className="row--label-right-hover__content">
              <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                <CheckboxField
                  field={refs.loebendeYdelser}
                  location={location('bilag-loebendeYdelser')}
                  name="loebendeYdelser"
                  label="Løbende ydelser"
                />
                <CheckboxField
                  field={refs.kapitalisering}
                  location={location('bilag-kapitalisering')}
                  name="kapitalisering"
                  label="Kapitalisering"
                />
                <CheckboxField
                  field={refs.eetEfterEal}
                  location={location('bilag-eetEfterEal')}
                  name="eetEfterEal"
                  label="EET efter EAL"
                />
                {computation.proformaKapitalisering && (
                  <CheckboxField
                    field={refs.proformaKapitalisering}
                    location={location('bilag-proformaKapitalisering')}
                    name="proformaKapitalisering"
                    label="Proformakap. af rest-EET"
                  />
                )}
                {computation.merErstatningPensionsalder && (
                  <CheckboxField
                    field={refs.merErstatningPensionsalder}
                    location={location('bilag-merErstatningPensionsalder')}
                    name="merErstatningPensionsalder"
                    label="Mer-erstatning forhøjet folkepension"
                  />
                )}
              </Box>
            </Box>
          </Box>

          <Box className="row--label-right-hover">
            <Typography className="row--text">Medtag udvidet specifikation på løbende ydelser</Typography>
            <Box className="row--label-right-hover__content">
              <ToggleField
                field={refs.visUdvidetSpecifikationLoebendeYdelserBilag}
                location={location('visUdvidetSpecifikationLoebendeYdelserBilag')}
                name="visUdvidetSpecifikationLoebendeYdelserBilag"
              />
            </Box>
          </Box>
        </ContentBox>
      )}

      {/* Valgmuligheder */}
      <ContentBox className="content-box">
        <Typography className="section-header">Valgmuligheder</Typography>

        <Box className="row--label-right-hover">
          <Typography className="row--text">
            Endelig EET-afgørelse kan gøre tidligere udbetalt midl. EET til endeligt med tilbagevirkende kraft
            <InfoTooltipIcon title="Opstår ved endelig afgørelse, der får virkning for en periode, der tidligere er udbetalt midlertidig EET for" />
          </Typography>
          <Box className="row--label-right-hover__content">
            <ToggleField
              field={refs.tilbagevirkende}
              location={location('tilbagevirkende')}
              name="endeligEetGoerMidlertidigEndeligMedTilbagevirkendeKraft"
            />
          </Box>
        </Box>

        <Box className="row--label-right-hover">
          <Typography className="row--text">
            Indregn mer-erstatning ved forhøjet pensionsalder
          </Typography>
          <Box className="row--label-right-hover__content">
            <ToggleField
              field={refs.merErstatning}
              location={location('merErstatning')}
              name="indregnMerErstatningVedForhoejetPensionsalder"
            />
          </Box>
        </Box>

        <Box className="row--label-right-hover">
          <Typography className="row--text">Forlig om ansvarsgrad</Typography>
          <Box className="row--label-right-hover__content">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography className="row--text">Procent</Typography>
              <PercentField
                field={refs.forligProcent}
                location={location('forligProcent')}
                name="forligAnsvarsgradProcent"
                width={100}
              />
              <Typography className="row--text">eller brøk</Typography>
              <FractionField
                field={refs.forligBroek}
                location={location('forligBroek')}
                name="forligAnsvarsgradBroek"
                width={120}
              />
            </Box>
          </Box>
        </Box>

        <Box className="row--label-right-hover">
          <Typography className="row--text">Evt. dato for forlig</Typography>
          <Box className="row--label-right-hover__content">
            <DateField
              field={refs.forligDato}
              location={location('forligDato')}
              name="forligDato"
            />
          </Box>
        </Box>
      </ContentBox>

      {/* Specifikation */}
      {!hasBlockingErrors && computation && (
        <ContentBox className="content-box">
          <Typography className="section-header">Specifikation</Typography>

          {/* EAL-krav */}
          <Typography className="row--subheading">EAL-krav</Typography>
          <HoverRow text={`Erhvervsevnetabet udgør ${formatKapPct(computation.ealEetPct)}.`} />
          <Box className="row--label-right-hover">
            <Typography className="row--text">Det svarer til et beregnet erhvervsevnetab på:</Typography>
            <Box className="row--label-right-hover__content">
              <Typography className="row--text">{formatKr(toKroner(computation.ealKravOre))}</Typography>
            </Box>
          </Box>

          {/* Løbende ASL-ydelser */}
          <Typography className="row--subheading" sx={{ mt: 2 }}>Løbende ASL-ydelser</Typography>

          {computation.fradragGaelderForFoer2011 ? (
            <>
              <HoverRow text="Skaden er indtrådt før 16. juni 2011." />
              <HoverRow text="Der foretages derfor fradrag i differencekravet med midlertidige EET-ydelser." />
            </>
          ) : (
            <>
              <HoverRow text="Skaden er indtrådt den 16. juni 2011 eller senere." />
              <HoverRow text="Der foretages derfor ikke fradrag i differencekravet med midlertidige EET-ydelser." />
            </>
          )}

          {computation.afgoerelser.map((afgoerelse) => {
            const foretages = afgoerelse.fradragForetages;
            const pctLabel = foretages ? ` (${formatKapPct(afgoerelse.eetPct)})` : '';
            const tvk = afgoerelse.tilbagevirkendeKraftFradrag;
            const typeLabel = (() => {
              if (afgoerelse.afgoerelseType === 'Midlertidig') {
                if (foretages) return `Midlertidig afgørelse${pctLabel}`;
                if (tvk) return `Midlertidig afgørelse (gjort endelig fra ${formatISOToDanish(tvk.endeligVirkningsdato)})`;
                return 'Midlertidig afgørelse';
              }
              if (afgoerelse.afgoerelseType === 'Delvist endelig') return `Delvist endelig afgørelse${foretages ? pctLabel : ''}`;
              return `Endelig afgørelse (${formatKapPct(afgoerelse.eetPct)})`;
            })();

            return (
              <Box key={afgoerelse.rowId} sx={{ mt: 1 }}>
                <HoverRow underlined text={`Afgørelse ${formatIsoDateLong(afgoerelse.afgoerelsesdato)}`} />
                <HoverRow text={typeLabel} />

                {foretages && afgoerelse.beloebOre > 0 && (
                  <Box className="row--label-right-hover">
                    <Typography className="row--text">
                      {`Løbende ydelser (${formatISOToDanish(afgoerelse.virkningsdato)} - ${formatISOToDanish(afgoerelse.fradragesTil)}):`}
                    </Typography>
                    <Box className="row--label-right-hover__content">
                      <Typography className="row--text">{`- ${formatKr(toKroner(afgoerelse.beloebOre))}`}</Typography>
                    </Box>
                  </Box>
                )}

                {!foretages && tvk && (
                  <Box className="row--label-right-hover">
                    <Typography className="row--text">
                      {`Løbende ydelser (${formatISOToDanish(tvk.fra)} - ${formatISOToDanish(tvk.til)}):`}
                    </Typography>
                    <Box className="row--label-right-hover__content">
                      <Typography className="row--text">{`- ${formatKr(toKroner(tvk.beloebOre))}`}</Typography>
                    </Box>
                  </Box>
                )}

                {!foretages && !tvk && afgoerelse.afgoerelseType !== 'Midlertidig' && (
                  <HoverRow text="Løbende ydelser derfor ikke relevante." />
                )}

                {foretages && afgoerelse.beloebOre === 0 && (
                  <HoverRow text="Ingen løbende ydelser." />
                )}
              </Box>
            );
          })}

          {computation.afgoerelser.length === 0 && (
            <HoverRow text="Ingen afgørelser." />
          )}

          {/* Kapitaliserede ASL-beløb */}
          <Typography className="row--subheading" sx={{ mt: 2 }}>Kapitaliserede ASL-beløb</Typography>
          <HoverRow text="Værdien af modtagne kapitalbeløb fratrækkes." />

          {computation.kapitaliseringerAfgoerelser.map((afgoerelse) => (
            <Box key={afgoerelse.rowId} sx={{ mt: 1 }}>
              <HoverRow underlined text={`Afgørelse ${formatIsoDateLong(afgoerelse.afgoerelsesdato)}`} />
              {afgoerelse.kapitalbelobOre !== null && afgoerelse.kapitaliseringsdato !== null && afgoerelse.kapitaliseringspct !== null ? (
                <Box className="row--label-right-hover">
                  <Typography className="row--text">
                    {`Kapitaliseret (${formatKapPct(afgoerelse.kapitaliseringspct)}) den ${formatISOToDanish(afgoerelse.kapitaliseringsdato)}:`}
                  </Typography>
                  <Box className="row--label-right-hover__content">
                    <Typography className="row--text">{`- ${formatKr(toKroner(afgoerelse.kapitalbelobOre))}`}</Typography>
                  </Box>
                </Box>
              ) : afgoerelse.kapitaliseringEfterBeregningsdato ? (
                <HoverRow text="Ikke kapitaliseret på beregningsdatoen." />
              ) : (
                <HoverRow text="Ikke kapitaliseret." />
              )}
            </Box>
          ))}

          {computation.kapitaliseringerAfgoerelser.length === 0 && (
            <HoverRow text="Ingen afgørelser." />
          )}

          {/* Resterende erhvervsevnetab */}
          {(computation.proformaKapitalisering || computation.resterendeLoebendeYdelser) && (
            <>
              <Typography className="row--subheading" sx={{ mt: 2 }}>Resterende erhvervsevnetab</Typography>
              {computation.resterendeLoebendeYdelser ? (
                <>
                  <HoverRow text="De tilbageværende løbende ydelser frem til folkepensionsalderen fratrækkes." />
                  <Box className="row--label-right-hover">
                    <Typography className="row--text">
                      {`${formatMaaneder(computation.resterendeLoebendeYdelser.tilbageraevendeMaaneder)} mdr. × ${formatKr(toKroner(computation.resterendeLoebendeYdelser.maanedligYdelseOre))}/md.`}
                    </Typography>
                    <Box className="row--label-right-hover__content">
                      <Typography className="row--text">{`- ${formatKr(toKroner(computation.resterendeLoebendeYdelser.fradragBeloebOre))}`}</Typography>
                    </Box>
                  </Box>
                </>
              ) : computation.proformaKapitalisering ? (
                <>
                  <HoverRow text="Der foretages fradrag med kapitaliseringsværdien af resterende EET." />
                  <Box className="row--label-right-hover">
                    <Typography className="row--text">
                      {`Proformakapitalisering (${formatKapPct(computation.proformaKapitalisering.loebendeEetPct)}) den ${formatISOToDanish(computation.proformaKapitalisering.kapitaliseringsdato)}:`}
                    </Typography>
                    <Box className="row--label-right-hover__content">
                      <Typography className="row--text">{`- ${formatKr(toKroner(computation.proformaKapitalisering.proformaBeloebOre))}`}</Typography>
                    </Box>
                  </Box>
                </>
              ) : null}
            </>
          )}

          {/* Mer-erstatning ved forhøjet folkepensionsalder */}
          {computation.merErstatningPensionsalder && (
            <>
              <Typography className="row--subheading" sx={{ mt: 2 }}>Mer-erstatning ved forhøjet folkepensionsalder</Typography>
              {computation.merErstatningPensionsalder.events.map((event) => (
                <Box key={`${event.rowId}-${event.forhoejelsesdato}`} className="row--label-right-hover">
                  <Typography className="row--text">
                    {`Forhøjelse pr. ${formatISOToDanish(event.forhoejelsesdato)} (${event.gammelAlderLabel} → ${event.nyAlderLabel}):`}
                  </Typography>
                  <Box className="row--label-right-hover__content">
                    <Typography className="row--text">{`- ${formatKr(toKroner(event.merErstatningOre))}`}</Typography>
                  </Box>
                </Box>
              ))}
            </>
          )}

          {/* Differencekrav */}
          <Typography className="row--subheading" sx={{ mt: 2 }}>Differencekrav</Typography>
          {computation.forligLabel !== null && (
            <HoverRow
              text={buildForligIndgaaetSaetning(
                computation.forligLabel,
                computation.forligDato ? formatIsoDateLong(computation.forligDato) : null
              )}
            />
          )}
          <Box className="row--label-right-hover">
            <Typography className="row--text">
              {buildBeregnetDifferencekravLabel(computation.forligLabel, formatKr(toKroner(computation.differencekravFoerForligOre)))}
            </Typography>
            <Box className="row--label-right-hover__content">
              <Typography className="row--text text-bold">{formatKr(toKroner(computation.differencekravOre))}</Typography>
            </Box>
          </Box>
        </ContentBox>
      )}

      {/* Proformakapitalisering af rest-EET */}
      {!hasBlockingErrors && computation?.proformaKapitalisering && (
        <EetProformaKapitaliseringBox
          pk={computation.proformaKapitalisering}
          koen={values.koen}
        />
      )}

      {/* Mer-erstatning ved forhøjet folkepensionsalder */}
      {!hasBlockingErrors && computation?.merErstatningPensionsalder && (
        <EetMerErstatningPensionsalderBox
          computation={computation.merErstatningPensionsalder}
          koen={values.koen}
        />
      )}
    </Box>
  );
};

EetDifferencekravTab.displayName = 'EetDifferencekravTab';

export default EetDifferencekravTab;
