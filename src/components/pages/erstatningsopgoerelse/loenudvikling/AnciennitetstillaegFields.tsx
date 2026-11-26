import type { ReactNode } from 'react';
import { Box, Typography } from '@mui/material';
import DateField from '../../../../inputCore/react/fields/DateField';
import AmountField from '../../../../inputCore/react/fields/AmountField';
import type { AnciennitetstillaegBinding } from './loenudviklingBinding';
import LabeledControlRow from '../../../layout/LabeledControlRow';
import SatsEnhedChoiceField from './SatsEnhedChoiceField';
import type { FieldIssue } from '../../../../inputCore/inputIssue';
import type { FieldWarning } from '../../../../inputCore/fieldWarning';

/**
 * Den fælles Anciennitetstillæg-blok.
 *
 * Blokken står umiddelbart efter `LoenudviklingFields` på begge overflader (`AnsaettelsesforholdCard.tsx`
 * og `IndtaegtFoerSkadenSection.tsx`). Samme begrundelse som for Lønudvikling-fladen: ét sted, med
 * bindingen injiceret af ejeren.
 *
 * **Satsens enhed vælges ens på begge overflader** (`anciennitetstillaegSatsAngivesPer`: Time/Måned).
 * Bevidst valg: enheden gemmes med beløbet og udledes aldrig af et andet felt (fx «Beregnes ud fra»).
 * Rækken ligger derfor her som én fælles række.
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
  /**
   * Datoens projekterede regel og gule advarsel: rød ved en dato på eller før reguleringsdatoen, gul ved en dato
   * efter erstatningsperioden. Ejeren slår dem op på sin egen bundne adresse.
   */
  datoFeedback: Readonly<{ crossFieldIssue?: FieldIssue; warning?: FieldWarning }>;
  /** Referenceteksten i toggle-rækkens etiket (fx «efter reguleringsdatoen …»). */
  referenceText: string;
  /** «Sats per {enhed}» – den valgte enhed, opløst af ejeren fra samme felt som enhedsvalget. */
  satsPerTekst: string;
  /** Suffiks på feltnavne, så to kort på samme side ikke deler `name`. */
  fieldNamePrefix: string;
}>;

export default function AnciennitetstillaegFields({
  binding,
  toggleSlot,
  harAnciennitetstillaeg,
  datoFeedback,
  referenceText,
  satsPerTekst,
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
                {...datoFeedback}
              />
            </Box>
          </Box>

          <Box className="row--label-right-hover">
            <Typography className="row--text">Satsen angives per</Typography>
            <Box className="row--label-right-hover__content">
              <SatsEnhedChoiceField
                binding={binding.anciennitetstillaegSatsAngivesPer}
                name={`${fieldNamePrefix}anciennitetstillaegSatsAngivesPer`}
                width={160}
              />
            </Box>
          </Box>

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
