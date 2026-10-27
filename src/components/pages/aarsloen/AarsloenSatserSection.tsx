import { resolveHoejFeriePctAdvarsel } from '../../../domain/loen/feriePctAdvarsel';
import { createFieldWarning } from '../../../inputCore/fieldWarning';
import LabeledControlRow from '../../layout/LabeledControlRow';
import ToggleField from '../../../inputCore/react/fields/ToggleField';
import DateField from '../../../inputCore/react/fields/DateField';
import OverenskomstVaelger from '../../common/OverenskomstVaelger';
import type { AarsloenTillaegsgrundlag } from '../../../schemas/formSchemas/sections/aarsloenSchemas';
import { resolveAarsloenOverenskomstValg } from '../../../domain/aarsloen/aarsloenTillaeg';
import { resolveOverenskomstSatsBindings, resolvePrivatOverenskomstDaekning, resolveLockedOverenskomstSatsTooltip, type OverenskomstSatsField } from '../../../domain/loen/overenskomstSatser';
import React from 'react';
import { Box, MenuItem, Typography } from '@mui/material';

import ContentBox from '../../layout/ContentBox';
import ChoiceField from '../../../inputCore/react/fields/ChoiceField';
import PercentField, { DerivedPercentField } from '../../../inputCore/react/fields/PercentField';
import RadioField from '../../../inputCore/react/fields/RadioField';
import { LOEN_PAA_HELLIGDAGE, TILLAEG_ANGIVES_SOM } from '../../../types/loen';
import type { Loenperiode, LoenPaaHelligdage } from '../../../schemas/formSchemas/enumSchemas';
import { LOENPERIODE_LABELS } from '../../../schemas/formSchemas';
import { useAarsloenVm } from './aarsloenContext';

/**
 * Satser: lønperiode, tillægsform og de fem procentsatser.
 *
 * Procentfelternes 0–100-grænser er canonical bounds-feltvalidatorer, ikke props; et input uden for intervallet
 * er en rød feltfejl, som gater beregningen (§1.6). Procentblokken skjules i Beløb-tilstand – værdierne bevares,
 * men ignoreres af beregningen.
 */
const AarsloenSatserSection = React.memo(() => {
  const { fields, locations, values } = useAarsloenVm();

  const hoejFerieAdvarsel = values.tillaegAngivesSom === 'overenskomst' ? resolveHoejFeriePctAdvarsel(values.feriePct) : undefined;
  const ferieWarning = hoejFerieAdvarsel === undefined ? undefined : createFieldWarning(hoejFerieAdvarsel);
  const valg = resolveAarsloenOverenskomstValg(values);
  const bindings = resolveOverenskomstSatsBindings(valg, values.reguleringsdato);
  const daekning = resolvePrivatOverenskomstDaekning(valg);
  const renderSats = (sats: OverenskomstSatsField) => {
    const binding = bindings[sats];
    return binding.kind === 'bruger'
      ? <PercentField field={fields[sats]} location={locations[sats]} name={sats} placeholder="0" sx={{ width: '100px' }} />
      : <DerivedPercentField value={values[sats]} accessibleName={fields[sats].descriptor.label} name={sats} placeholder="0" infoTooltipText={resolveLockedOverenskomstSatsTooltip(binding, daekning, values.reguleringsdato)} sx={{ width: '100px' }} />;
  };

  return (
    <ContentBox className="content-box">
      <Typography className="section-header">Satser</Typography>

      <Box className="row--label-right-hover">
        <Typography className="row--text">Løn indtastes som:</Typography>
        <Box className="row--label-right-hover__content">
          <RadioField<Loenperiode>
            field={fields.loenperiode}
            location={locations.loenperiode}
            name="loenperiode"
            row
            options={LOENPERIODE_LABELS.options}
          />
        </Box>
      </Box>

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

      {valg.harOverenskomst && (
        <>
          <OverenskomstVaelger
            namePrefix="aarsloen"
            overenskomst={{ field: fields.overenskomstId, location: locations.overenskomstId }}
            loenmodtager={{ field: fields.overenskomstLoenmodtager, location: locations.overenskomstLoenmodtager, value: values.overenskomstLoenmodtager }}
            arbejdsgiver={{ field: fields.overenskomstArbejdsgiver, location: locations.overenskomstArbejdsgiver, value: values.overenskomstArbejdsgiver }}
          />
          <Box className="row--label-right-hover">
            <Typography className="row--text">Reguleringsdato</Typography>
            <Box className="row--label-right-hover__content">
              <DateField field={fields.reguleringsdato} location={locations.reguleringsdato} name="reguleringsdato" />
            </Box>
          </Box>
          {values.loenPaaHelligdage === LOEN_PAA_HELLIGDAGE.ALMINDELIG && (
            <LabeledControlRow label="Beregn Store Bededagstillæg fra 1. januar 2024:">
              {({ labelledBy, controlId }) => <ToggleField field={fields.beregnStoreBededagstillaeg} location={locations.beregnStoreBededagstillaeg} name="beregnStoreBededagstillaeg" id={controlId} labelledBy={labelledBy} />}
            </LabeledControlRow>
          )}
        </>
      )}

      {values.tillaegAngivesSom !== TILLAEG_ANGIVES_SOM.BELOEB && (
        <>
          <Box className="row--label-right-hover">
            <Box sx={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography className="row--text" sx={{ minWidth: '160px' }}>Feriegodtgørelse/-tillæg:</Typography>
                <PercentField field={fields.feriePct} location={locations.feriePct} name="feriePct" {...(ferieWarning === undefined ? {} : { warning: ferieWarning })} placeholder="0" sx={{ width: '100px' }} />
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography className="row--text" sx={{ minWidth: '60px' }}>Fritvalg:</Typography>
                {renderSats('fritvalgPct')}
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography className="row--text" sx={{ minWidth: '140px' }}>SH/SO-sats:</Typography>
                {renderSats('shSoPct')}
              </Box>
            </Box>
          </Box>

          <Box className="row--label-right-hover">
            <Box sx={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography className="row--text" sx={{ minWidth: '160px' }}>Store Bededagstillæg:</Typography>
                {valg.harOverenskomst
                  ? <DerivedPercentField value={values.storeBededagPct} accessibleName="Store Bededagstillæg" name="storeBededagPct" placeholder="0" sx={{ width: '100px' }} />
                  : <PercentField field={fields.storeBededagPct} location={locations.storeBededagPct} name="storeBededagPct" placeholder="0" sx={{ width: '100px' }} />
                }
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography className="row--text" sx={{ minWidth: '190px' }}>Arbejdsgivers pensionsbidrag:</Typography>
                {renderSats('pensionPct')}
              </Box>
            </Box>
          </Box>
        </>
      )}
    </ContentBox>
  );
});

AarsloenSatserSection.displayName = 'AarsloenSatserSection';

export default AarsloenSatserSection;
