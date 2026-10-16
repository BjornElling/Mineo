import { MenuItem } from '@mui/material';
import ChoiceField from '../../../../inputCore/react/fields/ChoiceField';
import { anciennitetSatsPerEnum, type AnciennitetSatsPer } from '../../../../schemas/formSchemas';
import type { BoundField } from './loenudviklingBinding';

/**
 * Enhedsvalget for et kronetillæg i reguleringen: «Time» eller «Måned».
 *
 * Bruges af både «Evt. forhøjet grundløn udover løntrin» og anciennitetstillæggets «Satsen angives per» på
 * begge overflader, så de to kronefelter tilbyder nøjagtig samme valg. «Dag» tilbydes bevidst ikke: det
 * ville kræve en faktor mellem dag og time, som programmet ikke har og ikke kan kende ved deltid
 * (afklaringslog 10 og 10a i `docs/review/regulering-taf-gennemgang-2026-10-13.md`).
 */
export default function SatsEnhedChoiceField({
  binding,
  name,
  width,
}: Readonly<{
  binding: BoundField<AnciennitetSatsPer>;
  name: string;
  width: number;
}>) {
  return (
    <ChoiceField
      field={binding.field}
      location={binding.location}
      name={name}
      width={width}
      allowEmpty={false}
    >
      {anciennitetSatsPerEnum.options.map((option) => (
        <MenuItem key={option} value={option}>
          {option}
        </MenuItem>
      ))}
    </ChoiceField>
  );
}
