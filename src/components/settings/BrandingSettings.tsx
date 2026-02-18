'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  Upload,
  Plus,
  X,
  Type,
  Palette,
  Image as ImageIcon,
  MessageSquareQuote,
  ListOrdered,
  ChevronDown,
  Loader2,
  Check,
} from 'lucide-react';

const GOOGLE_FONTS = [
  'Inter', 'DM Sans', 'Poppins', 'Lato', 'Montserrat', 'Open Sans',
  'Raleway', 'Playfair Display', 'Roboto', 'Nunito', 'Source Sans 3',
  'Work Sans', 'Outfit', 'Plus Jakarta Sans', 'Space Grotesk',
  'Manrope', 'Sora', 'Lexend', 'Figtree', 'Geist',
];

interface LogoItem {
  name: string;
  imageUrl: string;
}

interface TestimonialData {
  quote: string;
  author?: string;
  role?: string;
  result?: string;
}

interface StepItem {
  title: string;
  description: string;
}

interface StepsData {
  heading?: string;
  steps: StepItem[];
}

interface BrandingSettingsProps {
  initialData: {
    logos?: LogoItem[];
    default_testimonial?: TestimonialData | null;
    default_steps?: StepsData | null;
    default_theme?: string | null;
    default_primary_color?: string | null;
    default_background_style?: string | null;
    logo_url?: string | null;
    font_family?: string | null;
    font_url?: string | null;
  };
}

