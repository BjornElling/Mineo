import React from 'react';
import { Box, MenuItem, Typography } from '@mui/material';
import InsertTodayDateButton from '../../inputs/InsertTodayDateButton';
import ContentBox from '../../layout/ContentBox';
import EetAslAfgoerelserTable from '../../tables/EetAslAfgoerelserTable';
import GreenfieldAmountField from '../../../inputCore/react/fields/GreenfieldAmountField';
import GreenfieldChoiceField from '../../../inputCore/react/fields/GreenfieldChoiceField';
import GreenfieldDateField from '../../../inputCore/react/fields/GreenfieldDateField';
import GreenfieldPercentField from '../../../inputCore/react/fields/GreenfieldPercentField';
import { useFieldEditor } from '../../../inputCore/react/useFieldEditor';
import {
  erhvervsevnetabBeregningsdatoField,
  erhvervsevnetabEalEetPctField,
  erhvervsevnetabKoenField,
} from '../../../inputCore/catalog/erhvervsevnetabDescriptors';
import {
  faellesAarsloenAslAarsloenField,
  faellesAarsloenEalAarsloenField,
} from '../../../inputCore/catalog/faellesAarsloenDescriptors';
import type { Koen } from '../../../schemas/formSchemas';
import { SKAERING_2015_03_01 } from '../../../domain/erhvervsevnetab/eetSkaeringsdatoer';
import type { ErhvervsevnetabReaderProjection } from '../../../domain/erhvervsevnetab/erhvervsevnetabReaderProjection';

export type EetOplysningerTabProps = Readonly<{
  projection: ErhvervsevnetabReaderProjection;
}>;

const beregningsdatoRef = erhvervsevnetabBeregningsdatoField.bind();
const koenRef = erhvervsevnetabKoenField.bind();
const ealEetPctRef = erhvervsevnetabEalEetPctField.bind();
const aslAarsloenRef = faellesAarsloenAslAarsloenField.bind();
const ealAarsloenRef = faellesAarsloenEalAarsloenField.bind();

const LOCATIONS = {
  beregningsdato: { locationId: 'erhvervsevnetab:oplysninger:beregningsdato' },
  koen: { locationId: 'erhvervsevnetab:oplysninger:koen' },
  ealEetPct: { locationId: 'erhvervsevnetab:oplysninger:ealEetPct' },
  aslAarsloen: { locationId: 'erhvervsevnetab:oplysninger:aslAarsloen' },
  ealAarsloen: { locationId: 'erhvervsevnetab:oplysninger:ealAarsloen' },
} as const;

const EetOplysningerTab = ({ projection }: EetOplysningerTabProps) => {
  const { values, skadedato } = projection;
  const beregningsdatoInputRef = React.useRef<HTMLInputElement>(null);
  const beregningsdatoController = useFieldEditor(beregningsdatoRef, LOCATIONS.beregningsdato);

  const visKoenFelt = React.useMemo(() => {
    const hasKapDatoFoer2015 = values.aslAfgoerelser.some(
      (row) => row.kapDato !== undefined && row.kapDato < SKAERING_2015_03_01
    );
    const hasBeregningsdatoFoer2015 =
      values.beregningsdato !== undefined && values.beregningsdato < SKAERING_2015_03_01;
    return (skadedato !== undefined && skadedato < SKAERING_2015_03_01)
      || hasKapDatoFoer2015
      || hasBeregningsdatoFoer2015;
  }, [skadedato, values.aslAfgoerelser, values.beregningsdato]);

  return (
    <>
      <ContentBox className="content-box" data-section-id="eet-oplysninger-grundlaeggende">
        <Typography className="section-header">Grundlæggende oplysninger</Typography>

        {visKoenFelt && (
          <Box className="row--label-right-hover">
            <Typography className="row--text">Køn</Typography>
            <Box className="row--label-right-hover__content">
              <GreenfieldChoiceField<Koen>
                field={koenRef}
                location={LOCATIONS.koen}
                name="koen"
                placeholder="Vælg køn"
                width={130}
              >
                <MenuItem value="Mand">Mand</MenuItem>
                <MenuItem value="Kvinde">Kvinde</MenuItem>
              </GreenfieldChoiceField>
            </Box>
          </Box>
        )}

        <Box className="row--label-right-hover">
          <Typography className="row--text">Beregningsdato</Typography>
          <Box className="row--label-right-hover__content" sx={{ gap: 1 }}>
            <GreenfieldDateField
              field={beregningsdatoRef}
              location={LOCATIONS.beregningsdato}
              name="beregningsdato"
              inputRef={beregningsdatoInputRef}
            />
            <InsertTodayDateButton
              onCommit={(today) => {
                beregningsdatoController.commitImmediate(today);
              }}
              focusRef={beregningsdatoInputRef}
            />
          </Box>
        </Box>
      </ContentBox>

      <ContentBox className="content-box" data-section-id="eet-oplysninger-asl">
        <Typography className="section-header">Arbejdsskadesikringsloven</Typography>
        <Box className="row--label-right-hover">
          <Typography className="row--text">Årsløn</Typography>
          <Box className="row--label-right-hover__content">
            <GreenfieldAmountField
              field={aslAarsloenRef}
              location={LOCATIONS.aslAarsloen}
              name="aslAarsloen"
            />
          </Box>
        </Box>

        <Typography className="row--subheading" sx={{ mt: 2 }}>Afgørelser</Typography>
        <EetAslAfgoerelserTable
          committedRows={projection.aslAfgoerelserCommittedRows}
          validationMessageByCell={projection.aslAfgoerelserValidationMessageByCell}
          saveOrderPath="erhvervsevnetab.aslAfgoerelser"
        />
      </ContentBox>

      <ContentBox className="content-box" data-section-id="eet-oplysninger-eal">
        <Typography className="section-header">Erstatningsansvarsloven</Typography>
        <Box className="row--label-right-hover">
          <Typography className="row--text">Årsløn (hvis forskellig fra ASL)</Typography>
          <Box className="row--label-right-hover__content">
            <GreenfieldAmountField
              field={ealAarsloenRef}
              location={LOCATIONS.ealAarsloen}
              name="ealAarsloen"
            />
          </Box>
        </Box>

        <Box className="row--label-right-hover">
          <Typography className="row--text">EET % (hvis afviger fra ASL)</Typography>
          <Box className="row--label-right-hover__content">
            <GreenfieldPercentField
              field={ealEetPctRef}
              location={LOCATIONS.ealEetPct}
              name="ealEetPct"
              placeholder="0"
            />
          </Box>
        </Box>
      </ContentBox>

      <ContentBox className="content-box" data-section-id="eet-oplysninger-bemaerk">
        <Typography className="section-header">Bemærk</Typography>
        <Box className="row--label-right-hover">
          <Typography className="row--text">For skadelidte i fleksjob skal altid beregnes ny erhvervsevnetabsprocent efter EAL.</Typography>
          <Box className="row--label-right-hover__content" />
        </Box>
        <Box className="row--label-right-hover">
          <Typography className="row--text">Det er ikke muligt for programmet at tage højde for tilskadekomstpension til tidligere tjenestemænd.</Typography>
          <Box className="row--label-right-hover__content" />
        </Box>
        <Box className="row--label-right-hover">
          <Typography className="row--text">Programmet kan ikke foretage beregninger efter den grønlandske arbejdsskadesikringslov.</Typography>
          <Box className="row--label-right-hover__content" />
        </Box>
      </ContentBox>
    </>
  );
};

EetOplysningerTab.displayName = 'EetOplysningerTab';

export default EetOplysningerTab;
