import React from 'react';

interface SectionBridgeProps {
  text: string;
  variant?: 'default' | 'accent' | 'gradient';
  stepNumber?: number;
  stepLabel?: string;
  className?: string;
}

const SectionBridge: React.FC<SectionBridgeProps> = ({
  text,
  variant = 'default',
  stepNumber,
  stepLabel,
  className = '',
}) => {
  const variantStyles = {
    default: '',
    accent:
      'border-y border-border',
    gradient: 'border-t border-border',
  };

  const variantInline: React.CSSProperties =
    variant === 'accent'
      ? { backgroundColor: 'var(--ds-primary-light)' }
      : variant === 'gradient'
        ? { background: `linear-gradient(to bottom, var(--ds-primary-light), transparent)` }
        : { backgroundColor: 'var(--ds-bg)' };

  return (
    <div
      className={`py-14 sm:py-20 px-4 ${variantStyles[variant]} ${className}`}
      style={variantInline}
    >
      <div className="max-w-3xl mx-auto text-center space-y-4">
        {stepNumber != null && (
          <div className="flex items-center justify-center gap-3 mb-2">
            <div className="h-px flex-1 max-w-[60px]" style={{ backgroundColor: 'var(--ds-border)' }} />
            <span
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest"
              style={{
                backgroundColor: 'var(--ds-primary-light)',
                color: 'var(--ds-primary)',
              }}
            >
              Step {stepNumber}
              {stepLabel && <span className="font-semibold">&mdash; {stepLabel}</span>}
            </span>
            <div className="h-px flex-1 max-w-[60px]" style={{ backgroundColor: 'var(--ds-border)' }} />
          </div>
        )}

        <p
          className="text-xl sm:text-2xl md:text-3xl leading-relaxed font-light"
          style={{ color: 'var(--ds-body)' }}
        >
          {text}
        </p>
      </div>
    </div>
  );
};

export default SectionBridge;
