import { Box, Typography } from '@mui/material';
import ContentBox from '../../../../layout/ContentBox';
import InfoTooltipIcon from '../../../../common/InfoTooltipIcon';
import StyledRadioButton from '../../../../inputs/StyledRadioButton';
import StyledAmountField from '../../../../inputs/StyledAmountField';
import TAFPeriodeTable from '../../../../tables/TAFPeriodeTable';
import FerieperiodeTable from '../../../../tables/FerieperiodeTable';
import { CellInvalidDraftScopeProvider } from '../../../../../contexts/CellInvalidDraftScopeContext';
import { CELL_TABLE_IDS } from '../../../../../config/cellInvalidDraftScopes';
import { erTabtArbejdsfortjenesteSektionAktiv } from '../../../../../domain/erstatningsopgoerelse/helpers/eoInputRelevance';
import { useEoOplysningerVm } from '../eoOplysningerContext';
import { KRAV_JA_NEJ_SKJUL_OPTIONS, PERIODE_INFO_TOOLTIP } from '../eoOplysningerConstants';

/** Sektion 6: Tabt arbejdsfortjeneste (krav, TAF-perioder, ferie i perioden, øvrigt). */
export default function TabtArbejdsfortjenesteSection() {
  const {
    values,
    handleJaNejSkjulChange,
    handleAmountBlur,
    taf,
    tafDerived,
    beregningsperiodeTafOverlap,
    ferie,
    ferieFeriedageById,
    skadedatoISO,
    endeligEETBeregnetDato,
    midlertidigEETBeregnetDato,
    erErhvervssygdom,
    verserendeKlageEet,
    reportTidligereModtagetTafInputError,
  } = useEoOplysningerVm();

  return (
      <ContentBox className="content-box" data-section-id="taf">
        <Typography className="section-header">Tabt arbejdsfortjeneste</Typography>

        <Box className="row--label-right-hover">
          <Typography className="row--text">Er der krav på tabt arbejdsfortjeneste i erstatningsperioden</Typography>
          <Box className="row--label-right-hover__content">
            <StyledRadioButton
              name="kravPaaTabtArbejdsfortjeneste"
              value={values.kravPaaTabtArbejdsfortjeneste}
              onCommit={handleJaNejSkjulChange('kravPaaTabtArbejdsfortjeneste')}
              row={true}
              options={[...KRAV_JA_NEJ_SKJUL_OPTIONS]}
            />
          </Box>
        </Box>

        {erTabtArbejdsfortjenesteSektionAktiv(values) && (
          <>
            <Typography className="row--subheading">
              Periode:
              <InfoTooltipIcon title={PERIODE_INFO_TOOLTIP} />
            </Typography>
            <CellInvalidDraftScopeProvider pageKey="erstatningsopgoerelse" tableId={CELL_TABLE_IDS.eoTafPeriode}>
            <TAFPeriodeTable
              rows={taf.draftRows}
              committedById={taf.committedById}
              overlappingIds={taf.overlappingIds}
              onFieldChange={taf.onFieldChange}
              onRowBlur={taf.onRowBlur}
              onDeleteRow={taf.removeRow}
              onRowsReorder={taf.reorderRows}
              derivedById={tafDerived.derivedById}
              derivedColumnHeader={tafDerived.kolonneOverskrift}
              overlapWithBeregningsperiodeByRowId={beregningsperiodeTafOverlap.overlapMessageByRowId}
              skadedatoISO={skadedatoISO}
              endeligEETBeregnetDato={endeligEETBeregnetDato}
              midlertidigEETBeregnetDato={midlertidigEETBeregnetDato}
              differencekravDato={values.differencekravDato}
              erErhvervssygdom={erErhvervssygdom}
              verserendeKlageEet={verserendeKlageEet}
              saveOrderPath="erstatningsopgoerelse.tafPerioder"
            />
            </CellInvalidDraftScopeProvider>

            <Typography className="row--subheading">Evt. ferie i perioden:</Typography>
            <CellInvalidDraftScopeProvider pageKey="erstatningsopgoerelse" tableId={CELL_TABLE_IDS.eoFerieperiode}>
            <FerieperiodeTable
              rows={ferie.draftRows}
              committedById={ferie.committedById}
              feriedageById={ferieFeriedageById}
              onFieldChange={ferie.onFieldChange}
              onRowBlur={ferie.onRowBlur}
              onDeleteRow={ferie.removeRow}
              onRowsReorder={ferie.reorderRows}
              skadedatoISO={skadedatoISO}
              endeligEETBeregnetDato={endeligEETBeregnetDato}
              differencekravDato={values.differencekravDato}
              erErhvervssygdom={erErhvervssygdom}
              verserendeKlageEet={verserendeKlageEet}
              saveOrderPath="erstatningsopgoerelse.ferieperioder"
            />
            </CellInvalidDraftScopeProvider>

            <Typography className="row--subheading">Øvrigt</Typography>

            <Box className="row--label-right-hover">
              <Typography className="row--text">Evt. allerede modtaget tabt arbejdsfortjeneste for nuværende erstatningsperiode:</Typography>
              <Box className="row--label-right-hover__content">
                <StyledAmountField
                  name="tidligereModtagetTaf"
                  width={150}
                  value={values.tidligereModtagetTaf}
                  onCommit={handleAmountBlur('tidligereModtagetTaf')}
                  onFieldError={reportTidligereModtagetTafInputError}
                />
              </Box>
            </Box>

          </>
        )}
      </ContentBox>
  );
}
