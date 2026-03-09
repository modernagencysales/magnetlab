import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { ThemeProvider, useTheme } from '../components/theme-provider';
import { Button } from '../components/button';
import { Sun, Moon, Monitor } from 'lucide-react';

const meta: Meta = {
  title: 'Layout/ThemeProvider',
};
export default meta;
type Story = StoryObj;

function ThemeToggleDemo() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button
          variant={theme === 'light' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setTheme('light')}
        >
          <Sun className="h-4 w-4" /> Light
        </Button>
        <Button
          variant={theme === 'dark' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setTheme('dark')}
        >
          <Moon className="h-4 w-4" /> Dark
        </Button>
        <Button
          variant={theme === 'system' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setTheme('system')}
        >
          <Monitor className="h-4 w-4" /> System
        </Button>
      </div>
      <div className="rounded-md border p-4 text-sm">
        <p>Current theme: <strong>{theme}</strong></p>
        <p>Resolved theme: <strong>{resolvedTheme}</strong></p>
      </div>
    </div>
  );
}

export const Default: Story = {
  render: () => (
    <ThemeProvider defaultTheme="light" storageKey="storybook-theme">
      <ThemeToggleDemo />
    </ThemeProvider>
  ),
};
