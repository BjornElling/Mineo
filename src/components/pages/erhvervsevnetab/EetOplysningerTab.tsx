import React from 'react';
import { Box, MenuItem, Typography } from '@mui/material';
import InsertTodayDateButton from '../../inputs/InsertTodayDateButton';
import ContentBox from '../../layout/ContentBox';
import InfoTooltipIcon from '../../common/InfoTooltipIcon';
import EetAslAfgoerelserTable from '../../tables/EetAslAfgoerelserTable';
import AmountField, { MILLION_AMOUNT_FIELD_WIDTH } from '../../../inputCore/react/fields/AmountField';
import ChoiceField from '../../../inputCore/react/fields/ChoiceField';
import DateField from '../../../inputCore/react/fields/DateField';
import PercentField from '../../../inputCore/react/fields/PercentField';
import { useFieldEditor } from '../../../inputCore/react/useFieldEditor';
import {
  erhvervsevnetabBeregningsdatoField,
  erhvervsevnetabEalEetPctField,
  erhvervsevnetabKoenField,
} from '../../../inputCore/catalog/erhvervsevnetabDescriptors';
import {
  faellesAarsloenAslAarsloenField,
  faellesAarsloenEalAarsloenField,
} from '../../../inputCore/catalog/faellesAarsloenDescriptors';
import type { Koen } from '../../../schemas/formSchemas';
import { SKAERING_2015_03_01 } from '../../../domain/erhvervsevnetab/eetSkaeringsdatoer';
import type { ErhvervsevnetabReaderProjection } from '../../../domain/erhvervsevnetab/erhvervsevnetabReaderProjection';
import { ERHVERVSEVNETAB_TAB_KEYS } from '../../../domain/erhvervsevnetab/eetIssueNavigation';
import {
  SKADELIDTES_AARSLOEN_ASL_LABEL,
  SKADELIDTES_AARSLOEN_EAL_LABEL,
} from '../../../domain/aslEalAarsloen/aarsloenLabels';
import { APP_ROUTES } from '../../../config/pageNavigation';
import { dateRanges_erhvervsevnetab } from '../../../config/dateRanges';
import { formatIsoDateLong } from '../../../utils/dateFormatting';
import { getTodayLocalISO } from '../../../utils/dateUtils';
import {
  resolveEetAslAarsloenMaxWarning,
  resolveEetUnder15Warning,
} from '../../../domain/erhvervsevnetab/eetFieldWarnings';

export type EetOplysningerTabProps = Readonly<{
  projection: ErhvervsevnetabReaderProjection;
}>;

const beregningsdatoRef = erhvervsevnetabBeregningsdatoField.bind();
const koenRef = erhvervsevnetabKoenField.bind();
const ealEetPctRef = erhvervsevnetabEalEetPctField.bind();
const aslAarsloenRef = faellesAarsloenAslAarsloenField.bind();
const ealAarsloenRef = faellesAarsloenEalAarsloenField.bind();

// route + tabKey er eksplicit navigation-metadata (§3.7). aslAarsloen/ealAarsloen deler feltadresse med
// Forsørgertab, men bærer HER route `/erhvervsevnetab` + oplysninger-fanen – det er route (ikke feltadresse) der
// bestemmer, hvilken side undo/redo lander på. Dette er den kritiske EET-vs-Forsørgertab-split.
const EET_OPLYSNINGER_NAV = { route: APP_ROUTES.erhvervsevnetab, tabKey: ERHVERVSEVNETAB_TAB_KEYS.EET_OPLYSNINGER } as const;
const LOCATIONS = {
  beregningsdato: { locationId: 'erhvervsevnetab:oplysninger:beregningsdato', ...EET_OPLYSNINGER_NAV },
  koen: { locationId: 'erhvervsevnetab:oplysninger:koen', ...EET_OPLYSNINGER_NAV },
  ealEetPct: { locationId: 'erhvervsevnetab:oplysninger:ealEetPct', ...EET_OPLYSNINGER_NAV },
  aslAarsloen: { locationId: 'erhvervsevnetab:oplysninger:aslAarsloen', ...EET_OPLYSNINGER_NAV },
  ealAarsloen: { locationId: 'erhvervsevnetab:oplysninger:ealAarsloen', ...EET_OPLYSNINGER_NAV },
} as const;

