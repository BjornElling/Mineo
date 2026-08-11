import { Box, Typography } from '@mui/material';
import ContentBox from '../../../../layout/ContentBox';
import LabeledControlRow from '../../../../layout/LabeledControlRow';
import InfoTooltipIcon from '../../../../common/InfoTooltipIcon';
import RadioField from '../../../../../inputCore/react/fields/RadioField';
import MappedToggleField from '../../../../../inputCore/react/fields/MappedToggleField';
import YearField from '../../../../../inputCore/react/fields/YearField';
import AmountField from '../../../../../inputCore/react/fields/AmountField';
import InsertTodayDateButton from '../../../../inputs/InsertTodayDateButton';
import SvieSmerteTable from '../../../../tables/SvieSmerteTable';
import {
  eoKravPaaSvieSmerteGodtgoerelseField,
  eoSvieSmerteAktuelPeriodeField,
  eoSvieSmerteDelvisSygemeldingSatsField,
  eoSvieSmerteSatserAarField,
  eoSvieSmerteTidligereTotalField,
  eoTidligereSsMaxField,
} from '../../../../../inputCore/catalog/erstatningsopgoerelseDescriptors';
import { useFieldEditor } from '../../../../../inputCore/react/useFieldEditor';
import {
  erSvieSmerteSektionAktiv,
  erSvieSmertePeriodeInputRelevant,
  erSvieSmerteTidligereTotalRelevant,
} from '../../../../../domain/erstatningsopgoerelse/helpers/eoInputRelevance';
import { useEoOplysningerVm } from '../eoOplysningerContext';
import {
  KRAV_JA_NEJ_SKJUL_OPTIONS,
  PERIODE_INFO_TOOLTIP,
  DELVIS_SYGEMELDING_SATS_INFO_TOOLTIP,
} from '../eoOplysningerConstants';
import { SVIE_SMERTE_DELVIS_SYGEMELDING_SATS_LABELS } from '../../../../../schemas/formSchemas';
import { APP_ROUTES } from '../../../../../config/pageNavigation';
import { EO_TAB_KEYS } from '../../../../../config/eoTabKeys';
import { resolveSvieSmerteSatsAarForReferenceDate } from '../../../../../domain/erstatningsopgoerelse/helpers/svieSmerteSatsAar';
// route + tabKey på location er eksplicit navigation-metadata (§3.7); alle felter i denne sektion bor på EO-oplysningerfanen.

