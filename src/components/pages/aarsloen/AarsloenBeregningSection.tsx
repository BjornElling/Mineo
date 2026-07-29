import React from 'react';
import { Box, Typography } from '@mui/material';

import ContentBox from '../../layout/ContentBox';
import DocumentDownloadButton from '../../inputs/DocumentDownloadButton';
import { formatCountWithUnit, formatCurrency } from '../../../utils/formatUtils';
import { STANDARD_HVERDAGE_PAA_AAR, STANDARD_SH_DAGE_PAA_AAR } from '../../../utils/periodeBeregning';
import { LOENPERIODE } from '../../../types/loen';
import { useAarsloenVm } from './aarsloenContext';

/**
 * Beregning: sammentællingen og — når omregning er aktiv — omregningens mellemregninger pr. metode.
 *
 * Teksterne er BEVIDST udførlige mellemregninger: brugeren skal kunne efterprøve tallet uden at åbne
 * dokumentet. Formlerne er urørte; sektionen viser kun det, `beregningsData` allerede indeholder.
 *
 * Ved en fatal beregningsfejl viser sammentællingen '—' frem for et tal: projektionen har da ikke kaldt motoren,
 * så der findes intet resultat, og en beregning på den skjulte tomværdi ville være misvisende (§1.6/§3.9).
 */
