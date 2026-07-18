import { Box, MenuItem, Typography } from '@mui/material';
import ContentBox from '../../../../layout/ContentBox';
import GreenfieldTextField from '../../../../../inputCore/react/fields/GreenfieldTextField';
import GreenfieldMappedToggleField from '../../../../../inputCore/react/fields/GreenfieldMappedToggleField';
import GreenfieldDateField from '../../../../../inputCore/react/fields/GreenfieldDateField';
import GreenfieldChoiceField from '../../../../../inputCore/react/fields/GreenfieldChoiceField';
import { GreenfieldChoiceDivider } from '../../../../../inputCore/react/fields/GreenfieldChoiceField';
import InsertTodayDateButton from '../../../../inputs/InsertTodayDateButton';
import { afsluttesMedEnum } from '../../../../../schemas/formSchemas';
import {
  eoAfsluttesMedField,
  eoIndsaetUdkastStempelField,
  eoLedsagetekstField,
  eoNummerField,
  eoOpgørelseLavetDenField,
  eoRevideretOpgoerelseField,
  eoSvieSmerteHelbredsstatusField,
  eoTafArbejdsstatusField,
  eoVedroererPeriodeFraField,
  eoVedroererPeriodeTilField,
} from '../../../../../inputCore/catalog/erstatningsopgoerelseDescriptors';
import { useFieldEditor } from '../../../../../inputCore/react/useFieldEditor';
import { useEoOplysningerVm } from '../eoOplysningerContext';