export function BrandingSettings({ initialData }: BrandingSettingsProps) {
  // State
  const [logoUrl, setLogoUrl] = useState(initialData.logo_url || '');
  const [logos, setLogos] = useState<LogoItem[]>(initialData.logos || []);
  const [theme, setTheme] = useState(initialData.default_theme || 'dark');
  const [primaryColor, setPrimaryColor] = useState(initialData.default_primary_color || '#7c3aed');
  const [backgroundStyle, setBackgroundStyle] = useState(initialData.default_background_style || 'solid');
  const [fontFamily, setFontFamily] = useState(initialData.font_family || '');
  const [fontUrl, setFontUrl] = useState(initialData.font_url || '');
  const [testimonial, setTestimonial] = useState<TestimonialData>(
    initialData.default_testimonial || { quote: '' }
  );
  const [stepsData, setStepsData] = useState<StepsData>(
    initialData.default_steps || { heading: '', steps: [] }
  );

  // Collapsible card state
  const [openCards, setOpenCards] = useState<Record<string, boolean>>({
    logo: true,
    theme: false,
    font: false,
    testimonial: false,
    steps: false,
  });

  // Save state
  const saveTimeout = useRef<NodeJS.Timeout>();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);

  // File input refs
  const mainLogoInputRef = useRef<HTMLInputElement>(null);
  const barLogoInputRef = useRef<HTMLInputElement>(null);
  const fontInputRef = useRef<HTMLInputElement>(null);

  const toggleCard = (key: string) => {
    setOpenCards((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const saveBranding = useCallback((updates: Record<string, unknown>) => {
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(async () => {
      setSaving(true);
      setSaved(false);
      try {
        await fetch('/api/brand-kit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        });
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } catch {
        /* ignore */
      } finally {
        setSaving(false);
      }
    }, 1000);
  }, []);

  const uploadFile = useCallback(
    async (file: File, type: 'logo' | 'font'): Promise<string | null> => {
      setUploading(type);
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('type', type);

        const res = await fetch('/api/brand-kit/upload', {
          method: 'POST',
          body: formData,
        });

        if (!res.ok) return null;
        const data = await res.json();
        return data.url || null;
      } catch {
        return null;
      } finally {
        setUploading(null);
      }
    },
    []
  );

  // Inject Google Font link for preview
  useEffect(() => {
    if (fontFamily && !fontUrl && GOOGLE_FONTS.includes(fontFamily)) {
      const linkId = 'branding-font-preview';
      let link = document.getElementById(linkId) as HTMLLinkElement | null;
      const href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontFamily)}:wght@400;600;700&display=swap`;
      if (!link) {
        link = document.createElement('link');
        link.id = linkId;
        link.rel = 'stylesheet';
        document.head.appendChild(link);
      }
      link.href = href;
    }
  }, [fontFamily, fontUrl]);

  // Handlers
  const handleMainLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await uploadFile(file, 'logo');
    if (url) {
      setLogoUrl(url);
      saveBranding({ logoUrl: url });
    }
    e.target.value = '';
  };

  const handleBarLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await uploadFile(file, 'logo');
    if (url) {
      const newLogos = [...logos, { name: file.name.replace(/\.[^.]+$/, ''), imageUrl: url }];
      setLogos(newLogos);
      saveBranding({ logos: newLogos });
    }
    e.target.value = '';
  };

  const handleRemoveBarLogo = (index: number) => {
    const newLogos = logos.filter((_, i) => i !== index);
    setLogos(newLogos);
    saveBranding({ logos: newLogos });
  };

  const handleFontUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await uploadFile(file, 'font');
    if (url) {
      setFontUrl(url);
      setFontFamily(file.name.replace(/\.[^.]+$/, ''));
      saveBranding({ fontUrl: url, fontFamily: file.name.replace(/\.[^.]+$/, '') });
    }
    e.target.value = '';
  };

  const handleRemoveCustomFont = () => {
    setFontUrl('');
    setFontFamily('');
    saveBranding({ fontUrl: null, fontFamily: null });
  };

  const handleThemeSelect = (t: string) => {
    setTheme(t);
    saveBranding({ defaultTheme: t });
  };

  const handlePrimaryColorChange = (color: string) => {
    setPrimaryColor(color);
    saveBranding({ defaultPrimaryColor: color });
  };

  const handleBackgroundStyleChange = (style: string) => {
    setBackgroundStyle(style);
    saveBranding({ defaultBackgroundStyle: style });
  };

  const handleFontFamilyChange = (family: string) => {
    setFontFamily(family);
    setFontUrl('');
    saveBranding({ fontFamily: family || null, fontUrl: null });
  };

  const handleTestimonialChange = (field: keyof TestimonialData, value: string) => {
    const updated = { ...testimonial, [field]: value };
    setTestimonial(updated);
    saveBranding({ defaultTestimonial: updated });
  };

  const handleStepsHeadingChange = (heading: string) => {
    const updated = { ...stepsData, heading };
    setStepsData(updated);
    saveBranding({ defaultSteps: updated });
  };

  const handleStepChange = (index: number, field: keyof StepItem, value: string) => {
    const newSteps = [...stepsData.steps];
    newSteps[index] = { ...newSteps[index], [field]: value };
    const updated = { ...stepsData, steps: newSteps };
    setStepsData(updated);
    saveBranding({ defaultSteps: updated });
  };

  const handleAddStep = () => {
    const updated = { ...stepsData, steps: [...stepsData.steps, { title: '', description: '' }] };
    setStepsData(updated);
    saveBranding({ defaultSteps: updated });
  };

  const handleRemoveStep = (index: number) => {
    const newSteps = stepsData.steps.filter((_, i) => i !== index);
    const updated = { ...stepsData, steps: newSteps };
    setStepsData(updated);
    saveBranding({ defaultSteps: updated });
  };

  // Saved indicator
  const SaveIndicator = () => (
    <span className="flex items-center gap-1 text-xs">
      {saving && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
      {saved && (
        <span className="flex items-center gap-1 text-green-600">
          <Check className="h-3 w-3" />
          Saved
        </span>
      )}
    </span>
  );

  // Collapsible card header
  const CardHeader = ({
    icon,
    title,
    cardKey,
  }: {
    icon: React.ReactNode;
    title: string;
    cardKey: string;
  }) => (
    <button
      type="button"
      onClick={() => toggleCard(cardKey)}
      className="flex w-full items-center justify-between"
    >
      <div className="flex items-center gap-3">
        <span className="text-primary">{icon}</span>
        <h3 className="text-lg font-semibold">{title}</h3>
      </div>
      <div className="flex items-center gap-2">
        <SaveIndicator />
        <ChevronDown
          className={`h-5 w-5 text-muted-foreground transition-transform ${
            openCards[cardKey] ? 'rotate-180' : ''
          }`}
        />
      </div>
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h2 className="text-lg font-semibold">Branding & Defaults</h2>
          <p className="text-sm text-muted-foreground">
            Configure visual defaults for your funnel pages and lead magnets.
          </p>
        </div>
      </div>

      {/* Card 1: Logo & Identity */}
      <div className="rounded-lg border bg-card p-6">
        <CardHeader
          icon={<ImageIcon className="h-5 w-5" />}
          title="Logo & Identity"
          cardKey="logo"
        />
        {openCards.logo && (
          <div className="mt-6 space-y-6">
            {/* Main Logo */}
            <div>
              <p className="mb-2 text-sm font-medium">Main Logo</p>
              <input
                ref={mainLogoInputRef}
                type="file"
                accept="image/*"
                onChange={handleMainLogoUpload}
                className="hidden"
              />
              {logoUrl ? (
                <div className="flex items-center gap-4">
                  <div className="relative h-16 w-32 rounded-lg border bg-muted/50 p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={logoUrl}
                      alt="Logo"
                      className="h-full w-full object-contain"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => mainLogoInputRef.current?.click()}
                    disabled={uploading === 'logo'}
                    className="rounded-lg border px-3 py-2 text-sm hover:bg-muted transition-colors"
                  >
                    {uploading === 'logo' ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Replace'
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setLogoUrl('');
                      saveBranding({ logoUrl: null });
                    }}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => mainLogoInputRef.current?.click()}
                  disabled={uploading === 'logo'}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border px-4 py-8 text-sm text-muted-foreground hover:border-primary/50 hover:bg-muted/50 transition-colors"
                >
                  {uploading === 'logo' ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <>
                      <Upload className="h-5 w-5" />
                      <span>Click or drag to upload your logo</span>
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Logo Bar */}
            <div>
              <p className="mb-2 text-sm font-medium">Logo Bar</p>
              <p className="mb-3 text-xs text-muted-foreground">
                Add client or partner logos to display on your funnel pages.
              </p>
              <input
                ref={barLogoInputRef}
                type="file"
                accept="image/*"
                onChange={handleBarLogoUpload}
                className="hidden"
              />
              {logos.length > 0 && (
                <div className="mb-3 space-y-2">
                  {logos.map((logo, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-3 rounded-lg border px-3 py-2"
                    >
                      <div className="h-8 w-12 flex-shrink-0 rounded bg-muted/50 p-1">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={logo.imageUrl}
                          alt={logo.name}
                          className="h-full w-full object-contain"
                        />
                      </div>
                      <span className="flex-1 truncate text-sm">{logo.name}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveBarLogo(index)}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <button
                type="button"
                onClick={() => barLogoInputRef.current?.click()}
                disabled={uploading === 'logo'}
                className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-muted transition-colors"
              >
                {uploading === 'logo' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    Add Logo
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Card 2: Theme & Colors */}
      <div className="rounded-lg border bg-card p-6">
        <CardHeader
          icon={<Palette className="h-5 w-5" />}
          title="Theme & Colors"
          cardKey="theme"
        />
        {openCards.theme && (
          <div className="mt-6 space-y-6">
            {/* Theme selection */}
            <div>
              <p className="mb-3 text-sm font-medium">Theme</p>
              <div className="grid grid-cols-3 gap-3">
                {(['dark', 'light', 'custom'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => handleThemeSelect(t)}
                    className={`rounded-lg border-2 p-4 text-center text-sm font-medium capitalize transition-all ${
                      theme === t
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-muted-foreground/50'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Primary color */}
            <div>
              <p className="mb-2 text-sm font-medium">Primary Color</p>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => handlePrimaryColorChange(e.target.value)}
                  className="h-10 w-10 cursor-pointer rounded-lg border border-border bg-background"
                />
                <input
                  type="text"
                  value={primaryColor}
                  onChange={(e) => handlePrimaryColorChange(e.target.value)}
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm w-32 font-mono"
                  maxLength={7}
                />
              </div>
            </div>

            {/* Background style */}
            <div>
              <p className="mb-2 text-sm font-medium">Background Style</p>
              <div className="flex gap-2">
                {(['solid', 'gradient', 'pattern'] as const).map((style) => (
                  <button
                    key={style}
                    type="button"
                    onClick={() => handleBackgroundStyleChange(style)}
                    className={`rounded-lg border px-4 py-2 text-sm capitalize transition-all ${
                      backgroundStyle === style
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-border hover:bg-muted'
                    }`}
                  >
                    {style}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Card 3: Font */}
      <div className="rounded-lg border bg-card p-6">
        <CardHeader icon={<Type className="h-5 w-5" />} title="Font" cardKey="font" />
        {openCards.font && (
          <div className="mt-6 space-y-4">
            <div>
              <p className="mb-2 text-sm font-medium">Font Family</p>
              <select
                value={fontUrl ? '__custom__' : fontFamily}
                onChange={(e) => {
                  if (e.target.value === '__custom__') return;
                  handleFontFamilyChange(e.target.value);
                }}
                disabled={!!fontUrl}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm w-full"
              >
                <option value="">System Default</option>
                {GOOGLE_FONTS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
                {fontUrl && <option value="__custom__">Custom Font</option>}
              </select>
            </div>

            {/* Custom font upload */}
            <div>
              <p className="mb-2 text-sm font-medium">Or upload custom font (.woff2)</p>
              <input
                ref={fontInputRef}
                type="file"
                accept=".woff2"
                onChange={handleFontUpload}
                className="hidden"
              />
              {fontUrl ? (
                <div className="flex items-center gap-3 rounded-lg border px-3 py-2">
                  <Type className="h-4 w-4 text-muted-foreground" />
                  <span className="flex-1 truncate text-sm">{fontFamily || 'Custom font'}</span>
                  <button
                    type="button"
                    onClick={handleRemoveCustomFont}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fontInputRef.current?.click()}
                  disabled={uploading === 'font'}
                  className="flex items-center gap-2 rounded-lg border-2 border-dashed border-border px-4 py-4 text-sm text-muted-foreground hover:border-primary/50 hover:bg-muted/50 transition-colors w-full justify-center"
                >
                  {uploading === 'font' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      <span>Upload .woff2 file</span>
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Font preview */}
            <div className="rounded-lg border bg-muted/30 p-4">
              <p className="mb-1 text-xs text-muted-foreground">Preview</p>
              <p
                className="text-lg"
                style={{
                  fontFamily: fontUrl
                    ? undefined
                    : fontFamily
                      ? `"${fontFamily}", sans-serif`
                      : undefined,
                }}
              >
                The quick brown fox jumps over the lazy dog
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Card 4: Default Testimonial */}
      <div className="rounded-lg border bg-card p-6">
        <CardHeader
          icon={<MessageSquareQuote className="h-5 w-5" />}
          title="Default Testimonial"
          cardKey="testimonial"
        />
        {openCards.testimonial && (
          <div className="mt-6 space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Quote</label>
              <textarea
                rows={3}
                value={testimonial.quote}
                onChange={(e) => handleTestimonialChange('quote', e.target.value)}
                placeholder="What your client said about working with you..."
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm w-full resize-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Author</label>
              <input
                type="text"
                value={testimonial.author || ''}
                onChange={(e) => handleTestimonialChange('author', e.target.value)}
                placeholder="Jane Smith"
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm w-full"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Role</label>
              <input
                type="text"
                value={testimonial.role || ''}
                onChange={(e) => handleTestimonialChange('role', e.target.value)}
                placeholder="CEO at Acme Inc."
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm w-full"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Result</label>
              <input
                type="text"
                value={testimonial.result || ''}
                onChange={(e) => handleTestimonialChange('result', e.target.value)}
                placeholder="2x revenue in 90 days"
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm w-full"
              />
            </div>
          </div>
        )}
      </div>

      {/* Card 5: Default Next Steps */}
      <div className="rounded-lg border bg-card p-6">
        <CardHeader
          icon={<ListOrdered className="h-5 w-5" />}
          title="Default Next Steps"
          cardKey="steps"
        />
        {openCards.steps && (
          <div className="mt-6 space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Heading</label>
              <input
                type="text"
                value={stepsData.heading || ''}
                onChange={(e) => handleStepsHeadingChange(e.target.value)}
                placeholder="What Happens Next"
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm w-full"
              />
            </div>

            {stepsData.steps.length > 0 && (
              <div className="space-y-3">
                {stepsData.steps.map((step, index) => (
                  <div key={index} className="flex gap-3 rounded-lg border p-3">
                    <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                      {index + 1}
                    </div>
                    <div className="flex-1 space-y-2">
                      <input
                        type="text"
                        value={step.title}
                        onChange={(e) => handleStepChange(index, 'title', e.target.value)}
                        placeholder="Step title"
                        className="rounded-lg border border-border bg-background px-3 py-2 text-sm w-full"
                      />
                      <input
                        type="text"
                        value={step.description}
                        onChange={(e) => handleStepChange(index, 'description', e.target.value)}
                        placeholder="Step description"
                        className="rounded-lg border border-border bg-background px-3 py-2 text-sm w-full"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveStep(index)}
                      className="mt-1 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={handleAddStep}
              className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-muted transition-colors"
            >
              <Plus className="h-4 w-4" />
              Add Step
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
