import React from 'react';
import { Box, MenuItem, Typography } from '@mui/material';

import ContentBox from '../../layout/ContentBox';
import LabeledControlRow from '../../layout/LabeledControlRow';
import ChoiceField from '../../../inputCore/react/fields/ChoiceField';
import DateField from '../../../inputCore/react/fields/DateField';
import ToggleField from '../../../inputCore/react/fields/ToggleField';
import OverenskomstVaelger from '../../common/OverenskomstVaelger';
import InfoTooltipIcon from '../../common/InfoTooltipIcon';
import { LOEN_PAA_HELLIGDAGE, TILLAEG_ANGIVES_SOM } from '../../../types/loen';
import type { LoenPaaHelligdage } from '../../../schemas/formSchemas/enumSchemas';
import type { AarsloenTillaegsgrundlag } from '../../../schemas/formSchemas/sections/aarsloenSchemas';
import { useAarsloenVm } from './aarsloenContext';

/**
 * Lønforhold: tillægsgrundlaget og de valg, satserne og helårsomregningen hviler på (BB-347/BB-348).
 *
 * Rækkefølgen følger Lønindkomst-kortet: overenskomsten står før det, den låser. «Fuld løn under ferie» og «Løn
 * på helligdage» vises kun, når de læses – altid i Overenskomst, ellers kun ved aktiv omregning (BB-353).
 */
const AarsloenLoenforholdSection = React.memo(() => {
  const { fields, locations, values, visLoenforholdValg } = useAarsloenVm();
  const harOverenskomst = values.tillaegAngivesSom === 'overenskomst';

  return (
    <ContentBox className="content-box">
      <Typography className="section-header">Lønforhold</Typography>

      <Box className="row--label-right-hover">
        <Typography className="row--text">Tillæg beregnes på baggrund af</Typography>
        <Box className="row--label-right-hover__content">
          <ChoiceField<AarsloenTillaegsgrundlag>
            field={fields.tillaegAngivesSom}
            location={locations.tillaegAngivesSom}
            name="tillaegAngivesSom"
            width={185}
            allowEmpty={false}
          >
            <MenuItem value={TILLAEG_ANGIVES_SOM.PROCENT}>Procent</MenuItem>
            <MenuItem value={TILLAEG_ANGIVES_SOM.BELOEB}>Beløb</MenuItem>
            <MenuItem value="overenskomst">Overenskomst</MenuItem>
          </ChoiceField>
        </Box>
      </Box>

      {harOverenskomst && (
        <>
          <OverenskomstVaelger
            namePrefix="aarsloen"
            overenskomst={{ field: fields.overenskomstId, location: locations.overenskomstId }}
            loenmodtager={{ field: fields.overenskomstLoenmodtager, location: locations.overenskomstLoenmodtager, value: values.overenskomstLoenmodtager }}
            arbejdsgiver={{ field: fields.overenskomstArbejdsgiver, location: locations.overenskomstArbejdsgiver, value: values.overenskomstArbejdsgiver }}
          />
          <Box className="row--label-right-hover">
            <Typography className="row--text">
              Reguleringsdato
              <InfoTooltipIcon title="Overenskomstens satser på denne dato anvendes på alle lønrækker." />
            </Typography>
            <Box className="row--label-right-hover__content">
              <DateField field={fields.reguleringsdato} location={locations.reguleringsdato} name="reguleringsdato" />
            </Box>
          </Box>
        </>
      )}

      {visLoenforholdValg && (
        <>
          <LabeledControlRow label="Fuld løn under ferie:">
            {({ labelledBy, controlId }) => (
              <ToggleField
                name="fuldLoenUnderFerie"
                field={fields.fuldLoenUnderFerie}
                location={locations.fuldLoenUnderFerie}
                id={controlId}
                labelledBy={labelledBy}
              />
            )}
          </LabeledControlRow>

          <Box className="row--label-right-hover">
            <Typography className="row--text">Løn på helligdage:</Typography>
            <Box className="row--label-right-hover__content">
              <ChoiceField<LoenPaaHelligdage>
                name="loenPaaHelligdage"
                field={fields.loenPaaHelligdage}
                location={locations.loenPaaHelligdage}
                width={185}
                allowEmpty={false}
              >
                <MenuItem value={LOEN_PAA_HELLIGDAGE.ALMINDELIG}>Almindelig løn</MenuItem>
                <MenuItem value={LOEN_PAA_HELLIGDAGE.SH_UDBETALING}>SH-udbetaling</MenuItem>
                <MenuItem value={LOEN_PAA_HELLIGDAGE.INGEN}>Ingen</MenuItem>
              </ChoiceField>
            </Box>
          </Box>
        </>
      )}

      {harOverenskomst && values.loenPaaHelligdage === LOEN_PAA_HELLIGDAGE.ALMINDELIG && (
        <LabeledControlRow label="Beregn Store Bededagstillæg fra 1. januar 2024:">
          {({ labelledBy, controlId }) => (
            <ToggleField
              field={fields.beregnStoreBededagstillaeg}
              location={locations.beregnStoreBededagstillaeg}
              name="beregnStoreBededagstillaeg"
              id={controlId}
              labelledBy={labelledBy}
            />
          )}
        </LabeledControlRow>
      )}
    </ContentBox>
  );
});

AarsloenLoenforholdSection.displayName = 'AarsloenLoenforholdSection';

export default AarsloenLoenforholdSection;
