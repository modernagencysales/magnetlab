/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';

const mockPathname = jest.fn().mockReturnValue('/settings/account');
jest.mock('next/navigation', () => ({
  usePathname: () => mockPathname(),
}));

import { SettingsNav } from '@/components/settings/SettingsNav';

describe('SettingsNav', () => {
  beforeEach(() => {
    mockPathname.mockReturnValue('/settings/account');
  });

  it('renders all 5 section group headers', () => {
    render(<SettingsNav />);
    // Each group appears in both desktop heading and mobile pill
    expect(screen.getAllByText('Account').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('Integrations').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('Signal Engine').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('Branding').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('Developer').length).toBeGreaterThanOrEqual(2);
  });

  it('renders correct hrefs for nav items', () => {
    render(<SettingsNav />);
    // Check one item per group
    const profileLinks = screen.getAllByRole('link', { name: /Profile/i });
    expect(profileLinks[0]).toHaveAttribute('href', '/settings/account');

    const linkedinLinks = screen.getAllByRole('link', { name: /^LinkedIn$/i });
    expect(linkedinLinks[0]).toHaveAttribute('href', '/settings/integrations');

    const icpLinks = screen.getAllByRole('link', { name: /ICP Config/i });
    expect(icpLinks[0]).toHaveAttribute('href', '/settings/signals');

    const brandLinks = screen.getAllByRole('link', { name: /Brand & Theme/i });
    expect(brandLinks[0]).toHaveAttribute('href', '/settings/branding');

    const apiLinks = screen.getAllByRole('link', { name: /API Keys/i });
    expect(apiLinks[0]).toHaveAttribute('href', '/settings/developer');
  });

  it('highlights active section based on pathname', () => {
    mockPathname.mockReturnValue('/settings/integrations');
    render(<SettingsNav />);
    // Desktop sidebar: LinkedIn link should have active class
    const linkedinLinks = screen.getAllByRole('link', { name: /^LinkedIn$/i });
    expect(linkedinLinks[0].className).toContain('text-primary');
  });

  it('does not highlight inactive sections', () => {
    mockPathname.mockReturnValue('/settings/account');
    render(<SettingsNav />);
    // Developer links should be inactive
    const apiLinks = screen.getAllByRole('link', { name: /API Keys/i });
    expect(apiLinks[0].className).toContain('text-muted-foreground');
  });

  it('renders mobile pill bar with group names', () => {
    render(<SettingsNav />);
    // Mobile nav renders group titles as links too
    // Count "Account" appearances: 1 in desktop heading + 1 in mobile pill
    const accountElements = screen.getAllByText('Account');
    expect(accountElements.length).toBeGreaterThanOrEqual(2);
  });
});
