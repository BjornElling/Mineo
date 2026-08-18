import React from 'react';
import { Box, IconButton, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { CONTENT_SCALE_CSS_VARIABLE } from '../../utils/uiScale';

/**
 * Overlay-komponent til at vise midlertidige beskeder.
 * Vises øverst til højre. Auto-close-varigheden afhænger af typen:
 * success 3 s, info 4 s, warning 5 s. Error auto-lukker aldrig.
 *
 * **Fejlbeskeden kan lukkes uden mus.** Den blev tidligere KUN lukket ved et klik på selve
 * boksen, med museteksten «Klik for at lukke» som eneste vejledning: der var ingen synlig lukkeknap,
 * Escape gjorde intet, og boksen lå uden for tab-rækkefølgen. Den blev derfor stående og dækkede en
 * del af skærmen, indtil brugeren fandt den med musen. Nu gælder tre ting for den blivende
 * fejlvariant:
 *
 *  - en synlig, fokusérbar lukkeknap,
 *  - Escape lukker,
 *  - `role="alert"`, så en skærmlæser oplyser beskeden, når den kommer.
 *
 * De auto-lukkende varianter (success/info/warning) beholder deres adfærd: de forsvinder af sig selv
 * og har derfor ikke brug for en lukkeaffordance. De bærer `role="status"`, som er den høflige
 * pendant — den afbryder ikke oplæsningen midt i en sætning.
 *
 * @param {Object} props
 * @param {string} props.message - Besked der skal vises
 * @param {string} props.type - Type: 'success', 'error', 'warning', 'info'
 * @param {function} props.onClose - Callback når overlay lukkes
 */
type OverlayType = 'success' | 'error' | 'warning' | 'info';

type OverlayProps = {
  message: string;
  type?: OverlayType;
  onClose?: () => void;
};

const Overlay = React.memo(({ message, type = 'success', onClose }: OverlayProps) => {
  const [visible, setVisible] = React.useState(true);
  const [fadeOut, setFadeOut] = React.useState(false);

  // Bestem varighed baseret på overlay-type
  const getDuration = () => {
    switch (type) {
      case 'error':
        return null; // Ingen auto-close
      case 'success':
        return 3000;
      case 'warning':
        return 5000;
      case 'info':
        return 4000;
      default:
        return 3000;
    }
  };

  const duration = getDuration();

  // `onClose` holdes i en ref, så auto-close-effekten kun afhænger af `duration`.
  // Ellers ville en ny inline-`onClose` fra forælderen ved hver re-render genstarte
  // nedtællingen, så et 3 s success-overlay kunne hænge fast (rapporteret problem).
  const onCloseRef = React.useRef(onClose);
  React.useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  /**
   * Den ENE lukkevej. Både lukkeknappen, Escape og klik på boksen ender her, så fade-ud og
   * `onClose`-kvitteringen ikke kan komme ud af trit mellem tre kopier af samme handler.
   */
  const dismissTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const dismiss = React.useCallback(() => {
    if (dismissTimeoutRef.current !== null) return;
    setFadeOut(true);
    dismissTimeoutRef.current = setTimeout(() => {
      setVisible(false);
      dismissTimeoutRef.current = null;
      onCloseRef.current?.();
    }, 300);
  }, []);

  React.useEffect(() => () => {
    if (dismissTimeoutRef.current !== null) clearTimeout(dismissTimeoutRef.current);
  }, []);

  // Escape lukker den blivende fejlbesked. Kun den: de auto-lukkende varianter forsvinder selv, og en
  // Escape-lytter på dem ville stjæle tasten fra en åben dialog eller en igangværende feltredigering.
  const isDismissible = duration === null;
  React.useEffect(() => {
    if (!isDismissible) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      dismiss();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => { document.removeEventListener('keydown', handleKeyDown); };
  }, [dismiss, isDismissible]);

  React.useEffect(() => {
    // Hvis duration er null (error-type), luk ikke automatisk
    if (duration === null) {
      return;
    }

    const fadeTimer = setTimeout(() => {
      setFadeOut(true);
    }, duration - 500);

    const closeTimer = setTimeout(() => {
      setVisible(false);
      onCloseRef.current?.();
    }, duration);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(closeTimer);
    };
  }, [duration]);

  if (!visible) {
    return null;
  }

  // Bestem farver baseret på type
  const colors = {
    success: {
      bg: 'var(--color-overlay-bg)',
      border: 'var(--color-status-success)',
      text: 'var(--color-status-success)',
    },
    error: {
      bg: 'var(--color-overlay-bg)',
      border: 'var(--color-status-error)',
      text: 'var(--color-status-error)',
    },
    warning: {
      bg: 'var(--color-overlay-bg)',
      border: 'var(--color-status-warning)',
      text: 'var(--color-status-warning)',
    },
    info: {
      bg: 'var(--color-overlay-bg)',
      border: 'var(--color-status-info)',
      text: 'var(--color-status-info)',
    },
  };

  const colorScheme = colors[type] || colors.success;

  return (
    <Box
      // `alert` afbryder og oplyser straks — rigtigt for den blivende fejl, brugeren skal reagere på.
      // `status` er den høflige pendant til de beskeder, der forsvinder af sig selv.
      role={isDismissible ? 'alert' : 'status'}
      sx={{
        position: 'fixed',
        top: 20,
        right: 20,
        zIndex: 9999,
        // Beskeden ligger uden for arbejdsfladens zoom-rod, men oven på den. Uden dette står den
        // med større tekst end siden, den melder om, så snart vinduet er så smalt, at fladen
        // skaleres ned. `zoom` skalerer også `top`/`right`, så afstanden til hjørnet følger
        // arbejdsfladens gutter i stedet for at vokse relativt.
        zoom: `var(${CONTENT_SCALE_CSS_VARIABLE}, 1)`,
        backgroundColor: colorScheme.bg,
        border: `2px solid ${colorScheme.border}`,
        borderRadius: '10px',
        padding: isDismissible ? '12px 12px 12px 20px' : '12px 20px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        minWidth: '150px',
        maxWidth: '400px',
        opacity: fadeOut ? 0 : 1,
        transform: fadeOut ? 'translateY(-10px)' : 'translateY(0)',
        transition: 'all 0.3s ease-out',
        pointerEvents: fadeOut ? 'none' : 'auto',
        // Klik på hele boksen bevares som en genvej for musebrugere, der er vant til den.
        cursor: isDismissible ? 'pointer' : 'default',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: isDismissible ? '8px' : 0,
      }}
      onClick={isDismissible ? dismiss : undefined}
    >
      <Typography
        variant="text"
        sx={{
          color: colorScheme.text,
          fontWeight: 600,
          textAlign: 'center',
          margin: 0,
          whiteSpace: 'pre-line', // Tillad line breaks i beskeder
          flex: 1,
        }}
      >
        {message}
      </Typography>
      {isDismissible ? (
        <IconButton
          type="button"
          aria-label="Luk besked"
          data-mineo-focusable-button="true"
          size="small"
          // Boksen ejer selv et klik-til-luk; uden dette ville knappens klik boble op og kalde
          // `dismiss` to gange. Den anden ville være en no-op, men afhængigheden af det ville være
          // uskreven — så den stoppes eksplicit.
          onClick={(event) => {
            event.stopPropagation();
            dismiss();
          }}
          sx={{ color: colorScheme.text, padding: '4px' }}
        >
          <CloseIcon sx={{ fontSize: '18px' }} />
        </IconButton>
      ) : null}
    </Box>
  );
});

Overlay.displayName = 'Overlay';

export default Overlay;
