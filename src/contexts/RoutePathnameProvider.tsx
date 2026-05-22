import React from 'react';
import { useLocation } from 'react-router-dom';
import { RoutePathnameContextProvider } from './RoutePathnameContext.shared';

type RoutePathnameProviderProps = Readonly<{
  children: React.ReactNode;
}>;

export const RoutePathnameProvider = ({ children }: RoutePathnameProviderProps): React.ReactElement => {
  const location = useLocation();

  return (
    <RoutePathnameContextProvider value={location.pathname}>
      {children}
    </RoutePathnameContextProvider>
  );
};
