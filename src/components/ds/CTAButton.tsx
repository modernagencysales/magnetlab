'use client';

import React, { useState } from 'react';
import { Calendar, ArrowRight } from 'lucide-react';

interface CTAButtonProps {
  text: string;
  onClick?: () => void;
  className?: string;
  icon?: 'calendar' | 'arrow' | 'none';
  variant?: 'primary' | 'secondary';
  size?: 'default' | 'large';
  subtext?: string;
  type?: 'button' | 'submit';
  disabled?: boolean;
  style?: React.CSSProperties;
  href?: string;
}

const CTAButton: React.FC<CTAButtonProps> = ({
  text,
  onClick,
  className = '',
  icon = 'calendar',
  variant = 'primary',
  size = 'default',
  subtext,
  type = 'button',
  disabled = false,
  style,
  href,
}) => {
  const [isHovered, setIsHovered] = useState(false);

  const baseStyles =
    'inline-flex flex-col items-center justify-center gap-0 font-medium rounded-lg transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-background';

  const sizeStyles = size === 'large' ? 'px-8 py-4 text-lg' : 'px-6 py-3 text-base';

  const secondaryStyles =
    'bg-muted hover:bg-muted/80 text-foreground border border-border hover:border-border';

  const IconComponent = icon === 'calendar' ? Calendar : icon === 'arrow' ? ArrowRight : null;

  const primaryStyle: React.CSSProperties =
    variant === 'primary'
      ? {
          backgroundColor: isHovered ? 'var(--ds-primary-hover)' : 'var(--ds-primary)',
          color: '#FFFFFF',
          boxShadow: `0 10px 15px -3px var(--ds-primary-light)`,
          ...style,
        }
      : { ...style };

  const content = (
    <>
      <span className="inline-flex items-center gap-2">
        <span>{text}</span>
        {IconComponent && <IconComponent className="w-4 h-4" />}
      </span>
      {subtext && <span className="block text-sm font-normal opacity-80 mt-1">{subtext}</span>}
    </>
  );

  const sharedProps = {
    onMouseEnter: () => setIsHovered(true),
    onMouseLeave: () => setIsHovered(false),
    className: `${baseStyles} ${sizeStyles} ${variant === 'secondary' ? secondaryStyles : ''} ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`,
    style: primaryStyle,
  };

  if (href) {
    return (
      <a href={href} {...sharedProps}>
        {content}
      </a>
    );
  }

  return (
    <button type={type} onClick={onClick} disabled={disabled} {...sharedProps}>
      {content}
    </button>
  );
};

export default CTAButton;
