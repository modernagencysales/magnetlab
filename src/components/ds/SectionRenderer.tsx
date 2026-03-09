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

interface SectionRendererProps {
  section: FunnelPageSection;
  primaryColor?: string;
}

const SectionRenderer: React.FC<SectionRendererProps> = ({ section, primaryColor }) => {
  if (!section.isVisible) return null;

  switch (section.sectionType) {
    case 'logo_bar': {
      const config = section.config as LogoBarConfig;
      return <LogoBar logos={config.logos || []} />;
    }
    case 'steps': {
      const config = section.config as StepsConfig;
      return (
        <SimpleSteps heading={config.heading} subheading={config.subheading} steps={config.steps} />
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
        />
      );
    }
    case 'section_bridge': {
      const config = section.config as SectionBridgeConfig;
      return (
        <SectionBridge
          text={config.text}
          variant={config.variant}
          stepNumber={config.stepNumber}
          stepLabel={config.stepLabel}
        />
      );
    }
    case 'hero': {
      const config = section.config as HeroConfig;
      return (
        <HeroSection
          config={config}
          variant={section.variant || 'centered'}
          primaryColor={primaryColor || '#6366f1'}
        />
      );
    }
    case 'stats_bar': {
      return (
        <StatsBar
          config={section.config as StatsBarConfig}
          variant={section.variant || 'inline'}
          primaryColor={primaryColor || '#6366f1'}
        />
      );
    }
    case 'feature_grid': {
      return (
        <FeatureGrid
          config={section.config as FeatureGridConfig}
          variant={section.variant || 'icon-top'}
          primaryColor={primaryColor || '#6366f1'}
        />
      );
    }
    case 'social_proof_wall': {
      return (
        <SocialProofWall
          config={section.config as SocialProofWallConfig}
          variant={section.variant || 'grid'}
          primaryColor={primaryColor || '#6366f1'}
        />
      );
    }
    default:
      return null;
  }
};

export default SectionRenderer;
