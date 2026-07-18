import { Box, Typography } from '@mui/material';
import ContentBox from '../../../../layout/ContentBox';
import GreenfieldMappedToggleField from '../../../../../inputCore/react/fields/GreenfieldMappedToggleField';
import GreenfieldDateField from '../../../../../inputCore/react/fields/GreenfieldDateField';
import {
  eoDifferencekravDatoField,
  eoEndeligEETAfgoerelseDatoField,
  eoEndeligEETVirkningsdatoField,
  eoEndeligtEETAfgorelseField,
  eoMenAfgoerelseDatoField,
  eoMidlertidigEETAfgoerelseDatoField,
  eoMidlertidigEETVirkningsdatoField,
  eoMidlertidigtEETAfgorelseField,
  eoVarigeMenAfgorelseField,
  eoVerserendeKlageEetField,
  eoVerserendeKlageMenField,
} from '../../../../../inputCore/catalog/erstatningsopgoerelseDescriptors';
import {
  erVarigeMenAfgoerelseAktiv,
  erMidlertidigtEETAfgoerelseAktiv,
  erEndeligtEETAfgoerelseAktiv,
  erEETKlageRelevant,
} from '../../../../../domain/erstatningsopgoerelse/helpers/eoInputRelevance';
import { useEoOplysningerVm } from '../eoOplysningerContext';