const EetOplysningerTab = ({ projection }: EetOplysningerTabProps) => {
  const { values, skadedato } = projection;
  const beregningsdatoController = useFieldEditor(beregningsdatoRef, LOCATIONS.beregningsdato);

  // "Indsæt dags dato" må ikke kunne producere en værdi, feltet selv afviser (samme fejlklasse som
  // Varige méns BB-068): er dags dato uden for beregningsdatoens øvre grænse (EET-satsdatasættets
  // sidste dækkede år), er knappen inaktiv med årsagen i tooltippen.
  const beregningsdatoMax = dateRanges_erhvervsevnetab.beregningsdato.max;
  const todayIso = React.useMemo(() => getTodayLocalISO(), []);
  const insertTodayDisabledReason = todayIso > beregningsdatoMax
    ? `Der kan kun foretages beregninger frem til ${formatIsoDateLong(beregningsdatoMax)}`
    : undefined;

  const visKoenFelt = React.useMemo(() => {
    const hasKapDatoFoer2015 = values.aslAfgoerelser.some(
      (row) => row.kapDato !== undefined && row.kapDato < SKAERING_2015_03_01
    );
    const hasBeregningsdatoFoer2015 =
      values.beregningsdato !== undefined && values.beregningsdato < SKAERING_2015_03_01;
    return (skadedato !== undefined && skadedato < SKAERING_2015_03_01)
      || hasKapDatoFoer2015
      || hasBeregningsdatoFoer2015;
  }, [skadedato, values.aslAfgoerelser, values.beregningsdato]);

  return (
    <>
      <ContentBox className="content-box" data-section-id="eet-oplysninger-grundlaeggende">
        <Typography className="section-header">Grundlæggende oplysninger</Typography>

        {visKoenFelt && (
          <Box className="row--label-right-hover">
            <Typography className="row--text">
              Køn
              <InfoTooltipIcon title="Før 01-03-2015 beroede kapitalfaktorer på skadelidtes køn" />
            </Typography>
            <Box className="row--label-right-hover__content">
              <ChoiceField<Koen>
                field={koenRef}
                location={LOCATIONS.koen}
                name="koen"
                placeholder="Vælg køn"
                width={130}
              >
                <MenuItem value="Mand">Mand</MenuItem>
                <MenuItem value="Kvinde">Kvinde</MenuItem>
              </ChoiceField>
            </Box>
          </Box>
        )}

        <Box className="row--label-right-hover">
          <Typography className="row--text">Beregningsdato</Typography>
          <Box className="row--label-right-hover__content" sx={{ gap: 1 }}>
            <DateField
              field={beregningsdatoRef}
              location={LOCATIONS.beregningsdato}
              name="beregningsdato"
            />
            <InsertTodayDateButton
              onCommit={(today) => {
                beregningsdatoController.settleValue(today);
              }}
              disabled={insertTodayDisabledReason !== undefined}
              disabledReason={insertTodayDisabledReason}
            />
          </Box>
        </Box>
      </ContentBox>

      <ContentBox className="content-box" data-section-id="eet-oplysninger-asl">
        <Typography className="section-header">Arbejdsskadesikringsloven</Typography>
        <Box className="row--label-right-hover">
          <Typography className="row--text">{SKADELIDTES_AARSLOEN_ASL_LABEL}</Typography>
          <Box className="row--label-right-hover__content">
            <AmountField
              field={aslAarsloenRef}
              location={LOCATIONS.aslAarsloen}
              name="aslAarsloen"
              width={MILLION_AMOUNT_FIELD_WIDTH}
            />
          </Box>
        </Box>

        <Typography className="row--subheading" sx={{ mt: 2 }}>Afgørelser</Typography>
        <EetAslAfgoerelserTable
          committedRows={projection.aslAfgoerelserCommittedRows}
          ruleIssues={projection.aslAfgoerelserRuleIssues}
          saveOrderPath="erhvervsevnetab.aslAfgoerelser"
        />
      </ContentBox>

      <ContentBox className="content-box" data-section-id="eet-oplysninger-eal">
        <Typography className="section-header">Erstatningsansvarsloven</Typography>
        <Box className="row--label-right-hover">
          <Typography className="row--text">{SKADELIDTES_AARSLOEN_EAL_LABEL}</Typography>
          <Box className="row--label-right-hover__content">
            <AmountField
              field={ealAarsloenRef}
              location={LOCATIONS.ealAarsloen}
              name="ealAarsloen"
              width={MILLION_AMOUNT_FIELD_WIDTH}
              warning={resolveEetAslAarsloenMaxWarning(
                values.aslAarsloen,
                values.ealAarsloen,
                skadedato,
              )}
            />
          </Box>
        </Box>

        <Box className="row--label-right-hover">
          <Typography className="row--text">EET % (hvis afviger fra ASL)</Typography>
          <Box className="row--label-right-hover__content">
            <PercentField
              field={ealEetPctRef}
              location={LOCATIONS.ealEetPct}
              name="ealEetPct"
              placeholder="0"
              warning={resolveEetUnder15Warning(values.ealEetPct)}
            />
          </Box>
        </Box>
      </ContentBox>

      <ContentBox className="content-box" data-section-id="eet-oplysninger-bemaerk">
        <Typography className="section-header">Bemærk</Typography>
        <Box className="row--label-right-hover">
          <Typography className="row--text">For skadelidte i fleksjob skal altid beregnes ny erhvervsevnetabsprocent efter EAL.</Typography>
          <Box className="row--label-right-hover__content" />
        </Box>
        <Box className="row--label-right-hover">
          <Typography className="row--text">Det er ikke muligt for programmet at tage højde for tilskadekomstpension til tidligere tjenestemænd.</Typography>
          <Box className="row--label-right-hover__content" />
        </Box>
        <Box className="row--label-right-hover">
          <Typography className="row--text">Programmet kan ikke foretage beregninger efter den grønlandske arbejdsskadesikringslov.</Typography>
          <Box className="row--label-right-hover__content" />
        </Box>
      </ContentBox>
    </>
  );
};

EetOplysningerTab.displayName = 'EetOplysningerTab';

export default EetOplysningerTab;
