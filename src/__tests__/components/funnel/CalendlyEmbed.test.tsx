/**
 * @jest-environment jsdom
 */

import { render, screen } from '@testing-library/react';
import { CalendlyEmbed } from '@/components/funnel/public/CalendlyEmbed';

describe('CalendlyEmbed', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Clean up any scripts added to the document
    document.querySelectorAll('script').forEach((s) => s.remove());
  });

  describe('iClosed URLs', () => {
    it('should render iclosed-widget div with correct data-url for iclosed.io URLs', () => {
      const url = 'https://app.iclosed.io/e/timkeen/test';
      const { container } = render(<CalendlyEmbed url={url} />);

      const widget = container.querySelector('.iclosed-widget');
      expect(widget).toBeInTheDocument();
      expect(widget).toHaveAttribute('data-url', url);
      expect(widget).toHaveAttribute('title', 'Book a Call');
    });

    it('should render iclosed-widget div for iclosed.com URLs', () => {
      const url = 'https://app.iclosed.com/e/someone/meeting';
      const { container } = render(<CalendlyEmbed url={url} />);

      const widget = container.querySelector('.iclosed-widget');
      expect(widget).toBeInTheDocument();
      expect(widget).toHaveAttribute('data-url', url);
    });

    it('should have correct dimensions on the iclosed widget', () => {
      const url = 'https://app.iclosed.io/e/timkeen/test';
      const { container } = render(<CalendlyEmbed url={url} />);

      const widget = container.querySelector('.iclosed-widget') as HTMLElement;
      expect(widget.style.width).toBe('100%');
      expect(widget.style.height).toBe('620px');
    });

    it('should load the iClosed widget script', () => {
      const url = 'https://app.iclosed.io/e/timkeen/test';
      render(<CalendlyEmbed url={url} />);

      const script = document.querySelector(
        'script[src="https://app.iclosed.io/assets/widget.js"]'
      );
      expect(script).toBeInTheDocument();
      expect((script as HTMLScriptElement).async).toBe(true);
    });

    it('should not render an iframe for iClosed URLs', () => {
      const url = 'https://app.iclosed.io/e/timkeen/test';
      render(<CalendlyEmbed url={url} />);

      expect(screen.queryByTitle('Book a Call')).not.toBeInstanceOf(HTMLIFrameElement);
    });
  });

  describe('Cal.com URLs', () => {
    it('should render an iframe for cal.com URLs', () => {
      const url = 'https://cal.com/someone/meeting';
      render(<CalendlyEmbed url={url} />);

      const iframe = screen.getByTitle('Book a Call');
      expect(iframe.tagName).toBe('IFRAME');
      expect(iframe).toHaveAttribute(
        'src',
        expect.stringContaining('cal.com/someone/meeting')
      );
    });

    it('should add embed parameters to cal.com URLs', () => {
      const url = 'https://cal.com/someone/meeting';
      render(<CalendlyEmbed url={url} />);

      const iframe = screen.getByTitle('Book a Call');
      expect(iframe).toHaveAttribute(
        'src',
        expect.stringContaining('embed=true')
      );
      expect(iframe).toHaveAttribute(
        'src',
        expect.stringContaining('theme=dark')
      );
    });

    it('should not render iclosed-widget for cal.com URLs', () => {
      const url = 'https://cal.com/someone/meeting';
      const { container } = render(<CalendlyEmbed url={url} />);

      expect(container.querySelector('.iclosed-widget')).not.toBeInTheDocument();
    });
  });

  describe('Calendly URLs', () => {
    it('should render calendly-inline-widget div for calendly.com URLs', () => {
      const url = 'https://calendly.com/someone/30min';
      const { container } = render(<CalendlyEmbed url={url} />);

      const widget = container.querySelector('.calendly-inline-widget');
      expect(widget).toBeInTheDocument();
      expect(widget).toHaveAttribute(
        'data-url',
        expect.stringContaining('calendly.com/someone/30min')
      );
    });

    it('should load the Calendly widget script', () => {
      const url = 'https://calendly.com/someone/30min';
      render(<CalendlyEmbed url={url} />);

      const script = document.querySelector(
        'script[src="https://assets.calendly.com/assets/external/widget.js"]'
      );
      expect(script).toBeInTheDocument();
    });

    it('should not render an iframe for Calendly URLs', () => {
      const url = 'https://calendly.com/someone/30min';
      const { container } = render(<CalendlyEmbed url={url} />);

      expect(container.querySelector('iframe')).not.toBeInTheDocument();
    });

    it('should not render iclosed-widget for Calendly URLs', () => {
      const url = 'https://calendly.com/someone/30min';
      const { container } = render(<CalendlyEmbed url={url} />);

      expect(container.querySelector('.iclosed-widget')).not.toBeInTheDocument();
    });
  });

  describe('Unknown URLs', () => {
    it('should render a fallback iframe for unknown booking URLs', () => {
      const url = 'https://some-other-booking.com/meeting';
      render(<CalendlyEmbed url={url} />);

      const iframe = screen.getByTitle('Booking Calendar');
      expect(iframe.tagName).toBe('IFRAME');
      expect(iframe).toHaveAttribute('src', url);
    });
  });
});
