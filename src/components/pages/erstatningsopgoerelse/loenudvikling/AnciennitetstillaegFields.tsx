import type { ReactNode } from 'react';
import { Box, Typography } from '@mui/material';
import DateField from '../../../../inputCore/react/fields/DateField';
import AmountField from '../../../../inputCore/react/fields/AmountField';
import type { AnciennitetstillaegBinding } from './loenudviklingBinding';
import LabeledControlRow from '../../../layout/LabeledControlRow';

/**
 * Den fælles Anciennitetstillæg-blok.
 *
 * Blokken sad ordret to gange – `AnsaettelsesforholdCard.tsx` (61 l.) og
 * `IndtaegtFoerSkadenSection.tsx` (47 l.) – umiddelbart efter `LoenudviklingFields` på begge
 * overflader. Den slap gennem #1/#22, fordi den ligger UDEN for Lønudvikling-fladen selv, men
 * det er samme duplikering af samme grund, og derfor samme løsning: ét sted, med bindingen
 * injiceret af ejeren.
 *
 * **`satsEnhedSlot` er en bevidst slot og ikke en prop-flag** – af samme grund som
 * `overenskomstSlot` i `LoenudviklingFields`. De to overflader afgør satsens enhed
 * FORSKELLIGT, og det er en reel funktionsforskel, ikke drift:
 *
 * - **Lønindkomst** lader brugeren VÆLGE (`anciennitetstillaegSatsAngivesPer`: Time/Måned).
 * - **EO-oplysninger** UDLEDER enheden af `beregnesUdFra` og viser intet valg.
 *
 * Forskellen er hverken dokumenteret eller besluttet noget sted, og den er en UI/UX-sag.
 * Fladen bevarer derfor begge adfærd nøjagtigt som de er, frem for at ensarte dem: en
 * sammenlægning her ville ændre brugerfladen på den ene side under dække af en refaktorering.
 * Slotten gør forskellen SYNLIG på begge callsites i stedet for at gemme den i en betingelse.
 */
export type AnciennitetstillaegFieldsProps = Readonly<{
  /** Adresse + location pr. logisk felt for den aktuelle overflade. */
  binding: AnciennitetstillaegBinding;
  /**
   * Om-knappen: har skadelidte opnået anciennitetstillæg. Overfladerne bruger hver sin togglekomponent.
   *
   * Kaldes med rækkens navnebinding, fordi ETIKETTEN hører til her (den interpolerer `referenceText`),
   * mens KONTROLLEN ejes af callsitet. Uden bindingen måtte hvert callsite gentage etiketteksten som
   * et `ariaLabel` – to kopier af samme streng, der kan glide fra hinanden.
   */
  toggleSlot: (binding: Readonly<{ labelledBy: string; controlId: string }>) => ReactNode;
  /** Sand når toggle'en er slået til; styrer om detaljerne vises. */
  harAnciennitetstillaeg: boolean;
  /** Referenceteksten i toggle-rækkens etiket (fx «efter reguleringsdatoen …»). */
  referenceText: string;
  /** «Sats per {enhed}» – enheden er allerede opløst af ejeren. */
  satsPerTekst: string;
  /** Rækken der vælger satsens enhed. `null` når overfladen udleder enheden – se komponentens doc. */
  satsEnhedSlot: ReactNode;
  /** Suffiks på feltnavne, så to kort på samme side ikke deler `name`. */
  fieldNamePrefix: string;
}>;

export default function AnciennitetstillaegFields({
  binding,
  toggleSlot,
  harAnciennitetstillaeg,
  referenceText,
  satsPerTekst,
  satsEnhedSlot,
  fieldNamePrefix,
}: AnciennitetstillaegFieldsProps) {
  return (
    <>
      <Typography className="row--subheading">Anciennitetstillæg</Typography>

      <LabeledControlRow
        label={`Ville skadelidte have opnået anciennitetstillæg efter ${referenceText}`}
      >
        {(binding) => toggleSlot(binding)}
      </LabeledControlRow>

      {harAnciennitetstillaeg ? (
        <>
          <Box className="row--label-right-hover">
            <Typography className="row--text">Dato for opnået anciennitetstillæg</Typography>
            <Box className="row--label-right-hover__content">
              <DateField
                field={binding.anciennitetstillaegDato.field}
                location={binding.anciennitetstillaegDato.location}
                name={`${fieldNamePrefix}anciennitetstillaegDato`}
              />
            </Box>
          </Box>

          {satsEnhedSlot}

          <Box className="row--label-right-hover">
            <Typography className="row--text">{`Sats per ${satsPerTekst}`}</Typography>
            <Box className="row--label-right-hover__content">
              <AmountField
                field={binding.anciennitetstillaegSats.field}
                location={binding.anciennitetstillaegSats.location}
                name={`${fieldNamePrefix}anciennitetstillaegSats`}
                width={160}
              />
            </Box>
          </Box>
        </>
      ) : null}
    </>
  );
}
