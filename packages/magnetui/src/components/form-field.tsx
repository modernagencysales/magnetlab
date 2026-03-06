'use client';

import * as React from 'react';
import { cn } from '../utils/cn';

export interface FormFieldProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Field label */
  label: string;
  /** HTML for attribute linking to input id */
  htmlFor?: string;
  /** Error message */
  error?: string;
  /** Hint text below the input */
  hint?: string;
  /** Whether the field is required */
  required?: boolean;
}

const FormField = React.forwardRef<HTMLDivElement, FormFieldProps>(
  ({ className, label, htmlFor, error, hint, required, children, ...props }, ref) => (
    <div ref={ref} className={cn('space-y-1.5', className)} {...props}>
      <label htmlFor={htmlFor} className="text-sm font-medium text-foreground">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-500">{error}</p>}
      {!error && hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
);
FormField.displayName = 'FormField';

export { FormField };
