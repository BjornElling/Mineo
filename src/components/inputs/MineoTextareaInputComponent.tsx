import * as React from 'react';

type MineoTextareaInputComponentProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  maxRows?: unknown;
  minRows?: unknown;
  ownerState?: unknown;
  type?: unknown;
};

/**
 * Native textarea-input-komponent til MUI InputBase.
 *
 * MUI's default multiline-vej bruger TextareaAutosize, som renderer en skjult
 * måle-textarea uden id/name. Mineo bruger faste rækketal, så autosize-shadow-noden
 * er unødvendig og udløser advarsler i browserens DevTools.
 */
const MineoTextareaInputComponent = React.forwardRef<HTMLTextAreaElement, MineoTextareaInputComponentProps>(
  ({ maxRows: _maxRows, minRows: _minRows, ownerState: _ownerState, type: _type, ...props }, ref) => (
    <textarea {...props} ref={ref} />
  )
);

MineoTextareaInputComponent.displayName = 'MineoTextareaInputComponent';

export default MineoTextareaInputComponent;
