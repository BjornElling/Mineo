import { Typography } from '@mui/material';
import ContentBox from '../../../../layout/ContentBox';
import StyledTextField from '../../../../inputs/StyledTextField';
import { useEoOplysningerVm } from '../eoOplysningerContext';

/** Sektion 8: Eventuelle særlige kommentarer. */
export default function SaerligeKommentarerSection() {
  const { values, commitField } = useEoOplysningerVm();

  return (
      <ContentBox className="content-box" data-section-id="saerlige-kommentarer">
        <Typography className="section-header">Eventuelle særlige kommentarer</Typography>

        <StyledTextField
          name="saerligeKommentarer"
          width={800}
          value={values.saerligeKommentarer || ''}
          onCommit={commitField('saerligeKommentarer')}
          multiline
          rows={4}
          placeholder="Indtast eventuelle kommentarer her..."
        />
      </ContentBox>
  );
}
