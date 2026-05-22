import React from 'react';

const RoutePathnameContext = React.createContext<string | null>(null);

export const RoutePathnameContextProvider = RoutePathnameContext.Provider;

export const useRoutePathnameSnapshot = (): string | null => {
  return React.useContext(RoutePathnameContext);
};