/** Sektion 1: Erstatningsopgørelse-info (nummer, periode, status, bekræftelse). */
export default function EoSagsinfoSection() {
  const {
    opgoerelseLavetDenInputRef,
    statusSubheaderLabel,
  } = useEoOplysningerVm();
  const opgoerelseLavetDenEditor = useFieldEditor(
    eoOpgørelseLavetDenField.bind(),
    { locationId: 'erstatningsopgoerelse.opgørelseLavetDen' }
  );

  return (
      <ContentBox className="content-box">
        <Typography className="section-header">Erstatningsopgørelse</Typography>

        <Box className="row--label-right-hover" sx={{ '--label-width': '250px' }}>
          <Typography className="row--text">Erstatningsopgørelse</Typography>
          <Box className="row--label-right-hover__content">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography className="row--text">Nummer</Typography>
              <GreenfieldTextField
                field={eoNummerField.bind()}
                location={{ locationId: 'erstatningsopgoerelse.eoNummer' }}
                name="eoNummer"
                width={80}
                sx={{ '& .MuiInputBase-input': { textAlign: 'center' } }}
              />
              <Typography className="row--text">+ evt. ledsagetekst</Typography>
              <GreenfieldTextField
                field={eoLedsagetekstField.bind()}
                location={{ locationId: 'erstatningsopgoerelse.eoLedsagetekst' }}
                name="eoLedsagetekst"
                width={200}
              />
            </Box>
          </Box>
        </Box>

        <Box className="row--label-right-hover">
          <Typography className="row--text">Revideret opgørelse</Typography>
          <Box className="row--label-right-hover__content">
            <GreenfieldMappedToggleField
              field={eoRevideretOpgoerelseField.bind()}
              location={{ locationId: 'erstatningsopgoerelse.revideretOpgoerelse' }}
              checkedValue="Ja"
              uncheckedValue="Nej"
              name="revideretOpgoerelse"
            />
          </Box>
        </Box>

        <Box className="row--label-right-hover">
          <Typography className="row--text">Vedrører perioden</Typography>
          <Box className="row--label-right-hover__content">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <GreenfieldDateField
                field={eoVedroererPeriodeFraField.bind()}
                location={{ locationId: 'erstatningsopgoerelse.vedroererPeriodeFra' }}
                name="vedroererPeriodeFra"
              />
              <Typography className="row--text">til og med</Typography>
              <GreenfieldDateField
                field={eoVedroererPeriodeTilField.bind()}
                location={{ locationId: 'erstatningsopgoerelse.vedroererPeriodeTil' }}
                name="vedroererPeriodeTil"
              />
            </Box>
          </Box>
        </Box>

        <Box className="row--label-right-hover">
          <Typography className="row--text">Opgørelse lavet den</Typography>
          <Box className="row--label-right-hover__content">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <GreenfieldDateField
                field={eoOpgørelseLavetDenField.bind()}
                location={{ locationId: 'erstatningsopgoerelse.opgørelseLavetDen' }}
                name="opgørelseLavetDen"
                inputRef={opgoerelseLavetDenInputRef}
              />
              <InsertTodayDateButton
                onCommit={(today) => {
                  opgoerelseLavetDenEditor.commitImmediate(today);
                  return true;
                }}
                focusRef={opgoerelseLavetDenInputRef}
              />
            </Box>
          </Box>
        </Box>

        <Box className="row--label-right-hover">
          <Typography className="row--text">Indsæt udkast-stempel</Typography>
          <Box className="row--label-right-hover__content">
            <GreenfieldMappedToggleField
              field={eoIndsaetUdkastStempelField.bind()}
              location={{ locationId: 'erstatningsopgoerelse.indsaetUdkastStempel' }}
              checkedValue="Ja"
              uncheckedValue="Nej"
              name="indsaetUdkastStempel"
            />
          </Box>
        </Box>

        <Typography className="row--subheading">{statusSubheaderLabel}</Typography>

        <Box className="row--label-right-hover">
          <Typography className="row--text">Helbredsforhold</Typography>
          <Box className="row--label-right-hover__content">
            <GreenfieldChoiceField
              field={eoSvieSmerteHelbredsstatusField.bind()}
              location={{ locationId: 'erstatningsopgoerelse.svieSmerteHelbredsstatus' }}
              name="svieSmerteHelbredsstatus"
              width={200}
            >
              <MenuItem value="Sygemeldt">Sygemeldt</MenuItem>
              <MenuItem value="Delvist Sygemeldt">Delvist Sygemeldt</MenuItem>
              <MenuItem value="Raskmeldt">Raskmeldt</MenuItem>
            </GreenfieldChoiceField>
          </Box>
        </Box>

        <Box className="row--label-right-hover">
          <Typography className="row--text">Arbejdssituation</Typography>
          <Box className="row--label-right-hover__content">
            <GreenfieldChoiceField
              field={eoTafArbejdsstatusField.bind()}
              location={{ locationId: 'erstatningsopgoerelse.tafArbejdsstatus' }}
              name="tafArbejdsstatus"
              width={200}
            >
              <MenuItem value="Uarbejdsdygtig">Uarbejdsdygtig</MenuItem>
              <MenuItem value="Delvist raskmeldt">Delvist raskmeldt</MenuItem>
              <MenuItem value="Fuldt arbejdsdygtig">Fuldt arbejdsdygtig</MenuItem>
              <GreenfieldChoiceDivider />
              <MenuItem value="Efterløn">Efterløn</MenuItem>
              <MenuItem value="Fleksjob">Fleksjob</MenuItem>
              <MenuItem value="Folkepension">Folkepension</MenuItem>
              <MenuItem value="Førtidspension">Førtidspension</MenuItem>
              <MenuItem value="Kontanthjælp">Kontanthjælp</MenuItem>
              <MenuItem value="Revalidering">Revalidering</MenuItem>
              <MenuItem value="Seniorpension">Seniorpension</MenuItem>
              <MenuItem value="Uddannelse">Uddannelse</MenuItem>
            </GreenfieldChoiceField>
          </Box>
        </Box>

        <Typography className="row--subheading">Bekræftelse</Typography>

        <Box className="row--label-right-hover">
          <Typography className="row--text">Erstatningsopgørelse afsluttes med</Typography>
          <Box className="row--label-right-hover__content">
            <GreenfieldChoiceField
              field={eoAfsluttesMedField.bind()}
              location={{ locationId: 'erstatningsopgoerelse.erstatningsopgoerelseAfsluttesMed' }}
              name="erstatningsopgoerelseAfsluttesMed"
              allowEmpty={false}
              width={220}
            >
              {afsluttesMedEnum.options.map((option) => (
                <MenuItem key={option} value={option}>
                  {option}
                </MenuItem>
              ))}
            </GreenfieldChoiceField>
          </Box>
        </Box>
      </ContentBox>
  );
}
