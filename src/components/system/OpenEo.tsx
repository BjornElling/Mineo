import React from 'react';
import { Navigate } from 'react-router-dom';
import { APP_ROUTES } from '../../config/pageNavigation';

/**
 * Browserens PWA-filhandler skal lande på en intern route, men den route må ikke være et ekstra
 * load-flow. MainLayout ejer allerede den pending request og fortsætter den uanset aktuel route.
 * En statisk timeoutside her kunne hverken kende filens tilstand eller genoptage den korrekt.
 */
const OpenEo = React.memo(() => <Navigate to={APP_ROUTES.stamdata} replace />);

OpenEo.displayName = 'OpenEo';

export default OpenEo;
