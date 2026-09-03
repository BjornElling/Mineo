import React from 'react';
import { Box, MenuItem, Typography } from '@mui/material';

import ContentBox from '../../layout/ContentBox';
import MirroredStamdataRow from '../../layout/MirroredStamdataRow';
import AmountField, { MILLION_AMOUNT_FIELD_WIDTH } from '../../../inputCore/react/fields/AmountField';
import ChoiceField from '../../../inputCore/react/fields/ChoiceField';
import DateField from '../../../inputCore/react/fields/DateField';
import IntegerField from '../../../inputCore/react/fields/IntegerField';
import { isoToDanish } from '../../../types/branded';
import { type Koen } from '../../../schemas/formSchemas';
import { useForsoergertabVm } from './forsoergertabContext';
import { createFieldWarning } from '../../../inputCore/fieldWarning';
import {
  SKADELIDTES_AARSLOEN_ASL_LABEL,
  SKADELIDTES_AARSLOEN_EAL_FELT_LABEL,
} from '../../../domain/aslEalAarsloen/aarsloenLabels';

/**
 * Grundlæggende oplysninger: de tværsektionelle stamdata-datoer, køn og de to årslønsfelter.
 *
 * Skadelidtes fødselsdato er READ-ONLY her – den ejes af Stamdata. Kan den ikke bruges (rød feltfejl eller tom),
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

      <MirroredStamdataRow
        label="Skadelidtes fødselsdato"
        value={vm.skadelidteFodselsdato === undefined ? undefined : isoToDanish(vm.skadelidteFodselsdato)}
        errorMessage={vm.skadelidteFodselsdatoError}
        onNavigate={vm.goToSkadelidteFodselsdato}
      />

      <MirroredStamdataRow
        label={vm.skadedatoLabel}
        value={vm.skadedato === undefined ? undefined : isoToDanish(vm.skadedato)}
        errorMessage={vm.skadedatoError}
        onNavigate={vm.goToSkadedato}
      />

      {(vm.visKoenValg || vm.koenFieldHasError) && (
        <Box className="row--label-right-hover">
          {/* Fladen har to personer i sig; rækken navngiver derfor sin person som de øvrige rækker (BB-134). */}
          <Typography className="row--text">Skadelidtes køn</Typography>
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
        <Typography className="row--text">{SKADELIDTES_AARSLOEN_ASL_LABEL}</Typography>
        <Box className="row--label-right-hover__content">
          <AmountField
            field={fields.aslAarsloen}
            location={locations.aslAarsloen}
            name="aslAarsloen"
            width={MILLION_AMOUNT_FIELD_WIDTH}
            {...vm.domainIssueProps(fields.aslAarsloen)}
          />
        </Box>
      </Box>

      <Box className="row--label-right-hover">
        <Typography className="row--text">Virkningsdato</Typography>
        <Box className="row--label-right-hover__content">
          <DateField
            field={fields.virkningsdato}
            location={locations.virkningsdato}
            name="virkningsdato"
            {...vm.domainIssueProps(fields.virkningsdato)}
          />
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
            {...vm.domainIssueProps(fields.tilkendtForPeriodeAar)}
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
            {...vm.domainIssueProps(fields.efterladteFodselsdato)}
          />
        </Box>
      </Box>

      <Typography className="row--subheading">EAL-ydelse</Typography>

      <Box className="row--label-right-hover">
        <Typography className="row--text">{SKADELIDTES_AARSLOEN_EAL_FELT_LABEL}</Typography>
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
