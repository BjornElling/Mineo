import React from 'react';
import { Box, Typography } from '@mui/material';
import ContentBox from '../../layout/ContentBox';
import LabeledControlRow from '../../layout/LabeledControlRow';
import CheckboxField from '../../../inputCore/react/fields/CheckboxField';
import ToggleField from '../../../inputCore/react/fields/ToggleField';
import {
  buildBeregnetDifferencekravLabel,
  buildMerErstatningForhoejelseOverskrift,
  DELVIST_ENDELIG_LOEBENDE_YDELSE_TEKST,
  SAMLET_MER_ERSTATNING_LABEL,
} from '../../../domain/erhvervsevnetab/eetDifferencekravPresentation';
import {
  getEetDifferencekravBilagAvailability,
  type EetDifferencekravBilagKey,
} from '../../../domain/erhvervsevnetab/eetDifferencekravBilag';
import {
  FORHOEJET_PENSIONSALDER_LABEL,
  INDREGN_FORHOEJET_PENSIONSALDER_LABEL,
} from '../../../domain/erhvervsevnetab/eetLabels';
import type { FieldRef } from '../../../inputCore/fieldDescriptor';
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
import EetDocumentDownloadBox from './EetDocumentDownloadBox';
import InfoTooltipIcon from '../../common/InfoTooltipIcon';
import { formatMaaneder, formatPct as formatKapPct } from '../../../domain/erhvervsevnetab/eetFormatUtils';
import { formatKr } from '../../../utils/formatUtils';
import { formatDeductionKr } from '../../../utils/deductionFormatting';
import { toKroner } from '../../../domain/money/money';
import type { ErhvervsevnetabReaderProjection } from '../../../domain/erhvervsevnetab/erhvervsevnetabReaderProjection';
import { type DocumentDownloadHandle } from '../../../document/definition/react/useDocumentDownload';
import {
  erhvervsevnetabBilagEetEfterEalField,
  erhvervsevnetabBilagKapitaliseringField,
  erhvervsevnetabBilagLoebendeYdelserField,
  erhvervsevnetabBilagMerErstatningPensionsalderField,
  erhvervsevnetabBilagOpgoerelseField,
  erhvervsevnetabBilagProformaKapitaliseringField,
  erhvervsevnetabBilagVisUdvidetSpecLoebendeField,
  erhvervsevnetabEndeligEetTilbagevirkendeField,
  erhvervsevnetabIndregnMerErstatningField,
} from '../../../inputCore/catalog/erhvervsevnetabDescriptors';

type Props = Readonly<{
  onGoToEetOplysninger: () => void;
  projection: ErhvervsevnetabReaderProjection;
  /** Dokumentoutputtet, komponeret af siden. Fanen aktiverer det; den konfigurerer det ikke. */
  download: DocumentDownloadHandle<void>;
}>;

const refs = {
  opgoerelse: erhvervsevnetabBilagOpgoerelseField.bind(),
  loebendeYdelser: erhvervsevnetabBilagLoebendeYdelserField.bind(),
  kapitalisering: erhvervsevnetabBilagKapitaliseringField.bind(),
  eetEfterEal: erhvervsevnetabBilagEetEfterEalField.bind(),
  proformaKapitalisering: erhvervsevnetabBilagProformaKapitaliseringField.bind(),
  merErstatningPensionsalder: erhvervsevnetabBilagMerErstatningPensionsalderField.bind(),
  visUdvidetSpecifikationLoebendeYdelserBilag: erhvervsevnetabBilagVisUdvidetSpecLoebendeField.bind(),
  tilbagevirkende: erhvervsevnetabEndeligEetTilbagevirkendeField.bind(),
  merErstatning: erhvervsevnetabIndregnMerErstatningField.bind(),
} as const;

