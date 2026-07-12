import { Box, Typography } from '@mui/material';
import ContentBox from '../../../../layout/ContentBox';
import InfoTooltipIcon from '../../../../common/InfoTooltipIcon';
import StyledRadioButton from '../../../../inputs/StyledRadioButton';
import StyledToggleSwitch from '../../../../inputs/StyledToggleSwitch';
import StyledYearField from '../../../../inputs/StyledYearField';
import StyledAmountField from '../../../../inputs/StyledAmountField';
import SvieSmerteTable from '../../../../tables/SvieSmerteTable';
import { CellInvalidDraftScopeProvider } from '../../../../../contexts/CellInvalidDraftScopeContext';
import { CELL_TABLE_IDS } from '../../../../../config/cellInvalidDraftScopes';
import { CURRENT_YEAR, MIN_SVIESMERTE_YEAR } from '../../../../../config/dateRanges';
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

/** Sektion 4: Svie- og smertegodtgørelse (krav, periode-tabel, satser, tidligere godtgørelse). */
export default function SvieSmerteSection() {
  const {
    values,
    getChecked,
    handleJaNejSkjulChange,
    handleToggleChange,
    handleNumberBlur,
    handleAmountBlur,
    setFieldValue,
    svie,
    skadedatoISO,
    erErhvervssygdom,
    menAfgoerelseDatoForTabel,
    verserendeKlageMen,
    reportSvieSmerteSatserAarInputError,
    reportSvieSmerteTidligereTotalInputError,
    reportSvieSmerteAktuelPeriodeInputError,
  } = useEoOplysningerVm();

  return (
      <ContentBox className="content-box" data-section-id="sviesmerte">
        <Typography className="section-header">Svie- og smertegodtgørelse</Typography>

        <Box className="row--label-right-hover">
          <Typography className="row--text">Er der krav på svie- og smertegodtgørelse i erstatningsperioden</Typography>
          <Box className="row--label-right-hover__content">
            <StyledRadioButton
              name="kravPaaSvieSmerteGodtgoerelse"
              value={values.kravPaaSvieSmerteGodtgoerelse}
              onCommit={handleJaNejSkjulChange('kravPaaSvieSmerteGodtgoerelse')}
              row={true}
              options={[...KRAV_JA_NEJ_SKJUL_OPTIONS]}
            />
          </Box>
        </Box>

        {erSvieSmerteSektionAktiv(values) && (
          <>
            <Box className="row--label-right-hover">
              <Typography className="row--text">Tidligere beregnet S/S til max.</Typography>
              <Box className="row--label-right-hover__content">
                <StyledToggleSwitch
                  name="tidligereSsMax"
                  checked={getChecked(values.tidligereSsMax)}
                  onCommit={handleToggleChange('tidligereSsMax')}
                />
              </Box>
            </Box>

            {/* Periode-input deler præcis beregningens relevans-prædikat (sektion aktiv +
                ikke "tidligere S/S til max"), så synlighed og neutralisering ikke kan divergere. */}
            {erSvieSmertePeriodeInputRelevant(values) && (
              <>
                <Typography className="row--subheading">
                  Periode:
                  <InfoTooltipIcon title={PERIODE_INFO_TOOLTIP} />
                </Typography>
                <CellInvalidDraftScopeProvider pageKey="erstatningsopgoerelse" tableId={CELL_TABLE_IDS.eoSvieSmerte}>
                <SvieSmerteTable
                  rows={svie.draftRows}
                  committedById={svie.committedById}
                  derivedById={svie.derivedById}
                  overlappingIds={svie.overlappingIds}
                  skadedatoISO={skadedatoISO}
                  menAfgoerelseDato={menAfgoerelseDatoForTabel}
                  erErhvervssygdom={erErhvervssygdom}
                  verserendeKlageMen={verserendeKlageMen}
                  onFieldChange={svie.onFieldChange}
                  onRowBlur={svie.onRowBlur}
                  onDeleteRow={svie.removeRow}
                  onRowsReorder={svie.reorderRows}
                  saveOrderPath="erstatningsopgoerelse.svieSmertePerioder"
                />
                </CellInvalidDraftScopeProvider>

                <Box className="row--label-right-hover">
                  <Typography className="row--text">Hvilket års svie/smerte-satser lægges til grund?</Typography>
                  <Box className="row--label-right-hover__content">
                    <StyledYearField
                      name="svieSmerteSatserAar"
                      width={100}
                      value={values.svieSmerteSatserAar}
                      onCommit={handleNumberBlur('svieSmerteSatserAar')}
                      onFieldError={reportSvieSmerteSatserAarInputError}
                      minYear={MIN_SVIESMERTE_YEAR}
                      maxYear={CURRENT_YEAR}
                    />
                  </Box>
                </Box>

                <Box className="row--label-right-hover">
                  <Typography className="row--text">
                    Svie/smerte-sats ved delvis sygemelding:
                    <InfoTooltipIcon title={DELVIS_SYGEMELDING_SATS_INFO_TOOLTIP} />
                  </Typography>
                  <Box className="row--label-right-hover__content">
                    <StyledRadioButton
                      name="svieSmerteDelvisSygemeldingSats"
                      value={values.svieSmerteDelvisSygemeldingSats}
                      onCommit={(event) => {
                        const next = event.target.value;
                        if (next === 'fuld' || next === 'halv') {
                          return setFieldValue('svieSmerteDelvisSygemeldingSats', next);
                        }
                        return false;
                      }}
                      row={true}
                      options={[
                        { value: 'fuld', label: 'Fuld sats' },
                        { value: 'halv', label: 'Halv sats' },
                      ]}
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
                      <StyledAmountField
                        name="svieSmerteTidligereTotal"
                        width={150}
                        value={values.svieSmerteTidligereTotal}
                        onCommit={handleAmountBlur('svieSmerteTidligereTotal')}
                        onFieldError={reportSvieSmerteTidligereTotalInputError}
                      />
                    </Box>
                  </Box>
                )}

                <Box className="row--label-right-hover">
                  <Typography className="row--text">Evt. allerede modtaget svie/smerte for nuværende erstatningsperiode:</Typography>
                  <Box className="row--label-right-hover__content">
                    <StyledAmountField
                      name="svieSmerteAktuelPeriode"
                      width={150}
                      value={values.svieSmerteAktuelPeriode}
                      onCommit={handleAmountBlur('svieSmerteAktuelPeriode')}
                      onFieldError={reportSvieSmerteAktuelPeriodeInputError}
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