const AarsloenBeregningSection = React.memo(() => {
  const vm = useAarsloenVm();
  const { beregningsData, beregnetAarsloen, shDageAntal, values } = vm;
  const { fuldLoenUnderFerie, retTilSjetteFerieuge, loenperiode } = values;

  const downloadButton = (
    <DocumentDownloadButton
      onClick={() => void vm.runAarsloenDownload()}
      shake={vm.downloadShake}
      disabled={!vm.aarsloenDownload.canDownload}
      disabledReason={vm.aarsloenDownload.disabledReason}
    />
  );

  /**
   * Den afsluttende "Beregnet årsløn (…)"-række, som alle tre metoder deler.
   *
   * `omregnet` tages som parameter frem for at læses af `beregningsData` her: feltet findes kun på de
   * omregnende varianter, og typen skal bevare den sondring (`metode: 'ingen'` HAR ingen omregning).
   */
  const omregnetRow = (formula: string, omregnet: number) => (
    <Box className="row--label-right-hover">
      <Typography className="row--text">{`Beregnet årsløn (${formula}):`}</Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography className="row--text text-bold">{formatCurrency(omregnet)} kr.</Typography>
        {downloadButton}
      </Box>
    </Box>
  );

  /** Fradrags-halen på "dage i beregningsperioden": feriedage vises kun uden fuld løn under ferie. */
  const feriedageFradrag = (feriedageFraInput: number): string =>
    !fuldLoenUnderFerie && feriedageFraInput > 0
      ? ` - ${formatCountWithUnit(feriedageFraInput, 'feriedag', 'feriedage')}`
      : '';

  return (
    <ContentBox className="content-box">
      <Typography className="section-header">Beregning</Typography>

      <Box className="row--label-right-hover">
        <Typography className="row--text">Sammentælling af løn fra tabellen:</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography className="row--text">
            {vm.harFatalBeregningsFejl ? '—' : `${formatCurrency(beregnetAarsloen)} kr.`}
          </Typography>
          {vm.visDownloadVedSammentaelling && downloadButton}
        </Box>
      </Box>

      {vm.omregningAktiveret && !vm.harFatalBeregningsFejl && beregningsData.metode !== 'ingen' && !beregningsData.erEtAar && (
        <>
          {beregningsData.metode === 'A' && (
            <>
              <Box className="row--label-right-hover">
                <Typography className="row--text">{`Arbejdsdage i beregningsperioden (${formatCountWithUnit(beregningsData.hverdageIPeriode, 'hverdag', 'hverdage')}${feriedageFradrag(beregningsData.feriedageFraInput)}${(shDageAntal ?? 0) > 0 ? ` - ${formatCountWithUnit(shDageAntal ?? 0, 'SH-dag', 'SH-dage')}` : ''}):`}</Typography>
                <Typography className="row--text">{formatCountWithUnit(beregningsData.arbejdsdageIPeriode, 'arbejdsdag', 'arbejdsdage')}</Typography>
              </Box>
              <Box className="row--label-right-hover">
                <Typography className="row--text">{fuldLoenUnderFerie
                  ? `Arbejdsdage på et år (${STANDARD_HVERDAGE_PAA_AAR} hverdage - ${STANDARD_SH_DAGE_PAA_AAR} SH-dage):`
                  : `Arbejdsdage på et år (${STANDARD_HVERDAGE_PAA_AAR} hverdage - ${beregningsData.feriedagePaaAar} feriedage - ${STANDARD_SH_DAGE_PAA_AAR} SH-dage):`
                }</Typography>
                <Typography className="row--text">{formatCountWithUnit(beregningsData.arbejdsdagePaaAar, 'arbejdsdag', 'arbejdsdage')}</Typography>
              </Box>
              {omregnetRow(`${formatCurrency(beregnetAarsloen)} / ${beregningsData.arbejdsdageIPeriode} × ${beregningsData.arbejdsdagePaaAar}`, beregningsData.omregnetAarsloen)}
            </>
          )}

          {beregningsData.metode === 'B' && (
            <>
              <Box className="row--label-right-hover">
                <Typography className="row--text">{`Hverdage i beregningsperioden (${formatCountWithUnit(beregningsData.hverdageIPeriode, 'hverdag', 'hverdage')}${feriedageFradrag(beregningsData.feriedageFraInput)}):`}</Typography>
                <Typography className="row--text">{formatCountWithUnit(beregningsData.arbejdsdageIPeriode, 'hverdag', 'hverdage')}</Typography>
              </Box>
              <Box className="row--label-right-hover">
                <Typography className="row--text">{fuldLoenUnderFerie
                  ? `Hverdage på et år (${STANDARD_HVERDAGE_PAA_AAR} hverdage):`
                  : `Hverdage på et år (${STANDARD_HVERDAGE_PAA_AAR} hverdage - ${beregningsData.feriedagePaaAar} ${retTilSjetteFerieuge ? 'ferie- og feriefridage' : 'feriedage'}):`
                }</Typography>
                <Typography className="row--text">{formatCountWithUnit(beregningsData.hverdagePaaAar, 'hverdag', 'hverdage')}</Typography>
              </Box>
              {omregnetRow(`${formatCurrency(beregnetAarsloen)} / ${beregningsData.arbejdsdageIPeriode} × ${beregningsData.hverdagePaaAar}`, beregningsData.omregnetAarsloen)}
            </>
          )}

          {beregningsData.metode === 'C' && (
            <>
              {loenperiode === LOENPERIODE.MAANED && (
                <>
                  <Box className="row--label-right-hover">
                    <Typography className="row--text">Antal måneder i indtastede perioder:</Typography>
                    <Typography className="row--text">{formatCountWithUnit(beregningsData.antalEnheder, 'måned', 'måneder')}</Typography>
                  </Box>
                  {omregnetRow(`${formatCurrency(beregnetAarsloen)} / ${beregningsData.antalEnheder} × 12`, beregningsData.omregnetAarsloen)}
                </>
              )}

              {loenperiode === LOENPERIODE.UGE && (
                <>
                  <Box className="row--label-right-hover">
                    <Typography className="row--text">Antal uger i indtastede perioder:</Typography>
                    <Typography className="row--text">{formatCountWithUnit(beregningsData.antalEnheder, 'uge', 'uger')}</Typography>
                  </Box>
                  {omregnetRow(`${formatCurrency(beregnetAarsloen)} / ${beregningsData.antalEnheder} × 52,14`, beregningsData.omregnetAarsloen)}
                </>
              )}

              {loenperiode === LOENPERIODE.DAG && (
                <>
                  {beregningsData.antalHeleKalendermaaneder !== null ? (
                    <>
                      <Box className="row--label-right-hover">
                        <Typography className="row--text">Antal måneder i indtastede perioder:</Typography>
                        <Typography className="row--text">{formatCountWithUnit(beregningsData.antalHeleKalendermaaneder, 'måned', 'måneder')}</Typography>
                      </Box>
                      {omregnetRow(`${formatCurrency(beregnetAarsloen)} / ${beregningsData.antalHeleKalendermaaneder} × 12`, beregningsData.omregnetAarsloen)}
                    </>
                  ) : (
                    <>
                      <Box className="row--label-right-hover">
                        <Typography className="row--text">{`Hverdage i beregningsperioden (${formatCountWithUnit(beregningsData.hverdageIPeriode, 'hverdag', 'hverdage')}${feriedageFradrag(beregningsData.feriedageFraInput)}):`}</Typography>
                        <Typography className="row--text">{formatCountWithUnit(beregningsData.arbejdsdageIPeriode, 'hverdag', 'hverdage')}</Typography>
                      </Box>
                      <Box className="row--label-right-hover">
                        <Typography className="row--text">{fuldLoenUnderFerie
                          ? `Hverdage på et år (${STANDARD_HVERDAGE_PAA_AAR} hverdage):`
                          : `Hverdage på et år (${STANDARD_HVERDAGE_PAA_AAR} hverdage - ${beregningsData.feriedagePaaAar} ${retTilSjetteFerieuge ? 'ferie- og feriefridage' : 'feriedage'}):`
                        }</Typography>
                        <Typography className="row--text">{formatCountWithUnit(beregningsData.hverdagePaaAar, 'hverdag', 'hverdage')}</Typography>
                      </Box>
                      {omregnetRow(`${formatCurrency(beregnetAarsloen)} / ${beregningsData.arbejdsdageIPeriode} × ${beregningsData.hverdagePaaAar}`, beregningsData.omregnetAarsloen)}
                    </>
                  )}
                </>
              )}
            </>
          )}
        </>
      )}
    </ContentBox>
  );
});

AarsloenBeregningSection.displayName = 'AarsloenBeregningSection';

export default AarsloenBeregningSection;
