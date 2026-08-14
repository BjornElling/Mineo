import React from 'react';
import { Box, Typography } from '@mui/material';
import { VERSION } from '../../config/buildInfo';
import {
  PWA_OPEN_PROTOCOL_URL,
  requestPwaInstall,
  type PwaInstallUnavailableReason,
} from '../../utils/pwaInstallPrompt';
import ContentBox from '../layout/ContentBox';
import LabeledControlRow from '../layout/LabeledControlRow';
import SiblingSitesFooter from '../layout/SiblingSitesFooter';
import ConfirmationDialog from '../ui/ConfirmationDialog';
import LicenseModal from '../ui/LicenseModal';
import StyledToggleSwitch from '../inputs/StyledToggleSwitch';
import type { CommitEvent } from '../../types/fieldEvents';
import { useAppSettings } from '../../contexts/useAppSettings';

import GitHubIcon from '@mui/icons-material/GitHub';
import BrowserUpdatedIcon from '@mui/icons-material/BrowserUpdated';

type PwaInstallDialogState =
  | { kind: 'alreadyInstalled'; state: 'running' | 'installed' }
  | { kind: 'unavailable'; reason: PwaInstallUnavailableReason };

type PwaInstallDialogCopy = Readonly<{
  title: string;
  message: string;
  confirmText: string;
  hideCancelButton: boolean;
}>;

const getPwaInstallDialogCopy = (state: PwaInstallDialogState): PwaInstallDialogCopy => {
  if (state.kind === 'alreadyInstalled') {
    return state.state === 'running'
      ? {
        title: 'Hjælpeprogrammet er allerede åbent',
        message: 'Du bruger det lige nu. Du behøver ikke hente det igen.',
        confirmText: 'Luk',
        hideCancelButton: true,
      }
      : {
        title: 'Hjælpeprogrammet er allerede installeret',
        message: 'Du behøver ikke hente det igen. Vil du åbne det nu? Første gang kan browseren bede om tilladelse til at åbne hjælpeprogrammet. Hvis det ikke åbner, kan du starte det fra computerens appmenu eller skrivebord.',
        confirmText: 'Åbn program',
        hideCancelButton: false,
      };
  }

  if (state.reason === 'statusUnknown') {
    return {
      title: 'Installationsstatus kunne ikke afgøres',
      message: 'Browseren kan ikke oplyse, om hjælpeprogrammet allerede er installeret, og kan ikke åbne installationsdialogen. Hvis det allerede er installeret, skal du åbne det fra computerens appmenu. Ellers skal du bruge Google Chrome eller Microsoft Edge.',
      confirmText: 'Luk',
      hideCancelButton: true,
    };
  }

  if (state.reason === 'promptFailed') {
    return {
      title: 'Installationen kunne ikke startes',
      message: 'Browseren kunne ikke starte installationsdialogen. Prøv igen eller brug installationsikonet i adresselinjen eller browserens menu.',
      confirmText: 'Luk',
      hideCancelButton: true,
    };
  }

  return {
    title: 'Installationsdialogen kunne ikke åbnes',
    message: 'Browseren kunne ikke åbne installationsdialogen. Brug installationsikonet i adresselinjen eller browserens menu for at installere hjælpeprogrammet.',
    confirmText: 'Luk',
    hideCancelButton: true,
  };
};

/**
 * Mineo-komponent
 */
