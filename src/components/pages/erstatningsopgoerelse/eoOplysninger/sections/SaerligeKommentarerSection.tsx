import { Typography } from '@mui/material';
import ContentBox from '../../../../layout/ContentBox';
import GreenfieldMultilineTextField from '../../../../../inputCore/react/fields/GreenfieldMultilineTextField';
import { eoSaerligeKommentarerField } from '../../../../../inputCore/catalog/erstatningsopgoerelseDescriptors';

/** Sektion 8: Eventuelle særlige kommentarer. */
export default function SaerligeKommentarerSection() {
  return (
      <ContentBox className="content-box" data-section-id="saerlige-kommentarer">
        <Typography className="section-header">Eventuelle særlige kommentarer</Typography>

        <GreenfieldMultilineTextField
          field={eoSaerligeKommentarerField.bind()}
          location={{ locationId: 'erstatningsopgoerelse.saerligeKommentarer' }}
          name="saerligeKommentarer"
          width={800}
          rows={4}
          placeholder="Indtast eventuelle kommentarer her..."
        />
      </ContentBox>
  );
}
