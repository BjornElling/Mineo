import React from 'react';
import { Box, MenuItem, Typography } from '@mui/material';

import ContentBox from '../../layout/ContentBox';
import AmountField, { MILLION_AMOUNT_FIELD_WIDTH } from '../../../inputCore/react/fields/AmountField';
import ChoiceField from '../../../inputCore/react/fields/ChoiceField';
import DateField from '../../../inputCore/react/fields/DateField';
import IntegerField from '../../../inputCore/react/fields/IntegerField';
import { isoToDanish } from '../../../types/branded';
import { type Koen } from '../../../schemas/formSchemas';
import { useForsoergertabVm } from './forsoergertabContext';
import { createFieldWarning } from '../../../inputCore/fieldWarning';

/**
 * Grundlæggende oplysninger: de tværsektionelle stamdata-datoer, køn og de to årslønsfelter.
 *
 * Skadelidtes fødselsdato er READ-ONLY her — den ejes af Stamdata. Kan den ikke bruges (rød feltfejl eller tom),
 * vises årsagen med et link til den side, hvor den kan rettes, frem for en tom celle.
 *
 * Køn-feltet vises, når kapitaliseringen efterspørger det (`visKoenValg`) ELLER når feltet selv har en aktiv
 * fejl: en skjult, fejlende kontrol ville være en lydløs blokering.
 */
const ForsoergertabOplysningerSection = React.memo(() => {
  const vm = useForsoergertabVm();
  const { fields, locations } = vm;

  return (
    <ContentBox className="content-box" data-section-id="forsoergertab-beregning">
      <Typography className="section-header">Grundlæggende oplysninger</Typography>

      <Box className="row--label-right-hover">
        <Typography className="row--text">Skadelidtes fødselsdato</Typography>
        <Box className="row--label-right-hover__content" sx={{ justifyContent: 'flex-end' }}>
          {vm.skadelidteFodselsdato && !vm.skadelidteFodselsdatoError ? (
            <Typography className="row--text">{isoToDanish(vm.skadelidteFodselsdato)}</Typography>
          ) : (
            <Typography className="row--text" color="text.secondary">
              {vm.skadelidteFodselsdatoError ?? (
                <>
                  Mangler (angiv i&nbsp; {' '}
                  <Typography
                    component="span"
                    className="icon-text-link"
                    color="inherit"
                    onClick={vm.goToStamdata}
                    sx={{ cursor: 'pointer' }}
                  >
                    Stamdata
                  </Typography>
                  )
                </>
              )}
            </Typography>
          )}
        </Box>
      </Box>

      <Box className="row--label-right-hover">
        <Typography className="row--text">{vm.skadedatoLabel}</Typography>
        <Box className="row--label-right-hover__content" sx={{ justifyContent: 'flex-end' }}>
          {vm.skadedato && !vm.skadedatoError ? (
            <Typography className="row--text">{isoToDanish(vm.skadedato)}</Typography>
          ) : (
            <Typography className="row--text" color="text.secondary">
              {vm.skadedatoError ?? (
                <>
                  Mangler (angiv i&nbsp;{' '}
                  <Typography component="span" className="icon-text-link" color="inherit" onClick={vm.goToStamdata} sx={{ cursor: 'pointer' }}>
                    Stamdata
                  </Typography>
                  )
                </>
              )}
            </Typography>
          )}
        </Box>
      </Box>

      {(vm.visKoenValg || vm.koenFieldHasError) && (
        <Box className="row--label-right-hover">
          <Typography className="row--text">Køn</Typography>
          <Box className="row--label-right-hover__content">
            <ChoiceField<Koen>
              field={fields.koen}
              location={locations.koen}
              name="koen"
              placeholder="Vælg køn"
              width={130}
            >
              <MenuItem value={'Mand' satisfies Koen}>Mand</MenuItem>
              <MenuItem value={'Kvinde' satisfies Koen}>Kvinde</MenuItem>
            </ChoiceField>
          </Box>
        </Box>
      )}

      <Typography className="row--subheading">ASL-ydelse</Typography>

      <Box className="row--label-right-hover">
        <Typography className="row--text">Skadelidtes årsløn (efter ASL)</Typography>
        <Box className="row--label-right-hover__content">
          <AmountField
            field={fields.aslAarsloen}
            location={locations.aslAarsloen}
            name="aslAarsloen"
            width={MILLION_AMOUNT_FIELD_WIDTH}
          />
        </Box>
      </Box>

      <Box className="row--label-right-hover">
        <Typography className="row--text">Startdato for ASL-ydelse</Typography>
        <Box className="row--label-right-hover__content">
          <DateField field={fields.virkningsdato} location={locations.virkningsdato} name="virkningsdato" />
        </Box>
      </Box>

      <Box className="row--label-right-hover">
        <Typography className="row--text">Tilkendt for periode</Typography>
        <Box className="row--label-right-hover__content" sx={{ gap: 1 }}>
          <IntegerField
            field={fields.tilkendtForPeriodeAar}
            location={locations.tilkendtForPeriodeAar}
            name="tilkendtForPeriodeAar"
            width={80}
          />
          <Typography className="row--text">år</Typography>
        </Box>
      </Box>

      <Box className="row--label-right-hover">
        <Typography className="row--text">Efterladte ægtefælle/samlevers fødselsdato</Typography>
        <Box className="row--label-right-hover__content">
          <DateField
            field={fields.efterladteFodselsdato}
            location={locations.efterladteFodselsdato}
            name="efterladteFodselsdato"
          />
        </Box>
      </Box>

      <Typography className="row--subheading">EAL-ydelse</Typography>

      <Box className="row--label-right-hover">
        <Typography className="row--text">Skadelidtes årsløn efter EAL (hvis forskellig fra ASL)</Typography>
        <Box className="row--label-right-hover__content">
          <AmountField
            field={fields.ealAarsloen}
            location={locations.ealAarsloen}
            name="ealAarsloen"
            width={MILLION_AMOUNT_FIELD_WIDTH}
            warning={vm.ealAarsloenNotice === undefined ? undefined : createFieldWarning(vm.ealAarsloenNotice)}
          />
        </Box>
      </Box>

    </ContentBox>
  );
});

ForsoergertabOplysningerSection.displayName = 'ForsoergertabOplysningerSection';

export default ForsoergertabOplysningerSection;
