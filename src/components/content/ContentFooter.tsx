'use client';

interface ContentFooterProps {
  isDark: boolean;
  hideBranding?: boolean;
}

export function ContentFooter({ isDark, hideBranding }: ContentFooterProps) {
  if (hideBranding) return null;

  const mutedColor = isDark ? '#71717A' : '#A1A1AA';

  return (
    <footer
      style={{
        textAlign: 'center',
        padding: '2rem 0',
        marginTop: '3rem',
      }}
    >
      <a
        href="https://magnetlab.app"
        target="_blank"
        rel="noopener noreferrer"
        style={{
          fontSize: '0.75rem',
          color: mutedColor,
          textDecoration: 'none',
        }}
      >
        Powered by MagnetLab
      </a>
    </footer>
  );
}
