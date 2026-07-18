import { Box, Typography } from '@mui/material';
import ContentBox from '../../../../layout/ContentBox';
import InfoTooltipIcon from '../../../../common/InfoTooltipIcon';
import GreenfieldRadioField from '../../../../../inputCore/react/fields/GreenfieldRadioField';
import GreenfieldAmountField from '../../../../../inputCore/react/fields/GreenfieldAmountField';
import {
  eoKravPaaTabtArbejdsfortjenesteField,
  eoTidligereModtagetTafField,
} from '../../../../../inputCore/catalog/erstatningsopgoerelseDescriptors';
import GreenfieldTafPeriodeTable from '../../../../tables/GreenfieldTafPeriodeTable';
import GreenfieldFerieperiodeTable from '../../../../tables/GreenfieldFerieperiodeTable';
import { erTabtArbejdsfortjenesteSektionAktiv } from '../../../../../domain/erstatningsopgoerelse/helpers/eoInputRelevance';
import { useEoOplysningerVm } from '../eoOplysningerContext';
import { KRAV_JA_NEJ_SKJUL_OPTIONS, PERIODE_INFO_TOOLTIP } from '../eoOplysningerConstants';

/** Sektion 6: Tabt arbejdsfortjeneste (krav, TAF-perioder, ferie i perioden, øvrigt). */
export default function TabtArbejdsfortjenesteSection() {
  const {
    values,
    tafDerived,
    ferieFeriedageById,
  } = useEoOplysningerVm();

  return (
      <ContentBox className="content-box" data-section-id="taf">
        <Typography className="section-header">Tabt arbejdsfortjeneste</Typography>

        <Box className="row--label-right-hover">
          <Typography className="row--text">Er der krav på tabt arbejdsfortjeneste i erstatningsperioden</Typography>
          <Box className="row--label-right-hover__content">
            <GreenfieldRadioField
              field={eoKravPaaTabtArbejdsfortjenesteField.bind()}
              location={{ locationId: 'erstatningsopgoerelse.kravPaaTabtArbejdsfortjeneste' }}
              name="kravPaaTabtArbejdsfortjeneste"
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
            <GreenfieldTafPeriodeTable
              committedRows={values.tafPerioder}
              derivedById={tafDerived.derivedById}
              derivedColumnHeader={tafDerived.kolonneOverskrift}
              saveOrderPath="erstatningsopgoerelse.tafPerioder"
            />

            <Typography className="row--subheading">Evt. ferie i perioden:</Typography>
            <GreenfieldFerieperiodeTable
              kind="taf"
              committedRows={values.ferieperioder}
              feriedageById={ferieFeriedageById}
              saveOrderPath="erstatningsopgoerelse.ferieperioder"
            />

            <Typography className="row--subheading">Øvrigt</Typography>

            <Box className="row--label-right-hover">
              <Typography className="row--text">Evt. allerede modtaget tabt arbejdsfortjeneste for nuværende erstatningsperiode:</Typography>
              <Box className="row--label-right-hover__content">
                <GreenfieldAmountField
                  field={eoTidligereModtagetTafField.bind()}
                  location={{ locationId: 'erstatningsopgoerelse.tidligereModtagetTaf' }}
                  name="tidligereModtagetTaf"
                  width={150}
                />
              </Box>
            </Box>

          </>
        )}
      </ContentBox>
  );
}
