import React from 'react';
import type {
  FunnelPageSection,
  LogoBarConfig,
  StepsConfig,
  TestimonialConfig,
  MarketingBlockConfig,
  SectionBridgeConfig,
  HeroConfig,
} from '@/lib/types/funnel';
import LogoBar from './LogoBar';
import SimpleSteps from './SimpleSteps';
import TestimonialQuote from './TestimonialQuote';
import MarketingBlock from './MarketingBlock';
import SectionBridge from './SectionBridge';
import HeroSection from './HeroSection';

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
    default:
      return null;
  }
};

export default SectionRenderer;
