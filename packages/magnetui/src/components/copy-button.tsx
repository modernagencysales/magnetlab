'use client';

import * as React from 'react';
import { Check, Copy } from 'lucide-react';
import { cn } from '../utils/cn';
import { Button } from './button';
import { iconSize, iconStrokeWidth } from '../tokens/spacing';
import type { ButtonProps } from './button';

export interface CopyButtonProps extends Omit<ButtonProps, 'onClick'> {
  value: string;
  label?: string;
  copiedLabel?: string;
  onCopy?: () => void;
}

const CopyButton = React.forwardRef<HTMLButtonElement, CopyButtonProps>(
  ({ value, label, copiedLabel, onCopy, className, variant = 'ghost', size = 'icon-sm', ...props }, ref) => {
    const [copied, setCopied] = React.useState(false);

    const handleCopy = React.useCallback(async () => {
      try {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        onCopy?.();
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // Fallback for older browsers
        const textarea = document.createElement('textarea');
        textarea.value = value;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        setCopied(true);
        onCopy?.();
        setTimeout(() => setCopied(false), 2000);
      }
    }, [value, onCopy]);

    return (
      <Button
        ref={ref}
        variant={variant}
        size={size}
        className={cn(
          'shrink-0 transition-all',
          copied && 'text-emerald-600 hover:text-emerald-600 dark:text-emerald-400 dark:hover:text-emerald-400',
          className
        )}
        onClick={handleCopy}
        aria-label={copied ? 'Copied' : 'Copy to clipboard'}
        {...props}
      >
        {copied ? (
          <>
            <Check size={iconSize.sm} strokeWidth={iconStrokeWidth} className="animate-in zoom-in-50 duration-200" />
            {copiedLabel && <span>{copiedLabel}</span>}
          </>
        ) : (
          <>
            <Copy size={iconSize.sm} strokeWidth={iconStrokeWidth} />
            {label && <span>{label}</span>}
          </>
        )}
      </Button>
    );
  }
);
CopyButton.displayName = 'CopyButton';

export { CopyButton };
