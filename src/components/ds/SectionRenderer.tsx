/** SectionRenderer — Dispatches FunnelPageSection to the correct renderer component.
 * Passes variant + primaryColor to all section components. */
import React from 'react';
import type {
  FunnelPageSection,
  LogoBarConfig,
  StepsConfig,
  TestimonialConfig,
  MarketingBlockConfig,
  SectionBridgeConfig,
  HeroConfig,
  StatsBarConfig,
  FeatureGridConfig,
  SocialProofWallConfig,
} from '@/lib/types/funnel';
import LogoBar from './LogoBar';
import SimpleSteps from './SimpleSteps';
import TestimonialQuote from './TestimonialQuote';
import MarketingBlock from './MarketingBlock';
import SectionBridge from './SectionBridge';
import HeroSection from './HeroSection';
import StatsBar from './StatsBar';
import FeatureGrid from './FeatureGrid';
import SocialProofWall from './SocialProofWall';

// ─── Types ─────────────────────────────────────────────────────────

interface SectionRendererProps {
  section: FunnelPageSection;
  primaryColor?: string;
}

// ─── Component ─────────────────────────────────────────────────────

const SectionRenderer: React.FC<SectionRendererProps> = ({ section, primaryColor }) => {
  if (!section.isVisible) return null;

  const sectionVariant = section.variant || 'default';
  const color = primaryColor || '#6366f1';

  switch (section.sectionType) {
    case 'logo_bar': {
      const config = section.config as LogoBarConfig;
      return <LogoBar logos={config.logos || []} variant={sectionVariant} primaryColor={color} />;
    }
    case 'steps': {
      const config = section.config as StepsConfig;
      return (
        <SimpleSteps
          heading={config.heading}
          subheading={config.subheading}
          steps={config.steps}
          variant={sectionVariant}
          primaryColor={color}
        />
      );
    }
    case 'testimonial': {
      const config = section.config as TestimonialConfig;
      return (
        <TestimonialQuote
          quote={config.quote}
          author={config.author}
          role={config.role}
          result={config.result}
          variant={sectionVariant}
          primaryColor={color}
        />
      );
    }
    case 'marketing_block': {
      const config = section.config as MarketingBlockConfig;
      return (
        <MarketingBlock
          block={{
            blockType: config.blockType,
            title: config.title,
            content: config.content,
            imageUrl: config.imageUrl,
            ctaText: config.ctaText,
            ctaUrl: config.ctaUrl,
          }}
          variant={sectionVariant}
          primaryColor={color}
        />
      );
    }
    case 'section_bridge': {
      const config = section.config as SectionBridgeConfig;
      return (
        <SectionBridge
          text={config.text}
          variant={sectionVariant !== 'default' ? sectionVariant : config.variant}
          primaryColor={color}
          stepNumber={config.stepNumber}
          stepLabel={config.stepLabel}
        />
      );
    }
    case 'hero': {
      const config = section.config as HeroConfig;
      return (
        <HeroSection config={config} variant={sectionVariant || 'centered'} primaryColor={color} />
      );
    }
    case 'stats_bar': {
      return (
        <StatsBar
          config={section.config as StatsBarConfig}
          variant={sectionVariant || 'inline'}
          primaryColor={color}
        />
      );
    }
    case 'feature_grid': {
      return (
        <FeatureGrid
          config={section.config as FeatureGridConfig}
          variant={sectionVariant || 'icon-top'}
          primaryColor={color}
        />
      );
    }
    case 'social_proof_wall': {
      return (
        <SocialProofWall
          config={section.config as SocialProofWallConfig}
          variant={sectionVariant || 'grid'}
          primaryColor={color}
        />
      );
    }
    default:
      return null;
  }
};

export default SectionRenderer;
