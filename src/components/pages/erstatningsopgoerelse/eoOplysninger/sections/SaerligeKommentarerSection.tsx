import { Typography } from '@mui/material';
import ContentBox from '../../../../layout/ContentBox';
import MultilineTextField from '../../../../../inputCore/react/fields/MultilineTextField';
import { eoSaerligeKommentarerField } from '../../../../../inputCore/catalog/erstatningsopgoerelseDescriptors';
import { APP_ROUTES } from '../../../../../config/pageNavigation';
import { EO_TAB_KEYS } from '../../../../../config/eoTabKeys';
// route + tabKey på location er eksplicit navigation-metadata (§3.7); alle felter i denne sektion bor på EO-oplysningerfanen.

/** Sektion 8: Eventuelle særlige kommentarer. */
export default function SaerligeKommentarerSection() {
  return (
      <ContentBox className="content-box" data-section-id="saerlige-kommentarer">
        <Typography className="section-header">Eventuelle særlige kommentarer</Typography>

        <MultilineTextField
          field={eoSaerligeKommentarerField.bind()}
          location={{ locationId: 'erstatningsopgoerelse.saerligeKommentarer', route: APP_ROUTES.erstatningsopgoerelse, tabKey: EO_TAB_KEYS.EO_OPLYSNINGER }}
          name="saerligeKommentarer"
          width={800}
          rows={4}
          placeholder="Indtast eventuelle kommentarer her..."
        />
      </ContentBox>
  );
}