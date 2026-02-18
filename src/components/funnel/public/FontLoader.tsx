'use client';

const GOOGLE_FONTS = [
  'Inter', 'DM Sans', 'Poppins', 'Lato', 'Montserrat', 'Open Sans',
  'Raleway', 'Playfair Display', 'Roboto', 'Nunito', 'Source Sans 3',
  'Work Sans', 'Outfit', 'Plus Jakarta Sans', 'Space Grotesk',
  'Manrope', 'Sora', 'Lexend', 'Figtree', 'Geist',
];

interface FontLoaderProps {
  fontFamily: string | null;
  fontUrl: string | null;
}

export function FontLoader({ fontFamily, fontUrl }: FontLoaderProps) {
  if (!fontFamily) return null;

  // Custom font via uploaded woff2
  if (fontUrl) {
    return (
      <style dangerouslySetInnerHTML={{ __html: `
        @font-face {
          font-family: '${fontFamily}';
          src: url('${fontUrl}') format('woff2');
          font-display: swap;
        }
      `}} />
    );
  }

  // Google Font
  if (GOOGLE_FONTS.includes(fontFamily)) {
    const encoded = encodeURIComponent(fontFamily);
    return (
      <link
        rel="stylesheet"
        href={`https://fonts.googleapis.com/css2?family=${encoded}:wght@400;500;600;700&display=swap`}
      />
    );
  }

  return null;
}

export function getFontStyle(fontFamily: string | null | undefined): React.CSSProperties {
  if (!fontFamily) return {};
  return { fontFamily: `'${fontFamily}', sans-serif` };
}