const Mineo = React.memo(() => {
  const { settings, updateSettings } = useAppSettings();
  const [licenseOpen, setLicenseOpen] = React.useState(false);
  // `null` = dialogen er lukket. Ellers bærer tilstanden både årsag og situation, så et mislykket
  // åbneforsøg eller en ukendt browserstatus ikke kan ende som en tavs lukning.
  const [pwaInstallDialogState, setPwaInstallDialogState] = React.useState<PwaInstallDialogState | null>(null);
  // WebKit fokuserer ikke en `<button>` ved klik, så dialogen har intet aktivt element at huske.
  // Uden denne reference ville fokus efter lukning lande på sidens første knap (hamburger-menuen).
  const installButtonRef = React.useRef<HTMLButtonElement>(null);
  const licenseButtonRef = React.useRef<HTMLButtonElement>(null);

  // Begge kontroller bærer `data-mineo-focusable-button="true"`: uden markøren er de ikke i
  // Containerens fokusinventar, og Enter faldt derfor igennem til den generiske «flyt til næste
  // felt»-vej frem for at ramme knap-undtagelsen. Mellemrum virkede (native knapsemantik), men
  // Enter flyttede fokus videre uden at åbne popupen — en popup-åbnende knap skal kunne aktiveres
  // med begge taster (jf. keyboard-navigation.md §Implementeringsfrihed og §Popup-fokus-restore).
  //
  // Begge kontroller UDFØRER en handling på siden (åbner en dialog / starter PWA-installationen) — de
  // navigerer ikke. De er derfor `<button>`, ikke `<a href="#">`. Et bart fragment-href gjorde to skader:
  // det løj om semantikken over for skærmlæsere, OG det nulstillede browserens sekventielle
  // fokus-udgangspunkt til dokumentets top, så næste `Tab` sprang tilbage til startside-togglen længere
  // OPPE på siden i stedet for videre til næste link. Ingen `preventDefault` kan reparere det,
  // fordi det er href'et selv — ikke default-handlingen — der flytter fokus-origoen.

  // Installations-tilstanden aflæses ved KLIKKET, ikke ved render. En bruger, der installerer
  // hjælpeprogrammet fra adresselinjen og derefter klikker på linket, skal møde den aktuelle
  // sandhed — ikke en tilstand, der blev målt da siden blev åbnet.
  const installRequestInFlightRef = React.useRef(false);
  const handleInstallClick = React.useCallback(() => {
    if (installRequestInFlightRef.current) return;
    installRequestInFlightRef.current = true;

    // requestPwaInstall kaldes direkte i klik-handleren. Det er vigtigt: hvis vi først await'er
    // installationsdetektionen, kan browserens brugeraktivering være udløbet, når prompt() kaldes.
    void requestPwaInstall()
      .then((result) => {
        if (result.kind === 'completed') return;
        if (result.kind === 'alreadyInstalled') {
          setPwaInstallDialogState({ kind: 'alreadyInstalled', state: result.state });
          return;
        }
        setPwaInstallDialogState({ kind: 'unavailable', reason: result.reason });
      })
      .catch(() => {
        setPwaInstallDialogState({ kind: 'unavailable', reason: 'promptFailed' });
      })
      .finally(() => {
        installRequestInFlightRef.current = false;
      });
  }, []);

  const handleAlreadyInstalledClose = React.useCallback(() => {
    setPwaInstallDialogState(null);
  }, []);

  const handleLicenseClick = React.useCallback(() => {
    setLicenseOpen(true);
  }, []);

  const handleLicenseClose = React.useCallback(() => {
    setLicenseOpen(false);
  }, []);

  const pwaInstallDialogCopy = pwaInstallDialogState === null
    ? null
    : getPwaInstallDialogCopy(pwaInstallDialogState);

  return (
    <Box className="mineo-page">
      {/* Side-header */}
      <Typography className="page-title">Mineo</Typography>

      {/* ------------------------------------------------------ */}
      {/* Beskrivelse */}
      {/* ------------------------------------------------------ */}
      <ContentBox className="content-box flow--16">
        <Typography className="section-header">Programmet</Typography>

        <Typography className="row--text">
          Mineo er et specialiseret regneprogram, der er udviklet til brug for advokater 
          og arbejdsskadekonsulenter, som arbejder i eller for fagbevægelsen, og som beskæftiger
          sig med arbejdsskadesager.
        </Typography>

        <Typography className="row--text">
          Programmet forudsætter, at du har et godt kendskab til emnet. Arbejdsskadesager
          er komplekse og beror på en lang række matematiske og juridiske forudsætninger,
          som ikke altid er indlysende.
        </Typography>

        <Typography className="row--text">
          Selvom der er indlagt en vis fejlkontrol i programmet, kan det ikke forhindre dig
          i at lægge forkerte forudsætninger til grund. Sørg for at vide, hvad du laver, og
          kontrollér altid dine beregninger grundigt.
        </Typography>

      </ContentBox>

      {/* ------------------------------------------------------ */}
      {/* Teknisk */}
      {/* ------------------------------------------------------ */}
      <ContentBox className="content-box flow--16">
        <Typography className="section-header">Teknisk</Typography>

        <Typography className="row--text">
          For at kunne dobbeltklikke på lokale .eo-filer og åbne dem direkte i Mineo, skal du installere et
          hjælpeprogram. Det kan hentes via linket nedenfor eller ved at klikke på installationsikonet yderst
          til højre i browserens adresselinje (Google Chrome {' '}
          <BrowserUpdatedIcon fontSize="small" sx={{ verticalAlign: 'text-bottom' }} />
          {' '} / Microsoft Edge {' '}
          <Box
            component="svg"
            sx={{ width: 20, height: 20, verticalAlign: 'text-bottom' }}
            viewBox="0 0 20 20"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M15 3C15 2.72386 14.7761 2.5 14.5 2.5C14.2239 2.5 14 2.72386 14 3V5H12C11.7239 5 11.5 5.22386 11.5 5.5C11.5 5.77614 11.7239 6 12 6H14V8C14 8.27614 14.2239 8.5 14.5 8.5C14.7761 8.5 15 8.27614 15 8V6H17C17.2761 6 17.5 5.77614 17.5 5.5C17.5 5.22386 17.2761 5 17 5L15 5V3ZM4.5 17C3.67157 17 3 16.3284 3 15.5V4.5C3 3.67157 3.67157 3 4.5 3H9C9.82843 3 10.5 3.67157 10.5 4.5V9.5H15.5C16.3284 9.5 17 10.1716 17 11V15.5C17 16.3284 16.3284 17 15.5 17H4.5ZM10.5 10.5V16H15.5C15.7761 16 16 15.7761 16 15.5V11C16 10.7239 15.7761 10.5 15.5 10.5H10.5ZM9.5 16V10.5H4V15.5C4 15.7589 4.19675 15.9718 4.44888 15.9974C4.46569 15.9991 4.48274 16 4.5 16H9.5ZM9.5 4.5C9.5 4.22386 9.27614 4 9 4H4.5C4.22386 4 4 4.22386 4 4.5V9.5H9.5V4.5Z" fill="currentColor"/>
          </Box>).
        </Typography>

        <Box
          component="ul"
          className="list-container"
          sx={{ marginTop: 0, marginBottom: 0, paddingLeft: '20px', color: 'var(--color-text-primary)', lineHeight: 1.6 }}
        >
          <Box component="li" sx={{ marginBottom: 0 }}>
            <Box
              component="button"
              type="button"
              ref={installButtonRef}
              onClick={handleInstallClick}
              data-mineo-focusable-button="true"
              className="icon-text-link"
            >
              Download hjælpeprogram
            </Box>
          </Box>
        </Box>

        <Typography className="row--text">
          Bemærk, at hjælpeprogrammet kun kan installeres, hvis du benytter Google Chrome eller Microsoft Edge.
        </Typography>

        {/* Bevidst UX-beslutning: denne toggle er placeret på Mineo-siden — ikke på
            Indstillinger-siden. Mineo-siden er den første side nye brugere møder, og
            det giver kontekst til valget: brugeren ser programbeskrivelsen og kan
            derfra beslutte, om Stamdata skal være standardstart. */}
        <LabeledControlRow label="Gør stamdata-siden til startside fremover">
          {({ labelledBy, controlId }) => (
            <StyledToggleSwitch
              id={controlId}
              labelledBy={labelledBy}
              checked={settings.defaultStartsideErStamdata}
              onCommit={(event: CommitEvent<boolean>) => updateSettings({ defaultStartsideErStamdata: event.target.value })}
            />
          )}
        </LabeledControlRow>

      </ContentBox>

      {/* ------------------------------------------------------ */}
      {/* Persondata */}
      {/* ------------------------------------------------------ */}
      <ContentBox className="content-box flow--16">
        <Typography className="section-header">Persondata</Typography>

        <Typography className="row--text">
          Mineo er udviklet som en client-side applikation. Det indebærer, at al
          databehandling finder sted i browseren på brugerens egen computer.
        </Typography>

        <Typography className="row--text">
          Programmet kommunikerer ikke med nogen server under brug, og der indsamles,
          gemmes eller transmitteres ingen data — hverken persondata, brugsstatistik
          eller anden information.
        </Typography>

        <Typography className="row--text">
          Mens programmet kører, bliver de indtastede oplysninger midlertidigt gemt
          i browserens hukommelse, som nulstilles, når browseren lukkes.
        </Typography>
      </ContentBox>

      {/* ------------------------------------------------------ */}
      {/* Licens */}
      {/* ------------------------------------------------------ */}
      <ContentBox className="content-box flow--16">
        <Typography className="section-header">Licensvilkår</Typography>

        {/* Licensforklaring */}
        <Typography className="row--text">
          Programmet er gratis at bruge og udgives under{' '}
          <Box
            component="button"
            type="button"
            ref={licenseButtonRef}
            onClick={handleLicenseClick}
            data-mineo-focusable-button="true"
            className="icon-text-link"
            sx={{ display: 'inline' }}
          >
            MIT-licensen
          </Box>
          , hvilket indebærer:
        </Typography>

        {/* Punktopstilling */}
        <Box className="list-container">

          <Box className="numbered-list-item">
            <Typography className="row--text">1)</Typography>
            <Typography className="row--text">
              Du kan bruge programmet frit — også til kommercielle formål.
            </Typography>
          </Box>

          <Box className="numbered-list-item">
            <Typography className="row--text">2)</Typography>
            <Typography className="row--text">
              Kildekoden er frit tilgængelig og må ændres, forbedres og videreudvikles.
            </Typography>
          </Box>

          <Box className="numbered-list-item" sx={{ marginBottom: 0 }}>
            <Typography className="row--text">3)</Typography>
            <Typography className="row--text">
              Programmet leveres &quot;som det er&quot; uden nogen form for garanti.
            </Typography>
          </Box>

        </Box>

        <Typography className="row--text">
          Ved brug af programmet skal du være opmærksom på, at det aktuelt er i en åben
          testudgave. Programmet er grundigt testet, men fejl kan forekomme. Sørg derfor
          altid for at kontrollere dine beregninger.
        </Typography>

      </ContentBox>

      {/* ------------------------------------------------------ */}
      {/* License Modal */}
      <LicenseModal
        open={licenseOpen}
        onClose={handleLicenseClose}
        restoreFocusTo={licenseButtonRef}
      />

      {/* ------------------------------------------------------ */}
      {/* «Allerede installeret»-dialog */}
      <ConfirmationDialog
        open={pwaInstallDialogState !== null}
        onConfirm={handleAlreadyInstalledClose}
        onCancel={handleAlreadyInstalledClose}
        hideCancelButton={pwaInstallDialogCopy?.hideCancelButton ?? true}
        title={pwaInstallDialogCopy?.title ?? 'Installationsstatus'}
        message={pwaInstallDialogCopy?.message ?? 'Installationsstatus er ikke tilgængelig.'}
        confirmText={pwaInstallDialogCopy?.confirmText ?? 'Luk'}
        confirmHref={pwaInstallDialogState?.kind === 'alreadyInstalled' && pwaInstallDialogState.state === 'installed'
          ? PWA_OPEN_PROTOCOL_URL
          : undefined}
        cancelText="Annuller"
        restoreFocusTo={installButtonRef}
      />

      {/* ------------------------------------------------------ */}
      {/* Status */}
      {/* ------------------------------------------------------ */}
      <ContentBox className="content-box flow--16">
        <Typography className="section-header">Status</Typography>

        <Typography className="row--text">
          Programmet er fortsat under udvikling og vil løbende få opdateringer og nye funktioner.
        </Typography>

        <Typography className="row--text">
          Udviklingen sker i fritiden og drives udelukkende af personlig interesse. Alle konstaterede fejl rettes straks,
          men nye funktionaliteter udvikles og implementeres kun, når tid og overskud tillader det.
        </Typography>

        <Typography className="row--text">
          Aktuel version: {VERSION}
        </Typography>

        <Box className="icon-text-row" sx={{ padding: '0 12px' }}>
          <GitHubIcon fontSize="small" sx={{ flexShrink: 0 }} />
          <Typography
            className="row--text icon-text-link"
            component="a"
            href="https://github.com/BjornElling/Mineo"
            target="_blank"
            rel="noopener noreferrer"
          >
            github.com/BjornElling/Mineo
          </Typography>
        </Box>
      </ContentBox>

      <SiblingSitesFooter currentSite="mineo" />

    </Box>
  );
});

Mineo.displayName = 'Mineo';

export default Mineo;