/** Sektion 3: AES-afgørelser (varige mén, midlertidigt + endeligt EET, øvrigt). */
export default function AesAfgoerelserSection() {
  const {
    values,
  } = useEoOplysningerVm();

  return (
      <ContentBox className="content-box" data-section-id="aes">
        <Typography className="section-header">AES-afgørelser</Typography>

        {/* Varige mén */}
        <Typography className="row--subheading">
          Varige mén
        </Typography>

        <Box className="row--label-right-hover">
          <Typography className="row--text">Truffet afgørelse om varige mén på 5 % eller derover</Typography>
          <Box className="row--label-right-hover__content">
            <GreenfieldMappedToggleField
              field={eoVarigeMenAfgorelseField.bind()}
              location={{ locationId: 'erstatningsopgoerelse.varigeMenAfgorelse' }}
              checkedValue="Ja"
              uncheckedValue="Nej"
              name="varigeMenAfgorelse"
            />
          </Box>
        </Box>

        {erVarigeMenAfgoerelseAktiv(values) && (
          <>
            <Box className="row--label-right-hover">
              <Typography className="row--text">Dato for første ménafgørelse</Typography>
              <Box className="row--label-right-hover__content">
                <GreenfieldDateField
                  field={eoMenAfgoerelseDatoField.bind()}
                  location={{ locationId: 'erstatningsopgoerelse.menAfgoerelseDato' }}
                  name="menAfgoerelseDato"
                />
              </Box>
            </Box>

            <Box className="row--label-right-hover">
              <Typography className="row--text">Verserende klagesag over ménafgørelse?</Typography>
              <Box className="row--label-right-hover__content">
                <GreenfieldMappedToggleField
                  field={eoVerserendeKlageMenField.bind()}
                  location={{ locationId: 'erstatningsopgoerelse.verserendeKlageMen' }}
                  checkedValue="Ja"
                  uncheckedValue="Nej"
                  name="verserendeKlageMen"
                />
              </Box>
            </Box>
          </>
        )}

        {/* Erhvervsevnetab */}
        <Typography className="row--subheading">
          Midlertidigt erhvervsevnetab
        </Typography>

        <Box className="row--label-right-hover">
          <Typography className="row--text">Truffet afgørelse om midlertidigt erhvervsevnetab på 15 % eller derover</Typography>
          <Box className="row--label-right-hover__content">
            <GreenfieldMappedToggleField
              field={eoMidlertidigtEETAfgorelseField.bind()}
              location={{ locationId: 'erstatningsopgoerelse.midlertidigtEETAfgorelse' }}
              checkedValue="Ja"
              uncheckedValue="Nej"
              name="midlertidigtEETAfgorelse"
            />
          </Box>
        </Box>

        {erMidlertidigtEETAfgoerelseAktiv(values) && (
          <>
            <Box className="row--label-right-hover">
              <Typography className="row--text">Dato for første midlertidige erhvervsevnetabsafgørelse</Typography>
              <Box className="row--label-right-hover__content">
                <GreenfieldDateField
                  field={eoMidlertidigEETAfgoerelseDatoField.bind()}
                  location={{ locationId: 'erstatningsopgoerelse.midlertidigEETAfgoerelseDato' }}
                  name="midlertidigEETAfgoerelseDato"
                />
              </Box>
            </Box>

            <Box className="row--label-right-hover">
              <Typography className="row--text">Virkningsdato (hvis forskellig fra afgørelsesdatoen)</Typography>
              <Box className="row--label-right-hover__content">
                <GreenfieldDateField
                  field={eoMidlertidigEETVirkningsdatoField.bind()}
                  location={{ locationId: 'erstatningsopgoerelse.midlertidigEETVirkningsdato' }}
                  name="midlertidigEETVirkningsdato"
                />
              </Box>
            </Box>
          </>
        )}

        <Typography className="row--subheading">
          Endeligt erhvervsevnetab
        </Typography>

        <Box className="row--label-right-hover">
          <Typography className="row--text">Truffet afgørelse om endeligt erhvervsevnetab på 15 % eller derover</Typography>
          <Box className="row--label-right-hover__content">
            <GreenfieldMappedToggleField
              field={eoEndeligtEETAfgorelseField.bind()}
              location={{ locationId: 'erstatningsopgoerelse.endeligtEETAfgorelse' }}
              checkedValue="Ja"
              uncheckedValue="Nej"
              name="endeligtEETAfgorelse"
            />
          </Box>
        </Box>

        {erEndeligtEETAfgoerelseAktiv(values) && (
          <>
            <Box className="row--label-right-hover">
              <Typography className="row--text">Dato for endelig erhvervsevnetabsafgørelse</Typography>
              <Box className="row--label-right-hover__content">
                <GreenfieldDateField
                  field={eoEndeligEETAfgoerelseDatoField.bind()}
                  location={{ locationId: 'erstatningsopgoerelse.endeligEETAfgoerelseDato' }}
                  name="endeligEETAfgoerelseDato"
                />
              </Box>
            </Box>

            <Box className="row--label-right-hover">
              <Typography className="row--text">Virkningsdato (hvis forskellig fra afgørelsesdatoen)</Typography>
              <Box className="row--label-right-hover__content">
                <GreenfieldDateField
                  field={eoEndeligEETVirkningsdatoField.bind()}
                  location={{ locationId: 'erstatningsopgoerelse.endeligEETVirkningsdato' }}
                  name="endeligEETVirkningsdato"
                />
              </Box>
            </Box>
          </>
        )}

        <Typography className="row--subheading">
          Øvrigt
        </Typography>

        {erEETKlageRelevant(values) && (
          <Box className="row--label-right-hover">
            <Typography className="row--text">Verserende klagesag over EET-afgørelse?</Typography>
            <Box className="row--label-right-hover__content">
              <GreenfieldMappedToggleField
                field={eoVerserendeKlageEetField.bind()}
                location={{ locationId: 'erstatningsopgoerelse.verserendeKlageEet' }}
                checkedValue="Ja"
                uncheckedValue="Nej"
                name="verserendeKlageEet"
              />
            </Box>
          </Box>
        )}

        <Box className="row--label-right-hover">
          <Typography className="row--text">Evt. differencekrav opgjort per</Typography>
          <Box className="row--label-right-hover__content">
            <GreenfieldDateField
              field={eoDifferencekravDatoField.bind()}
              location={{ locationId: 'erstatningsopgoerelse.differencekravDato' }}
              name="differencekravDato"
            />
          </Box>
        </Box>
      </ContentBox>
  );
}
