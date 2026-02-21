import React from 'react';

/**
 * Context til at give adgang til scroll-containeren på tværs af komponenter
 *
 * Dette undgår DOM-søgninger og sikrer at ScrollToTopButton altid refererer
 * til den korrekte container, selv hvis layout ændrer sig.
 *
 * KONTRAKT:
 * - Når ready=true, er container garanteret et mounted HTMLElement
 * - Når ready=false, er container enten null eller ikke klar til brug
 * - Consumers skal tjekke ready før de bruger container
 */
type ScrollContainerContextValue =
  | { ready: true; container: HTMLElement }
  | { ready: false; container: null };

const ScrollContainerContext = React.createContext<ScrollContainerContextValue>({
  ready: false,
  container: null,
});

export const useScrollContainer = (): ScrollContainerContextValue => {
  return React.useContext(ScrollContainerContext);
};

export const ScrollContainerProvider: React.FC<{
  containerRef: React.RefObject<HTMLElement | null>;
  children: React.ReactNode;
}> = ({ containerRef, children }) => {
  // Track container-elementet direkte (ikke ref-objektet)
  // Dette sikrer at vi kun re-renderer når det faktiske DOM-element skifter
  const [containerElement, setContainerElement] = React.useState<HTMLElement | null>(() => {
    // Initial state: Prøv at læse containerRef.current med det samme
    const element = containerRef.current;
    return element instanceof HTMLElement ? element : null;
  });

  React.useEffect(() => {
    const element = containerRef.current;
    if (element instanceof HTMLElement && element !== containerElement) {
      setContainerElement(element);
    }
  }, [containerRef, containerElement]);

  const value = React.useMemo<ScrollContainerContextValue>(() => {
    if (containerElement instanceof HTMLElement) {
      return { ready: true, container: containerElement };
    }
    return { ready: false, container: null };
  }, [containerElement]);

  return (
    <ScrollContainerContext.Provider value={value}>
      {children}
    </ScrollContainerContext.Provider>
  );
};
