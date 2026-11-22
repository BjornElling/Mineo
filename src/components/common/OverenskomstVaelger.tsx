import { Box, MenuItem, Typography } from '@mui/material';
import ChoiceField from '../../inputCore/react/fields/ChoiceField';
import type { FieldRef } from '../../inputCore/fieldDescriptor';
import type { EditorLocation } from '../../inputCore/editor/fieldEditorState';
import type { FieldIssue } from '../../inputCore/inputIssue';
import {
  formatOverenskomstMetaDisplay,
  getAlleArbejdsgiverOrg,
  getAlleLoenmodtagerOrg,
  getOverenskomsterByOrg,
  resolveOverenskomstDisplay,
  withGemtOrganisation,
} from '../../data/overenskomstRates';
import OverenskomstFilterLabel from './OverenskomstFilterLabel';

type ChoiceBinding = Readonly<{
  field: FieldRef<string | undefined>;
  location: EditorLocation;
}>;

type FilterBinding = ChoiceBinding & Readonly<{ value: string | undefined }>;

type Props = Readonly<{
  /** Skelner flere vælgere på samme side (fx ét pr. ansættelsesforhold); udelades, hvor fladen kun har én. */
  namePrefix?: string;
  overenskomst: ChoiceBinding;
  loenmodtager: FilterBinding;
  arbejdsgiver: FilterBinding;
  overenskomstIssue?: FieldIssue;
}>;

const FILTER_SX = {
  '& .MuiInputBase-root': {
    height: '24px !important',
    minHeight: '24px !important',
    paddingRight: '20px !important',
  },
  '& .MuiInputBase-input': {
    fontSize: '11px !important',
    padding: '0 4px 0 8px !important',
    lineHeight: '24px',
  },
  '& .MuiSvgIcon-root': { fontSize: '12px !important' },
} as const;

/** Ikke-valgbar oplysningslinje, når organisationsfiltrene tilsammen ikke matcher nogen overenskomst. */
const INGEN_MATCH_TEXT = 'Ingen overenskomster matcher de valgte filtre';
// Værdien er kun en teknisk nøgle til den deaktiverede linje; den kan ikke vælges og når aldrig feltet.
const INGEN_MATCH_VALUE = '__ingen-overenskomst-match__';

/** Fælles overenskomstvalg med samme organisationsfiltre, tooltips og feltmotor på alle tre lønflader
 * (Lønindkomst, Årslønsberegning og «Angivet dagsløn/månedsløn» med lønudvikling efter overenskomst). */
export default function OverenskomstVaelger({
  namePrefix, overenskomst, loenmodtager, arbejdsgiver, overenskomstIssue,
}: Props) {
  const filters = [
    { part: 'loenmodtager', binding: loenmodtager, organisations: getAlleLoenmodtagerOrg() },
    { part: 'arbejdsgiver', binding: arbejdsgiver, organisations: getAlleArbejdsgiverOrg() },
  ] as const;
  const overenskomster = getOverenskomsterByOrg(loenmodtager.value, arbejdsgiver.value);
  const controlName = (suffix: string) => (namePrefix === undefined ? suffix : `${namePrefix}:${suffix}`);

  return (
    <Box className="row--label-right-hover">
      <Typography className="row--text">Vælg overenskomst</Typography>
      <Box className="row--label-right-hover__content">
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {filters.map(({ part, binding, organisations }) => (
            <Box key={part} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <OverenskomstFilterLabel part={part} />
              <ChoiceField
                field={binding.field}
                location={binding.location}
                name={controlName(`overenskomstFilter.${part}`)}
                emptyUiValue="ALLE"
                width={120}
                allowEmpty={false}
                sx={FILTER_SX}
                iconSx={{ fontSize: '16px', right: 2 }}
                optionSx={{ fontSize: '11px', minHeight: '24px', padding: '3px 8px' }}
              >
                <MenuItem value="ALLE">Alle</MenuItem>
                {withGemtOrganisation(organisations, binding.value, 'ALLE').map((org) => (
                  <MenuItem key={org} value={org}>{org}</MenuItem>
                ))}
              </ChoiceField>
            </Box>
          ))}
          <ChoiceField
            field={overenskomst.field}
            location={overenskomst.location}
            name={controlName('overenskomstId')}
            width={460}
            placeholder="Vælg overenskomst..."
            allowEmpty={true}
            getOptionLabel={(id) => resolveOverenskomstDisplay(typeof id === 'string' ? id : String(id))}
            {...(overenskomstIssue === undefined ? {} : { crossFieldIssue: overenskomstIssue })}
          >
            {overenskomster.length === 0
              // Filtrene udelukker hinanden (fx RLTN + Dansk Metal): listen siger det i stedet for kun at vise
              // placeholderen. Linjen er deaktiveret, så hverken klik, piletaster, typeahead eller paste kan vælge
              // den, og et allerede valgt id bevares urørt (BB-435).
              ? <MenuItem key={INGEN_MATCH_VALUE} value={INGEN_MATCH_VALUE} disabled>{INGEN_MATCH_TEXT}</MenuItem>
              : overenskomster.map((meta) => (
                <MenuItem key={meta.id} value={meta.id}>{formatOverenskomstMetaDisplay(meta)}</MenuItem>
              ))}
          </ChoiceField>
        </Box>
      </Box>
    </Box>
  );
}
