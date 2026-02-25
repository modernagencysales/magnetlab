import React from 'react';

interface LogoBarLogo {
  name: string;
  imageUrl: string;
}

interface LogoBarProps {
  logos: LogoBarLogo[];
  className?: string;
}

const LogoBar: React.FC<LogoBarProps> = ({ logos, className = '' }) => {
  const validLogos = logos.filter((logo) => logo.imageUrl);
  if (validLogos.length === 0) return null;

  return (
    <div className={`py-8 ${className}`}>
      <p className="text-xs font-medium uppercase tracking-widest text-center mb-6"
         style={{ color: 'var(--ds-muted)' }}>
        Trusted by leaders at
      </p>
      <div className="flex flex-wrap items-center justify-center gap-8 sm:gap-10">
        {validLogos.map((logo, i) => (
          <div key={i} className="flex-shrink-0">
            <img
              src={logo.imageUrl}
              alt={logo.name}
              className="h-8 sm:h-10 w-auto object-contain opacity-60 grayscale hover:grayscale-0 hover:opacity-100 transition-all duration-200"
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default LogoBar;