/** Sektion 4: Svie- og smertegodtgørelse (krav, periode-tabel, satser, tidligere godtgørelse). */
export default function SvieSmerteSection() {
  const {
    values,
    svie,
    svieSmerteCutoffDateIssues,
  } = useEoOplysningerVm();
  const satserAarEditor = useFieldEditor(
    eoSvieSmerteSatserAarField.bind(),
    { locationId: 'erstatningsopgoerelse.svieSmerteSatserAar', route: APP_ROUTES.erstatningsopgoerelse, tabKey: EO_TAB_KEYS.EO_OPLYSNINGER }
  );

  return (
      <ContentBox className="content-box" data-section-id="sviesmerte">
        <Typography className="section-header">Svie- og smertegodtgørelse</Typography>

        <Box className="row--label-right-hover">
          <Typography className="row--text">Er der krav på svie- og smertegodtgørelse i erstatningsperioden</Typography>
          <Box className="row--label-right-hover__content">
            <RadioField
              field={eoKravPaaSvieSmerteGodtgoerelseField.bind()}
              location={{ locationId: 'erstatningsopgoerelse.kravPaaSvieSmerteGodtgoerelse', route: APP_ROUTES.erstatningsopgoerelse, tabKey: EO_TAB_KEYS.EO_OPLYSNINGER }}
              name="kravPaaSvieSmerteGodtgoerelse"
              row={true}
              options={[...KRAV_JA_NEJ_SKJUL_OPTIONS]}
            />
          </Box>
        </Box>

        {erSvieSmerteSektionAktiv(values) && (
          <>
            <LabeledControlRow label="Tidligere beregnet S/S til max.">
              {({ labelledBy, controlId }) => (
                <MappedToggleField
                  field={eoTidligereSsMaxField.bind()}
                  location={{ locationId: 'erstatningsopgoerelse.tidligereSsMax', route: APP_ROUTES.erstatningsopgoerelse, tabKey: EO_TAB_KEYS.EO_OPLYSNINGER }}
                  checkedValue="Ja"
                  uncheckedValue="Nej"
                  name="tidligereSsMax"
                  id={controlId}
                  labelledBy={labelledBy}
                />
              )}
            </LabeledControlRow>

            {/* Periode-input deler præcis beregningens relevans-prædikat (sektion aktiv +
                ikke "tidligere S/S til max"), så synlighed og neutralisering ikke kan divergere. */}
            {erSvieSmertePeriodeInputRelevant(values) && (
              <>
                <Typography className="row--subheading">
                  Periode:
                  <InfoTooltipIcon title={PERIODE_INFO_TOOLTIP} />
                </Typography>
                <SvieSmerteTable
                  committedRows={values.svieSmertePerioder}
                  derivedById={svie.derivedById}
                  saveOrderPath="erstatningsopgoerelse.svieSmertePerioder"
                  cutoffIssues={svieSmerteCutoffDateIssues}
                />

                <Box className="row--label-right-hover">
                  <Typography className="row--text">Hvilket års svie/smerte-satser lægges til grund?</Typography>
                  <Box className="row--label-right-hover__content">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <YearField
                        field={eoSvieSmerteSatserAarField.bind()}
                        location={{ locationId: 'erstatningsopgoerelse.svieSmerteSatserAar', route: APP_ROUTES.erstatningsopgoerelse, tabKey: EO_TAB_KEYS.EO_OPLYSNINGER }}
                        name="svieSmerteSatserAar"
                        width={100}
                      />
                      <InsertTodayDateButton
                        tooltip="Indsæt aktuelt årstal"
                        onCommit={(today) => {
                          const satserAar = resolveSvieSmerteSatsAarForReferenceDate(values.opgørelseLavetDen ?? today);
                          if (satserAar !== undefined) satserAarEditor.settleValue(satserAar);
                        }}
                      />
                    </Box>
                  </Box>
                </Box>

                <Box className="row--label-right-hover">
                  <Typography className="row--text">
                    Svie/smerte-sats ved delvis sygemelding:
                    <InfoTooltipIcon title={DELVIS_SYGEMELDING_SATS_INFO_TOOLTIP} />
                  </Typography>
                  <Box className="row--label-right-hover__content">
                    <RadioField
                      field={eoSvieSmerteDelvisSygemeldingSatsField.bind()}
                      location={{ locationId: 'erstatningsopgoerelse.svieSmerteDelvisSygemeldingSats', route: APP_ROUTES.erstatningsopgoerelse, tabKey: EO_TAB_KEYS.EO_OPLYSNINGER }}
                      name="svieSmerteDelvisSygemeldingSats"
                      row={true}
                      options={SVIE_SMERTE_DELVIS_SYGEMELDING_SATS_LABELS.options}
                    />
                  </Box>
                </Box>

                <Typography className="row--subheading">Tidligere svie- og smertegodtgørelse</Typography>

                {/* Synlighed deler samme predikat som beregningens neutralisering,
                    så feltet aldrig kan være skjult i UI'en men aktivt i beregningen. */}
                {erSvieSmerteTidligereTotalRelevant(values) && (
                  <Box className="row--label-right-hover">
                    <Typography className="row--text">Svie/smerte-krav i tidligere erstatningsopgørelser:</Typography>
                    <Box className="row--label-right-hover__content">
                      <AmountField
                        field={eoSvieSmerteTidligereTotalField.bind()}
                        location={{ locationId: 'erstatningsopgoerelse.svieSmerteTidligereTotal', route: APP_ROUTES.erstatningsopgoerelse, tabKey: EO_TAB_KEYS.EO_OPLYSNINGER }}
                        name="svieSmerteTidligereTotal"
                        width={150}
                      />
                    </Box>
                  </Box>
                )}

                <Box className="row--label-right-hover">
                  <Typography className="row--text">Evt. allerede modtaget svie/smerte for nuværende erstatningsperiode:</Typography>
                  <Box className="row--label-right-hover__content">
                    <AmountField
                      field={eoSvieSmerteAktuelPeriodeField.bind()}
                      location={{ locationId: 'erstatningsopgoerelse.svieSmerteAktuelPeriode', route: APP_ROUTES.erstatningsopgoerelse, tabKey: EO_TAB_KEYS.EO_OPLYSNINGER }}
                      name="svieSmerteAktuelPeriode"
                      width={150}
                    />
                  </Box>
                </Box>
              </>
            )}
          </>
        )}
      </ContentBox>
  );
}
