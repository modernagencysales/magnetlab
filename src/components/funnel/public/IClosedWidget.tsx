'use client';

import Script from 'next/script';

interface IClosedWidgetProps {
  widgetId: string;
}

export function IClosedWidget({ widgetId }: IClosedWidgetProps) {
  const sanitizedId = widgetId.replace(/[^a-zA-Z0-9-]/g, '');
  if (!sanitizedId) return null;

  return (
    <Script
      src="https://app.iclosed.io/assets/widget.js"
      data-cta-widget={sanitizedId}
      strategy="afterInteractive"
    />
  );
}
