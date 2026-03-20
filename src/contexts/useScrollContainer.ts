import React from 'react';
import { ScrollContainerContext } from './ScrollContainerContext';
import type { ScrollContainerContextValue } from './ScrollContainerContext';

export const useScrollContainer = (): ScrollContainerContextValue => {
  return React.useContext(ScrollContainerContext);
};
