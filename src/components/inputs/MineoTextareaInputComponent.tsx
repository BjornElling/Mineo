import * as React from 'react';

type MineoTextareaInputComponentProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  maxRows?: unknown;
  minRows?: unknown;
  ownerState?: unknown;
  type?: unknown;
};

/**
 * Native textarea input component for MUI InputBase.
 *
 * MUI's default multiline path uses TextareaAutosize, which renders a hidden
 * measurement textarea without id/name. Mineo uses fixed row counts, so the
 * autosize shadow node is unnecessary and triggers browser DevTools warnings.
 */
const MineoTextareaInputComponent = React.forwardRef<HTMLTextAreaElement, MineoTextareaInputComponentProps>(
  ({ maxRows: _maxRows, minRows: _minRows, ownerState: _ownerState, type: _type, ...props }, ref) => (
    <textarea {...props} ref={ref} />
  )
);

MineoTextareaInputComponent.displayName = 'MineoTextareaInputComponent';

export default MineoTextareaInputComponent;
