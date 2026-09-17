import { Typography } from '@mui/material';
import ContentBox from '../../../../layout/ContentBox';
import MultilineTextField from '../../../../../inputCore/react/fields/MultilineTextField';
import { eoSaerligeKommentarerField } from '../../../../../inputCore/catalog/erstatningsopgoerelseDescriptors';
import { APP_ROUTES } from '../../../../../config/pageNavigation';
import { EO_TAB_KEYS } from '../../../../../config/eoTabKeys';
// route + tabKey på location er eksplicit navigation-metadata (§3.7); alle felter i denne sektion bor på EO-oplysningerfanen.

/**
 * Sektion 8: Eventuelle særlige bemærkninger.
 *
 * «Eventuelle» står KUN her, hvor indtastningen sker, og siger at feltet er valgfrit. Sagen selv hedder
 * «Særlige bemærkninger» – både som feltets eget navn og som dokumentets overskrift – så brugeren, der
 * leder efter sin tekst i papiret, finder den under det navn, han skrev den under (BB-212). I dokumentet
 * er teksten en konstatering og bærer derfor ikke forbeholdet.
 */
export default function SaerligeKommentarerSection() {
  return (
      <ContentBox className="content-box" data-section-id="saerlige-kommentarer">
        <Typography className="section-header">Eventuelle særlige bemærkninger</Typography>

        <MultilineTextField
          field={eoSaerligeKommentarerField.bind()}
          location={{ locationId: 'erstatningsopgoerelse.saerligeKommentarer', route: APP_ROUTES.erstatningsopgoerelse, tabKey: EO_TAB_KEYS.EO_OPLYSNINGER }}
          name="saerligeKommentarer"
          width={800}
          rows={4}
          placeholder="Indtast eventuelle bemærkninger her..."
        />
      </ContentBox>
  );
}