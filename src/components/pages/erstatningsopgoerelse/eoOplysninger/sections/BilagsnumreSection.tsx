import { Box, Typography } from '@mui/material';
import ContentBox from '../../../../layout/ContentBox';
import LabeledControlRow from '../../../../layout/LabeledControlRow';
import MappedToggleField from '../../../../../inputCore/react/fields/MappedToggleField';
import TextField from '../../../../../inputCore/react/fields/TextField';
import type { FieldRef } from '../../../../../inputCore/fieldDescriptor';
import { createFieldWarning } from '../../../../../inputCore/fieldWarning';
import {
  eoBilagsnumreBeregningsgrundlagTafField,
  eoBilagsnumreEetAfgoerelserField,
  eoBilagsnumreLoenISygeperiodenField,
  eoBilagsnumreMenAfgoerelseField,
  eoBilagsnumreOffentligeYdelserField,
  eoBilagsnumreOevrigeErstatningskravField,
  eoBilagsnumreSvieSmerteDokumentationField,
  eoVisBilagsnumreField,
} from '../../../../../inputCore/catalog/erstatningsopgoerelseDescriptors';
import { erBilagsnumreRelevant } from '../../../../../domain/erstatningsopgoerelse/helpers/eoInputRelevance';
import { resolveBilagWarning } from '../../../../../domain/erstatningsopgoerelse/helpers/bilagWarnings';
import type { ErstatningsopgoerelseValues } from '../../../../../schemas/formSchemas';
import { useEoOplysningerVm } from '../eoOplysningerContext';
import { APP_ROUTES } from '../../../../../config/pageNavigation';
import { EO_TAB_KEYS } from '../../../../../config/eoTabKeys';
// route + tabKey på location er eksplicit navigation-metadata (§3.7); alle felter i denne sektion bor på EO-oplysningerfanen.

/** De syv bilagsnumre: rækketekst, feltets descriptor og det schema-feltnavn, advarslen slår op på. */
type BilagsnummerRad = Readonly<{
  label: string;
  field: FieldRef<string | undefined>;
  fieldName: keyof ErstatningsopgoerelseValues & string;
  locationId: string;
  name: string;
}>;

const BILAGSNUMMER_RAEKKER: readonly BilagsnummerRad[] = [
  {
    label: 'Ménafgørelse',
    field: eoBilagsnumreMenAfgoerelseField.bind(),
    fieldName: 'bilagsnumreMenAfgoerelse',
    locationId: 'erstatningsopgoerelse.bilagsnumreMenAfgoerelse',
    name: 'bilagsnumreMenAfgoerelse',
  },
  {
    label: 'EET-afgørelser',
    field: eoBilagsnumreEetAfgoerelserField.bind(),
    fieldName: 'bilagsnumreEetAfgoerelser',
    locationId: 'erstatningsopgoerelse.bilagsnumreEetAfgoerelser',
    name: 'bilagsnumreEetAfgoerelser',
  },
  {
    label: 'Svie/smerte-dokumentation',
    field: eoBilagsnumreSvieSmerteDokumentationField.bind(),
    fieldName: 'bilagsnumreSvieSmerteDokumentation',
    locationId: 'erstatningsopgoerelse.bilagsnumreSvieSmerteDokumentation',
    name: 'bilagsnumreSvieSmerteDokumentation',
  },
  {
    label: 'Beregningsgrundlag for TAF',
    field: eoBilagsnumreBeregningsgrundlagTafField.bind(),
    fieldName: 'bilagsnumreBeregningsgrundlagTaf',
    locationId: 'erstatningsopgoerelse.bilagsnumreBeregningsgrundlagTaf',
    name: 'bilagsnumreBeregningsgrundlagTaf',
  },
  {
    label: 'Løn i sygeperioden',
    field: eoBilagsnumreLoenISygeperiodenField.bind(),
    fieldName: 'bilagsnumreLoenISygeperioden',
    locationId: 'erstatningsopgoerelse.bilagsnumreLoenISygeperioden',
    name: 'bilagsnumreLoenISygeperioden',
  },
  {
    label: 'Offentlige ydelser',
    field: eoBilagsnumreOffentligeYdelserField.bind(),
    fieldName: 'bilagsnumreOffentligeYdelser',
    locationId: 'erstatningsopgoerelse.bilagsnumreOffentligeYdelser',
    name: 'bilagsnumreOffentligeYdelser',
  },
  {
    label: 'Øvrige erstatningskrav',
    field: eoBilagsnumreOevrigeErstatningskravField.bind(),
    fieldName: 'bilagsnumreOevrigeErstatningskrav',
    locationId: 'erstatningsopgoerelse.bilagsnumreOevrigeErstatningskrav',
    name: 'bilagsnumreOevrigeErstatningskrav',
  },
];

/** Sektion 9: Bilagsnumre. */
export default function BilagsnumreSection() {
  const { values } = useEoOplysningerVm();

  return (
      <ContentBox className="content-box" data-section-id="bilagsnumre">
        <Typography className="section-header">Bilagsnumre</Typography>

        <LabeledControlRow label="Indsæt bilagsnumre i erstatningsopgørelsen">
          {({ labelledBy, controlId }) => (
            <MappedToggleField
              field={eoVisBilagsnumreField.bind()}
              location={{ locationId: 'erstatningsopgoerelse.visBilagsnumre', route: APP_ROUTES.erstatningsopgoerelse, tabKey: EO_TAB_KEYS.EO_OPLYSNINGER }}
              checkedValue="Ja"
              uncheckedValue="Nej"
              name="visBilagsnumre"
              id={controlId}
              labelledBy={labelledBy}
            />
          )}
        </LabeledControlRow>

        {erBilagsnumreRelevant(values) && BILAGSNUMMER_RAEKKER.map((raekke) => {
          // Advarslen er en ren funktion af feltets egen værdi plus ét andet valg, og den har en
          // HÅNDGRIBELIG virkning: et inkonsistent bilagsnummer udelades tavst af dokumentet
          // (`getBilag` i opgoerelseSection.ts). Stod den kun i boksen på Beregning-fanen, havde
          // brugeren – som netop står her og skriver numrene – ingen anledning til at opdage det
          // (BB-207, samme afgørelse som BB-142 og BB-159). Teksten er ordret boksens egen, så de to
          // kanaler ikke kan drifte.
          const advarselstekst = resolveBilagWarning(values, raekke.fieldName, values[raekke.fieldName] as string | undefined);
          const warning = advarselstekst === null ? undefined : createFieldWarning(advarselstekst);

          return (
            <Box className="row--label-right-hover" key={raekke.fieldName}>
              <Typography className="row--text">{raekke.label}</Typography>
              <Box className="row--label-right-hover__content">
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography className="row--text">Bilagsnr.</Typography>
                  <TextField
                    field={raekke.field}
                    location={{ locationId: raekke.locationId, route: APP_ROUTES.erstatningsopgoerelse, tabKey: EO_TAB_KEYS.EO_OPLYSNINGER }}
                    width={130}
                    name={raekke.name}
                    {...(warning === undefined ? {} : { warning })}
                    sx={{ '& .MuiInputBase-input': { textAlign: 'center' } }}
                  />
                </Box>
              </Box>
            </Box>
          );
        })}
      </ContentBox>
  );
}
