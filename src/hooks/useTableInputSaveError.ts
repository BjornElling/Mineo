import * as React from 'react';
import { clearTableInputError, setTableInputError } from '../utils/tableInputErrorRegistry';

type UseTableInputSaveErrorArgs = Readonly<{
  key: string;
  active: boolean;
  message: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
}>;

export const useTableInputSaveError = ({
  key,
  active,
  message,
  inputRef,
}: UseTableInputSaveErrorArgs): void => {
  React.useEffect(() => {
    if (!active || message.trim() === '') {
      clearTableInputError(key);
      return undefined;
    }

    setTableInputError(key, {
      message,
      getElement: () => inputRef.current,
    });

    return () => {
      clearTableInputError(key);
    };
  }, [active, inputRef, key, message]);
};
