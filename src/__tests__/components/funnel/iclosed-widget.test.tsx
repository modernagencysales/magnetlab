/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render } from '@testing-library/react';

// Mock next/script to render as a regular element so we can inspect props
jest.mock('next/script', () => {
  return function MockScript(props: Record<string, unknown>) {
    return <script data-testid="iclosed-script" {...props} />;
  };
});

import { IClosedWidget } from '@/components/funnel/public/IClosedWidget';

describe('IClosedWidget', () => {
  it('renders script tag with valid widget ID', () => {
    const { getByTestId } = render(<IClosedWidget widgetId="WB1jQQR2OgMi" />);
    const script = getByTestId('iclosed-script');
    expect(script).toBeInTheDocument();
    expect(script).toHaveAttribute('data-cta-widget', 'WB1jQQR2OgMi');
    expect(script).toHaveAttribute('src', 'https://app.iclosed.io/assets/widget.js');
  });

  it('sanitizes widget ID - strips special characters', () => {
    const { getByTestId } = render(<IClosedWidget widgetId='abc<script>alert(1)</script>' />);
    const script = getByTestId('iclosed-script');
    expect(script).toHaveAttribute('data-cta-widget', 'abcscriptalert1script');
  });

  it('sanitizes widget ID - strips quotes and slashes', () => {
    const { getByTestId } = render(<IClosedWidget widgetId='abc";alert(1)//' />);
    const script = getByTestId('iclosed-script');
    expect(script).toHaveAttribute('data-cta-widget', 'abcalert1');
  });

  it('allows hyphens in widget ID', () => {
    const { getByTestId } = render(<IClosedWidget widgetId="my-widget-id" />);
    const script = getByTestId('iclosed-script');
    expect(script).toHaveAttribute('data-cta-widget', 'my-widget-id');
  });

  it('renders nothing for empty widget ID after sanitization', () => {
    const { container } = render(<IClosedWidget widgetId="<>!@#$%^&*()" />);
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing for empty string widget ID', () => {
    const { container } = render(<IClosedWidget widgetId="" />);
    expect(container.innerHTML).toBe('');
  });

  it('uses afterInteractive strategy', () => {
    const { getByTestId } = render(<IClosedWidget widgetId="test123" />);
    const script = getByTestId('iclosed-script');
    expect(script).toHaveAttribute('strategy', 'afterInteractive');
  });
});