// route + tabKey er eksplicit navigation-metadata (§3.7); alle felter bor på differencekrav-fanen.
const location = (field: string) => ({
  locationId: `erhvervsevnetab:differencekrav:${field}`,
  route: APP_ROUTES.erhvervsevnetab,
  tabKey: ERHVERVSEVNETAB_TAB_KEYS.DIFFERENCEKRAV,
});


const BILAG_FIELD_BY_KEY: Readonly<Record<EetDifferencekravBilagKey, FieldRef<boolean>>> = {
  loebendeYdelser: refs.loebendeYdelser,
  kapitalisering: refs.kapitalisering,
  eetEfterEal: refs.eetEfterEal,
  proformaKapitalisering: refs.proformaKapitalisering,
  merErstatningPensionsalder: refs.merErstatningPensionsalder,
  visUdvidetSpecifikationLoebendeYdelserBilag: refs.visUdvidetSpecifikationLoebendeYdelserBilag,
};

const EetDifferencekravTab = ({ onGoToEetOplysninger, projection, download }: Props) => {
  const values = projection.values;
  const snapshot = projection.snapshot.differencekrav;
  const issues = snapshot.issues;
  const hasBlockingErrors = snapshot.hasBlockingErrors;
  const computation = snapshot.computation;

  // Samme opslag som dokumentkilden bruger, så et gemt valg for et bilag uden indhold hverken kan
  // stå afkrydset på fladen eller love en side i papiret.
  const bilagAvailability = React.useMemo(
    () => getEetDifferencekravBilagAvailability({
      computation,
      indregnMerErstatningVedForhoejetPensionsalder: values.indregnMerErstatningVedForhoejetPensionsalder,
      loebendeYdelserBilagValgt: values.eetDifferencekravBilagSelection.loebendeYdelser,
    }),
    [computation, values.indregnMerErstatningVedForhoejetPensionsalder, values.eetDifferencekravBilagSelection.loebendeYdelser]
  );

  const renderBilagCheckbox = React.useCallback((key: EetDifferencekravBilagKey, label: string) => {
    const availability = bilagAvailability[key];
    // Inaktivering og årsag leveres som ÉN prop, så feltfamilien selv ejer tooltip-indpakningen
    // (hover-fladen for et disabled input). Fladen skjuler aldrig et utilgængeligt bilagsvalg.
    return (
      <CheckboxField
        key={key}
        field={BILAG_FIELD_BY_KEY[key]}
        location={location(`bilag-${key}`)}
        name={key}
        label={label}
        unavailableReason={availability.enabled ? null : availability.disabledReason}
      />
    );
  }, [bilagAvailability]);

  return (
    <Box>
      <EetIssuesBox
        issues={issues}
        onGoToEetOplysninger={onGoToEetOplysninger}
      />

      {hasBlockingErrors && <EetDocumentDownloadBox download={download} />}

      {/* Beregning */}
      {!hasBlockingErrors && computation && (
        <ContentBox className="content-box">
          <Typography className="section-header">Beregning</Typography>

          {/*
            Kort form `dd-mm-åååå` som fanens øvrige etiketterede datorækker – og som dokumentet
            allerede brugte. Rækken stod i langform ved siden af «Kapitaliseringsdato 01-06-2022» i
            proformaboksen, altså samme dag skrevet på to måder i samme kolonne på samme skærm, og
            dokumentet var samtidig uenig med skærmen om netop denne række (BB-199). Overskrifter og
            indlejrede prosadatoer beholder deres egne former.
          */}
          <Box className="row--label-right-hover">
            <Typography className="row--text">Beregningsdato</Typography>
            <Box className="row--label-right-hover__content">
              <Typography className="row--text">{formatISOToDanish(computation.beregningsdato)}</Typography>
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
              {/* Bilagsvalgene står som to højrestillede linjer med samme tætte afstand som på EO-siden. */}
              <Box
                className="disabled-hover-checkbox-group"
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 0,
                  alignItems: 'flex-end',
                  '& .MuiFormControlLabel-label': {
                    fontFamily: 'var(--font-family-base)',
                    fontSize: '15px',
                    fontWeight: 'var(--font-weight-regular)',
                    lineHeight: 'var(--line-height-base)',
                    color: 'var(--mineo-color-row-text)',
                  },
                }}
              >
                {/*
                  ALLE bilagsvalg vises ALTID – også når bilaget ikke findes i den aktuelle beregning.
                  De gøres da inaktive og umarkerede med årsagen i tooltippet, frem for at forsvinde fra
                  rækken (jf. page-component-contract.md §"Bilagsvalg og andre betingede
                  afkrydsningsfelter"). Et valg der forsvinder, efterlader brugeren i tvivl om, hvorvidt
                  muligheden findes – og et valg, der står afkrydset og aktivt for et bilag uden
                  indhold, lover en side, papiret ikke har (BB-188).
                */}
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <CheckboxField
                    field={refs.opgoerelse}
                    location={location('bilag-opgoerelse')}
                    name="opgoerelse"
                    // Opgørelsen indgår ALTID; `lockedOn` er den modsatte tilstand af `disabled`:
                    // altid markeret, aldrig redigerbar. Samme model som EO's «Opgørelse», og
                    // dokumentkilden tvinger samme valg sandt, så visning og dokument ikke kan komme
                    // fra hinanden.
                    lockedOn
                    unavailableReason={null}
                    label="Opgørelse"
                  />
                  {renderBilagCheckbox('loebendeYdelser', 'Løbende ydelser')}
                  {renderBilagCheckbox('kapitalisering', 'Kapitalisering')}
                  {renderBilagCheckbox('eetEfterEal', 'EET efter EAL')}
                </Box>
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  {renderBilagCheckbox('proformaKapitalisering', 'Proformakap. af rest-EET')}
                  {renderBilagCheckbox('merErstatningPensionsalder', FORHOEJET_PENSIONSALDER_LABEL)}
                </Box>
              </Box>
            </Box>
          </Box>

          <LabeledControlRow label="Medtag udvidet specifikation på løbende ydelser">
            {({ labelledBy, controlId }) => (
              <ToggleField
                field={refs.visUdvidetSpecifikationLoebendeYdelserBilag}
                location={location('visUdvidetSpecifikationLoebendeYdelserBilag')}
                name="visUdvidetSpecifikationLoebendeYdelserBilag"
                id={controlId}
                labelledBy={labelledBy}
                // Togglen styrer en ekstra side I løbende-ydelsesbilaget og kan derfor kun betjenes,
                // når det bilag både findes og er valgt (BB-188).
                unavailableReason={
                  bilagAvailability.visUdvidetSpecifikationLoebendeYdelserBilag.enabled
                    ? null
                    : bilagAvailability.visUdvidetSpecifikationLoebendeYdelserBilag.disabledReason
                }
              />
            )}
          </LabeledControlRow>
        </ContentBox>
      )}

      {/* Valgmuligheder */}
      <ContentBox className="content-box">
        <Typography className="section-header">Valgmuligheder</Typography>

        <LabeledControlRow
          label={
            <>
              Endelig EET-afgørelse kan gøre tidligere udbetalt midl. EET til endeligt med tilbagevirkende kraft
              <InfoTooltipIcon title="Opstår ved endelig afgørelse, der får virkning for en periode, der tidligere er udbetalt midlertidig EET for" />
            </>
          }
        >
          {({ labelledBy, controlId }) => (
            <ToggleField
              field={refs.tilbagevirkende}
              location={location('tilbagevirkende')}
              name="endeligEetGoerMidlertidigEndeligMedTilbagevirkendeKraft"
              id={controlId}
              labelledBy={labelledBy}
            />
          )}
        </LabeledControlRow>

        {/* Samme navn som bilagsvalget, boksen, specifikationen og dokumentet (BB-191). */}
        <LabeledControlRow label={INDREGN_FORHOEJET_PENSIONSALDER_LABEL}>
          {({ labelledBy, controlId }) => (
            <ToggleField
              field={refs.merErstatning}
              location={location('merErstatning')}
              name="indregnMerErstatningVedForhoejetPensionsalder"
              id={controlId}
              labelledBy={labelledBy}
            />
          )}
        </LabeledControlRow>

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
                      <Typography className="row--text">{formatDeductionKr(toKroner(afgoerelse.beloebOre))}</Typography>
                    </Box>
                  </Box>
                )}

                {!foretages && tvk && (
                  <Box className="row--label-right-hover">
                    <Typography className="row--text">
                      {`Løbende ydelser (${formatISOToDanish(tvk.fra)} - ${formatISOToDanish(tvk.til)}):`}
                    </Typography>
                    <Box className="row--label-right-hover__content">
                      <Typography className="row--text">{formatDeductionKr(toKroner(tvk.beloebOre))}</Typography>
                    </Box>
                  </Box>
                )}

                {!foretages && !tvk && afgoerelse.afgoerelseType !== 'Midlertidig' && (
                  <HoverRow text={DELVIST_ENDELIG_LOEBENDE_YDELSE_TEKST} />
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
                    <Typography className="row--text">{formatDeductionKr(toKroner(afgoerelse.kapitalbelobOre))}</Typography>
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
                      {`${formatMaaneder(computation.resterendeLoebendeYdelser.tilbageraevendeMaaneder)} mdr. x ${formatKr(toKroner(computation.resterendeLoebendeYdelser.maanedligYdelseOre))}/md. =`}
                    </Typography>
                    <Box className="row--label-right-hover__content">
                      <Typography className="row--text">{formatDeductionKr(toKroner(computation.resterendeLoebendeYdelser.fradragBeloebOre))}</Typography>
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
                      <Typography className="row--text">{formatDeductionKr(toKroner(computation.proformaKapitalisering.proformaBeloebOre))}</Typography>
                    </Box>
                  </Box>
                </>
              ) : null}
            </>
          )}

          {/* Forhøjet pensionsalder */}
          {computation.merErstatningPensionsalder && (
            <>
              <Typography className="row--subheading" sx={{ mt: 2 }}>{FORHOEJET_PENSIONSALDER_LABEL}</Typography>
              {computation.merErstatningPensionsalder.events.map((event) => (
                <Box key={`${event.rowId}-${event.forhoejelsesdato}`} className="row--label-right-hover">
                  <Typography className="row--text">
                    {`${buildMerErstatningForhoejelseOverskrift({
                      forhoejelsesdatoFormatted: formatISOToDanish(event.forhoejelsesdato),
                      gammelAlderLabel: event.gammelAlderLabel,
                      nyAlderLabel: event.nyAlderLabel,
                      kapitaliseringspctFormatted: formatKapPct(event.kapitaliseringspct),
                      kapitaliseringsdatoFormatted: formatISOToDanish(event.kapitaliseringsdato),
                    })}:`}
                  </Typography>
                  <Box className="row--label-right-hover__content">
                    <Typography className="row--text">{formatDeductionKr(toKroner(event.merErstatningOre))}</Typography>
                  </Box>
                </Box>
              ))}
              {/*
                Summen er det beløb, der faktisk fratrækkes differencekravet, og den vises derfor de
                samme tre steder: her, i boksen nedenfor og i dokumentets bilag (BB-201).
              */}
              {computation.merErstatningPensionsalder.events.length > 1 && (
                <Box className="row--label-right-hover">
                  <Typography className="row--text">{`${SAMLET_MER_ERSTATNING_LABEL}:`}</Typography>
                  <Box className="row--label-right-hover__content">
                    <Typography className="row--text">
                      {formatDeductionKr(toKroner(computation.merErstatningPensionsalder.samletMerErstatningOre))}
                    </Typography>
                  </Box>
                </Box>
              )}
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
