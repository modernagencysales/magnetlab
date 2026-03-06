import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import {
  accent,
  backgrounds,
  borders,
  text,
  status,
  tagColors,
  avatarColors,
  chartColors,
  fontFamily,
  fontSize,
  fontWeight,
  typographyRoles,
  heights,
  widths,
  radius,
  shadows,
  transitions,
  iconSize,
} from '../tokens';

// ─── Colors ─────────────────────────────────────────────────────────────────

function Swatch({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className="h-12 w-12 rounded-lg border border-border"
        style={{ backgroundColor: color }}
      />
      <span className="text-2xs text-muted-foreground">{label}</span>
      <span className="text-2xs font-mono text-muted-foreground/60">{color}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {children}
    </div>
  );
}

function ColorTokens() {
  return (
    <div className="space-y-8 p-6 max-w-4xl">
      <h2 className="text-xl font-semibold text-foreground">Color Tokens</h2>

      <Section title="Accent">
        <div className="flex flex-wrap gap-4">
          <Swatch color={accent.light} label="Light" />
          <Swatch color={accent.lightHover} label="Light Hover" />
          <Swatch color={accent.lightSubtle} label="Light Subtle" />
          <Swatch color={accent.dark} label="Dark" />
          <Swatch color={accent.darkHover} label="Dark Hover" />
          <Swatch color={accent.darkSubtle} label="Dark Subtle" />
        </div>
      </Section>

      <Section title="Backgrounds (Light)">
        <div className="flex flex-wrap gap-4">
          {Object.entries(backgrounds.light).map(([key, val]) => (
            <Swatch key={key} color={val} label={key} />
          ))}
        </div>
      </Section>

      <Section title="Backgrounds (Dark)">
        <div className="flex flex-wrap gap-4">
          {Object.entries(backgrounds.dark).map(([key, val]) => (
            <Swatch key={key} color={val} label={key} />
          ))}
        </div>
      </Section>

      <Section title="Borders (Light / Dark)">
        <div className="flex flex-wrap gap-4">
          {Object.entries(borders.light).map(([key, val]) => (
            <Swatch key={key} color={val} label={`Light ${key}`} />
          ))}
          {Object.entries(borders.dark).map(([key, val]) => (
            <Swatch key={key} color={val} label={`Dark ${key}`} />
          ))}
        </div>
      </Section>

      <Section title="Text (Light / Dark)">
        <div className="flex flex-wrap gap-4">
          {Object.entries(text.light).map(([key, val]) => (
            <Swatch key={key} color={val} label={`Light ${key}`} />
          ))}
          {Object.entries(text.dark).map(([key, val]) => (
            <Swatch key={key} color={val} label={`Dark ${key}`} />
          ))}
        </div>
      </Section>

      <Section title="Status Colors">
        <div className="flex flex-wrap gap-4">
          {Object.entries(status).map(([key, val]) => (
            <React.Fragment key={key}>
              <Swatch color={val.light} label={`${key} (light)`} />
              <Swatch color={val.dark} label={`${key} (dark)`} />
            </React.Fragment>
          ))}
        </div>
      </Section>

      <Section title="Tag Colors">
        <div className="flex flex-wrap gap-4">
          {Object.entries(tagColors).map(([key, val]) => (
            <div key={key} className="flex flex-col items-center gap-1">
              <div className="flex gap-1">
                <div
                  className="h-8 w-8 rounded-md border border-border"
                  style={{ backgroundColor: val.bg.light }}
                />
                <div
                  className="h-8 w-8 rounded-md border border-border"
                  style={{ backgroundColor: val.text.light }}
                />
                <div
                  className="h-8 w-8 rounded-md border border-border"
                  style={{ backgroundColor: val.dot }}
                />
              </div>
              <span className="text-2xs text-muted-foreground">{key}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Avatar Colors">
        <div className="flex flex-wrap gap-4">
          {avatarColors.map((color, i) => (
            <Swatch key={i} color={color} label={`avatar-${i + 1}`} />
          ))}
        </div>
      </Section>

      <Section title="Chart Colors (Light)">
        <div className="flex flex-wrap gap-4">
          {Object.entries(chartColors.light).map(([key, val]) => (
            <Swatch key={key} color={val} label={`chart-${key}`} />
          ))}
        </div>
      </Section>
    </div>
  );
}

// ─── Typography ─────────────────────────────────────────────────────────────

function TypographyTokens() {
  return (
    <div className="space-y-8 p-6 max-w-4xl">
      <h2 className="text-xl font-semibold text-foreground">Typography Tokens</h2>

      <Section title="Font Family">
        <p className="text-sm text-muted-foreground font-mono">{fontFamily.sans.join(', ')}</p>
      </Section>

      <Section title="Font Sizes">
        <div className="space-y-3">
          {Object.entries(fontSize).map(([key, val]) => (
            <div key={key} className="flex items-baseline gap-4">
              <span className="w-12 text-xs font-mono text-muted-foreground">{key}</span>
              <span style={{ fontSize: val.size, lineHeight: val.lineHeight }} className="text-foreground">
                The quick brown fox ({val.size})
              </span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Font Weights">
        <div className="space-y-2">
          {Object.entries(fontWeight).map(([key, val]) => (
            <div key={key} className="flex items-baseline gap-4">
              <span className="w-20 text-xs font-mono text-muted-foreground">{key}</span>
              <span style={{ fontWeight: val }} className="text-sm text-foreground">
                The quick brown fox ({val})
              </span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Typography Roles">
        <div className="space-y-3">
          {Object.entries(typographyRoles).map(([key, role]) => {
            const sizeVal = fontSize[role.size as keyof typeof fontSize];
            return (
              <div key={key} className="flex items-baseline gap-4">
                <span className="w-32 shrink-0 text-xs font-mono text-muted-foreground">{key}</span>
                <span
                  style={{
                    fontSize: sizeVal?.size,
                    lineHeight: sizeVal?.lineHeight,
                    fontWeight: fontWeight[role.weight as keyof typeof fontWeight],
                    letterSpacing: role.letterSpacing,
                    textTransform: (role as any).textTransform,
                  }}
                  className="text-foreground"
                >
                  The quick brown fox
                </span>
                <span className="text-2xs font-mono text-muted-foreground/60">
                  {sizeVal?.size} / {role.weight} / {role.letterSpacing}
                </span>
              </div>
            );
          })}
        </div>
      </Section>
    </div>
  );
}

// ─── Spacing ────────────────────────────────────────────────────────────────

function SpacingTokens() {
  return (
    <div className="space-y-8 p-6 max-w-4xl">
      <h2 className="text-xl font-semibold text-foreground">Spacing & Layout Tokens</h2>

      <Section title="Component Heights">
        <div className="space-y-2">
          {Object.entries(heights).map(([key, val]) => (
            <div key={key} className="flex items-center gap-4">
              <span className="w-28 text-xs font-mono text-muted-foreground">{key}</span>
              <div
                className="bg-primary/20 rounded-sm"
                style={{ width: `${val * 2}px`, height: `${val}px` }}
              />
              <span className="text-2xs text-muted-foreground">{val}px</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Component Widths">
        <div className="space-y-2">
          {Object.entries(widths).map(([key, val]) => (
            <div key={key} className="flex items-center gap-4">
              <span className="w-40 shrink-0 text-xs font-mono text-muted-foreground">{key}</span>
              <div
                className="h-4 bg-primary/20 rounded-sm"
                style={{ width: `${Math.min(val, 400)}px` }}
              />
              <span className="text-2xs text-muted-foreground">{val}px</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Border Radius">
        <div className="flex flex-wrap gap-4">
          {Object.entries(radius).map(([key, val]) => (
            <div key={key} className="flex flex-col items-center gap-1">
              <div
                className="h-16 w-16 bg-primary/20 border border-border"
                style={{ borderRadius: val }}
              />
              <span className="text-2xs text-muted-foreground">{key}</span>
              <span className="text-2xs font-mono text-muted-foreground/60">{val}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Shadows">
        <div className="flex flex-wrap gap-6">
          {Object.entries(shadows).map(([key, val]) => (
            <div key={key} className="flex flex-col items-center gap-2">
              <div
                className="h-16 w-24 rounded-lg bg-card"
                style={{ boxShadow: val }}
              />
              <span className="text-2xs text-muted-foreground">{key}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Icon Sizes">
        <div className="flex flex-wrap gap-6">
          {Object.entries(iconSize).map(([key, val]) => (
            <div key={key} className="flex flex-col items-center gap-1">
              <div
                className="bg-muted-foreground rounded-sm"
                style={{ width: val, height: val }}
              />
              <span className="text-2xs text-muted-foreground">{key} ({val}px)</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Transitions">
        <div className="space-y-2">
          {Object.entries(transitions).map(([key, val]) => (
            <div key={key} className="flex items-center gap-4">
              <span className="w-20 text-xs font-mono text-muted-foreground">{key}</span>
              <span className="text-sm text-foreground">{val}</span>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

// ─── Meta & Exports ─────────────────────────────────────────────────────────

const meta: Meta = {
  title: 'Tokens',
  parameters: { layout: 'fullscreen' },
};
export default meta;

export const Colors: StoryObj = {
  render: () => <ColorTokens />,
};

export const Typography: StoryObj = {
  render: () => <TypographyTokens />,
};

export const Spacing: StoryObj = {
  render: () => <SpacingTokens />,
};
