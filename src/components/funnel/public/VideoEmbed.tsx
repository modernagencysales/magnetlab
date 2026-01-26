'use client';

interface VideoEmbedProps {
  url: string;
}

export function VideoEmbed({ url }: VideoEmbedProps) {
  const embedUrl = getEmbedUrl(url);

  if (!embedUrl) {
    return null;
  }

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: '#18181B', border: '1px solid #27272A' }}
    >
      <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
        <iframe
          src={embedUrl}
          className="absolute inset-0 w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    </div>
  );
}

function getEmbedUrl(url: string): string | null {
  try {
    const parsed = new URL(url);

    // YouTube
    if (parsed.hostname.includes('youtube.com') || parsed.hostname.includes('youtu.be')) {
      let videoId: string | null = null;

      if (parsed.hostname.includes('youtu.be')) {
        videoId = parsed.pathname.slice(1);
      } else if (parsed.pathname.includes('/watch')) {
        videoId = parsed.searchParams.get('v');
      } else if (parsed.pathname.includes('/embed/')) {
        videoId = parsed.pathname.split('/embed/')[1];
      }

      if (videoId) {
        return `https://www.youtube.com/embed/${videoId}`;
      }
    }

    // Vimeo
    if (parsed.hostname.includes('vimeo.com')) {
      const match = parsed.pathname.match(/\/(\d+)/);
      if (match) {
        return `https://player.vimeo.com/video/${match[1]}`;
      }
    }

    // Loom
    if (parsed.hostname.includes('loom.com')) {
      const match = parsed.pathname.match(/\/share\/([a-zA-Z0-9]+)/);
      if (match) {
        return `https://www.loom.com/embed/${match[1]}`;
      }
    }

    // If already an embed URL, return as-is
    if (url.includes('/embed/') || url.includes('player.vimeo.com')) {
      return url;
    }

    return null;
  } catch {
    return null;
  }
}
