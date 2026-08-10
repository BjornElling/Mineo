import { Box, Typography } from '@mui/material';
import ContentBox from '../../../../layout/ContentBox';
import LabeledControlRow from '../../../../layout/LabeledControlRow';
import MappedToggleField from '../../../../../inputCore/react/fields/MappedToggleField';
import DateField from '../../../../../inputCore/react/fields/DateField';
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
import { APP_ROUTES } from '../../../../../config/pageNavigation';
import { EO_TAB_KEYS } from '../../../../../config/eoTabKeys';
// route + tabKey på location er eksplicit navigation-metadata (§3.7); alle felter i denne sektion bor på EO-oplysningerfanen.

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

        <LabeledControlRow label="Truffet afgørelse om varige mén på 5 % eller derover">
          {({ labelledBy, controlId }) => (
            <MappedToggleField
              field={eoVarigeMenAfgorelseField.bind()}
              location={{ locationId: 'erstatningsopgoerelse.varigeMenAfgorelse', route: APP_ROUTES.erstatningsopgoerelse, tabKey: EO_TAB_KEYS.EO_OPLYSNINGER }}
              checkedValue="Ja"
              uncheckedValue="Nej"
              name="varigeMenAfgorelse"
              id={controlId}
              labelledBy={labelledBy}
            />
          )}
        </LabeledControlRow>

        {erVarigeMenAfgoerelseAktiv(values) && (
          <>
            <Box className="row--label-right-hover">
              <Typography className="row--text">Dato for første ménafgørelse</Typography>
              <Box className="row--label-right-hover__content">
                <DateField
                  field={eoMenAfgoerelseDatoField.bind()}
                  location={{ locationId: 'erstatningsopgoerelse.menAfgoerelseDato', route: APP_ROUTES.erstatningsopgoerelse, tabKey: EO_TAB_KEYS.EO_OPLYSNINGER }}
                  name="menAfgoerelseDato"
                />
              </Box>
            </Box>

            <LabeledControlRow label="Verserende klagesag over ménafgørelse?">
              {({ labelledBy, controlId }) => (
                <MappedToggleField
                  field={eoVerserendeKlageMenField.bind()}
                  location={{ locationId: 'erstatningsopgoerelse.verserendeKlageMen', route: APP_ROUTES.erstatningsopgoerelse, tabKey: EO_TAB_KEYS.EO_OPLYSNINGER }}
                  checkedValue="Ja"
                  uncheckedValue="Nej"
                  name="verserendeKlageMen"
                  id={controlId}
                  labelledBy={labelledBy}
                />
              )}
            </LabeledControlRow>
          </>
        )}

        {/* Erhvervsevnetab */}
        <Typography className="row--subheading">
          Midlertidigt erhvervsevnetab
        </Typography>

        <LabeledControlRow label="Truffet afgørelse om midlertidigt erhvervsevnetab på 15 % eller derover">
          {({ labelledBy, controlId }) => (
            <MappedToggleField
              field={eoMidlertidigtEETAfgorelseField.bind()}
              location={{ locationId: 'erstatningsopgoerelse.midlertidigtEETAfgorelse', route: APP_ROUTES.erstatningsopgoerelse, tabKey: EO_TAB_KEYS.EO_OPLYSNINGER }}
              checkedValue="Ja"
              uncheckedValue="Nej"
              name="midlertidigtEETAfgorelse"
              id={controlId}
              labelledBy={labelledBy}
            />
          )}
        </LabeledControlRow>

        {erMidlertidigtEETAfgoerelseAktiv(values) && (
          <>
            <Box className="row--label-right-hover">
              <Typography className="row--text">Dato for første midlertidige erhvervsevnetabsafgørelse</Typography>
              <Box className="row--label-right-hover__content">
                <DateField
                  field={eoMidlertidigEETAfgoerelseDatoField.bind()}
                  location={{ locationId: 'erstatningsopgoerelse.midlertidigEETAfgoerelseDato', route: APP_ROUTES.erstatningsopgoerelse, tabKey: EO_TAB_KEYS.EO_OPLYSNINGER }}
                  name="midlertidigEETAfgoerelseDato"
                />
              </Box>
            </Box>

            <Box className="row--label-right-hover">
              <Typography className="row--text">Virkningsdato (hvis forskellig fra afgørelsesdatoen)</Typography>
              <Box className="row--label-right-hover__content">
                <DateField
                  field={eoMidlertidigEETVirkningsdatoField.bind()}
                  location={{ locationId: 'erstatningsopgoerelse.midlertidigEETVirkningsdato', route: APP_ROUTES.erstatningsopgoerelse, tabKey: EO_TAB_KEYS.EO_OPLYSNINGER }}
                  name="midlertidigEETVirkningsdato"
                />
              </Box>
            </Box>
          </>
        )}

        <Typography className="row--subheading">
          Endeligt erhvervsevnetab
        </Typography>

        <LabeledControlRow label="Truffet afgørelse om endeligt erhvervsevnetab på 15 % eller derover">
          {({ labelledBy, controlId }) => (
            <MappedToggleField
              field={eoEndeligtEETAfgorelseField.bind()}
              location={{ locationId: 'erstatningsopgoerelse.endeligtEETAfgorelse', route: APP_ROUTES.erstatningsopgoerelse, tabKey: EO_TAB_KEYS.EO_OPLYSNINGER }}
              checkedValue="Ja"
              uncheckedValue="Nej"
              name="endeligtEETAfgorelse"
              id={controlId}
              labelledBy={labelledBy}
            />
          )}
        </LabeledControlRow>

        {erEndeligtEETAfgoerelseAktiv(values) && (
          <>
            <Box className="row--label-right-hover">
              <Typography className="row--text">Dato for endelig erhvervsevnetabsafgørelse</Typography>
              <Box className="row--label-right-hover__content">
                <DateField
                  field={eoEndeligEETAfgoerelseDatoField.bind()}
                  location={{ locationId: 'erstatningsopgoerelse.endeligEETAfgoerelseDato', route: APP_ROUTES.erstatningsopgoerelse, tabKey: EO_TAB_KEYS.EO_OPLYSNINGER }}
                  name="endeligEETAfgoerelseDato"
                />
              </Box>
            </Box>

            <Box className="row--label-right-hover">
              <Typography className="row--text">Virkningsdato (hvis forskellig fra afgørelsesdatoen)</Typography>
              <Box className="row--label-right-hover__content">
                <DateField
                  field={eoEndeligEETVirkningsdatoField.bind()}
                  location={{ locationId: 'erstatningsopgoerelse.endeligEETVirkningsdato', route: APP_ROUTES.erstatningsopgoerelse, tabKey: EO_TAB_KEYS.EO_OPLYSNINGER }}
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
          <LabeledControlRow label="Verserende klagesag over EET-afgørelse?">
            {({ labelledBy, controlId }) => (
              <MappedToggleField
                field={eoVerserendeKlageEetField.bind()}
                location={{ locationId: 'erstatningsopgoerelse.verserendeKlageEet', route: APP_ROUTES.erstatningsopgoerelse, tabKey: EO_TAB_KEYS.EO_OPLYSNINGER }}
                checkedValue="Ja"
                uncheckedValue="Nej"
                name="verserendeKlageEet"
                id={controlId}
                labelledBy={labelledBy}
              />
            )}
          </LabeledControlRow>
        )}

        <Box className="row--label-right-hover">
          <Typography className="row--text">Evt. differencekrav opgjort per</Typography>
          <Box className="row--label-right-hover__content">
            <DateField
              field={eoDifferencekravDatoField.bind()}
              location={{ locationId: 'erstatningsopgoerelse.differencekravDato', route: APP_ROUTES.erstatningsopgoerelse, tabKey: EO_TAB_KEYS.EO_OPLYSNINGER }}
              name="differencekravDato"
            />
          </Box>
        </Box>
      </ContentBox>
  );
}