import React from 'react';
import { Box, MenuItem, Typography } from '@mui/material';

import ContentBox from '../../layout/ContentBox';
import DocumentDownloadButton from '../../inputs/DocumentDownloadButton';
import ChoiceField from '../../../inputCore/react/fields/ChoiceField';
import IntegerField from '../../../inputCore/react/fields/IntegerField';
import ToggleField from '../../../inputCore/react/fields/ToggleField';
import { LOEN_PAA_HELLIGDAGE } from '../../../types/loen';
import type { LoenPaaHelligdage } from '../../../schemas/formSchemas/enumSchemas';
import { useAarsloenVm } from './aarsloenContext';

/**
 * Beregningsprincipper: omregning til fuldt år og de felter, den låser op.
 *
 * Omregning-togglen er et ALMINDELIGT persisteret felt gennem `ToggleField` (§3.2/§3.7) — gaten leveres som dens
 * `commit`-override, så en ugyldig aktivering afvises uden at feltbindingen eller undo/redo-fokusmetadataen
 * falder væk. `checkedOverride` er nødvendig, fordi den VISTE tilstand kommer fra gaten frem for direkte fra
 * feltets afsluttede værdi.
 *
 * De afhængige felter skjules med `display: none` frem for at unmountes, så deres editorlokationer forbliver i
 * DOM og undo/redo kan navigere til dem.
 */
const AarsloenBeregningsprincipperSection = React.memo(() => {
  const vm = useAarsloenVm();
  const { fields, locations, canShowOmregning } = vm;

  return (
    <ContentBox className="content-box">
      <Typography className="section-header">Beregningsprincipper</Typography>

      {/* Omregning til fuldt år — GATET immediate-commit (checked = persisted input, ikke effectiveEnabled). */}
      <Box className="row--label-right-hover">
        <Typography className="row--text">Omregning til fuldt år:</Typography>
        <Box className="row--label-right-hover__content">
          <ToggleField
            field={fields.omregningTilFuldtAar}
            location={locations.omregningTilFuldtAar}
            name="omregningTilFuldtAar"
            ref={vm.toggleRef}
            checkedOverride={vm.omregningChecked}
            commit={vm.decideOmregningToggle}
          />
        </Box>
      </Box>

      <Box sx={{ display: canShowOmregning ? 'block' : 'none' }}>
        <Box className="row--label-right-hover">
          <Typography className="row--text">{`${vm.indtastetEnhedSummary.label}:`}</Typography>
          <Typography className="row--text">{vm.indtastetEnhedSummary.value}</Typography>
        </Box>

        <Box className="row--label-right-hover">
          <Typography className="row--text">Fuld løn under ferie:</Typography>
          <Box className="row--label-right-hover__content">
            <ToggleField
              name="fuldLoenUnderFerie"
              field={fields.fuldLoenUnderFerie}
              location={locations.fuldLoenUnderFerie}
              disabled={!canShowOmregning}
            />
          </Box>
        </Box>

        {/* Ret til 6. ferieuge — kun synlig hvis IKKE fuld løn under ferie */}
        <Box sx={{ display: vm.shouldShowFerieFields ? 'block' : 'none' }}>
          <Box className="row--label-right-hover">
            <Typography className="row--text">Ret til 6. ferieuge:</Typography>
            <Box className="row--label-right-hover__content">
              <ToggleField
                name="retTilSjetteFerieuge"
                field={fields.retTilSjetteFerieuge}
                location={locations.retTilSjetteFerieuge}
                disabled={!canShowOmregning}
              />
            </Box>
          </Box>
        </Box>

        {/* Antal feriedage — kun synlig hvis IKKE fuld løn under ferie */}
        <Box sx={{ display: vm.shouldShowFerieFields ? 'block' : 'none' }}>
          <Box className="row--label-right-hover">
            <Typography className="row--text">Antal feriedage (mandag-fredag) i de indtastede perioder:</Typography>
            <Box className="row--label-right-hover__content">
              <IntegerField
                name="antalFeriedage"
                field={fields.antalFeriedage}
                location={locations.antalFeriedage}
                placeholder="0"
                width={50}
                disabled={!canShowOmregning}
              />
            </Box>
          </Box>
        </Box>

        <Box className="row--label-right-hover">
          <Typography className="row--text">Løn på helligdage:</Typography>
          <Box className="row--label-right-hover__content">
            <ChoiceField<LoenPaaHelligdage>
              name="loenPaaHelligdage"
              field={fields.loenPaaHelligdage}
              location={locations.loenPaaHelligdage}
              width={185}
              allowEmpty={false}
              disabled={!canShowOmregning}
            >
              <MenuItem value={LOEN_PAA_HELLIGDAGE.ALMINDELIG}>Almindelig løn</MenuItem>
              <MenuItem value={LOEN_PAA_HELLIGDAGE.SH_UDBETALING}>SH-udbetaling</MenuItem>
              <MenuItem value={LOEN_PAA_HELLIGDAGE.INGEN}>Ingen</MenuItem>
            </ChoiceField>
          </Box>
        </Box>

        {/* SH-dage — kun synlig hvis dropdown er 'SH-udbetaling' eller 'Ingen' */}
        <Box sx={{ display: vm.shouldShowShDageFields ? 'block' : 'none' }}>
          <Box className="row--label-right-hover">
            <Typography className="row--text">Antal SH-dage i de indtastede perioder:</Typography>
            <Box className="row--label-right-hover__content">
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography className="row--text">{vm.shDageAntal ?? 0}</Typography>
                <DocumentDownloadButton
                  onClick={() => void vm.runShDageDownload()}
                  disabled={!vm.shDageDownload.canDownload}
                  disabledReason={vm.shDageDownload.disabledReason}
                />
              </Box>
            </Box>
          </Box>
        </Box>
      </Box>
    </ContentBox>
  );
});

AarsloenBeregningsprincipperSection.displayName = 'AarsloenBeregningsprincipperSection';

export default AarsloenBeregningsprincipperSection;
