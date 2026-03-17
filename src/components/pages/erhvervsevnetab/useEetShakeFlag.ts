import React from 'react';

const SHAKE_DURATION_MS = 500;

export const useEetShakeFlag = (): Readonly<{
  shake: boolean;
  triggerShake: () => void;
}> => {
  const [shake, setShake] = React.useState(false);
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearShakeTimeout = React.useCallback(() => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  React.useEffect(() => clearShakeTimeout, [clearShakeTimeout]);

  const triggerShake = React.useCallback(() => {
    clearShakeTimeout();
    setShake(true);
    timeoutRef.current = setTimeout(() => {
      setShake(false);
      timeoutRef.current = null;
    }, SHAKE_DURATION_MS);
  }, [clearShakeTimeout]);

  return { shake, triggerShake };
};
