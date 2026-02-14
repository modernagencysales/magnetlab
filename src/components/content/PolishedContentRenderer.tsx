'use client';

import type { PolishedContent } from '@/lib/types/lead-magnet';
import { Callout, RichParagraph, BulletList, BlockQuote, SectionDivider, CodeBlock, TableBlock, AccordionBlock, ImageBlock, EmbedBlock } from './ContentBlocks';

interface PolishedContentRendererProps {
  content: PolishedContent;
  isDark: boolean;
  primaryColor: string;
}

export function PolishedContentRenderer({
  content,
  isDark,
  primaryColor,
}: PolishedContentRendererProps) {
  const textColor = isDark ? '#FAFAFA' : '#09090B';
  const bodyColor = isDark ? '#E4E4E7' : '#27272A';
  const mutedColor = isDark ? '#A1A1AA' : '#71717A';
  const borderColor = isDark ? '#27272A' : '#E4E4E7';
  const cardBg = isDark ? '#18181B' : '#FFFFFF';

  const colors = { text: textColor, body: bodyColor, muted: mutedColor, border: borderColor, card: cardBg };

  return (
    <div>
      {content.sections.map((section, sectionIdx) => (
        <section
          key={section.id}
          data-section-index={sectionIdx}
          data-section-name={section.sectionName}
          id={`section-${section.id}`}
          style={{ marginBottom: '3rem', scrollMarginTop: '5rem' }}
        >
          {/* Section heading */}
          <h2
            style={{
              fontSize: '1.5rem',
              fontWeight: 600,
              letterSpacing: '-0.02em',
              lineHeight: '2rem',
              color: textColor,
              margin: '0 0 0.75rem 0',
            }}
          >
            {section.sectionName}
          </h2>

          {/* Section introduction */}
          {section.introduction && (
            <p
              style={{
                fontSize: '1.125rem',
                lineHeight: '1.875rem',
                color: mutedColor,
                margin: '0 0 1.5rem 0',
                fontStyle: 'italic',
              }}
            >
              {section.introduction}
            </p>
          )}

          {/* Content blocks */}
          {section.blocks.map((block, blockIdx) => {
            switch (block.type) {
              case 'paragraph':
                return (
                  <RichParagraph
                    key={blockIdx}
                    content={block.content}
                    colors={colors}
                  />
                );
              case 'callout':
                return (
                  <Callout
                    key={blockIdx}
                    content={block.content}
                    style={block.style}
                    isDark={isDark}
                  />
                );
              case 'list':
                return (
                  <BulletList
                    key={blockIdx}
                    content={block.content}
                    colors={colors}
                  />
                );
              case 'quote':
                return (
                  <BlockQuote
                    key={blockIdx}
                    content={block.content}
                    colors={colors}
                    primaryColor={primaryColor}
                  />
                );
              case 'divider':
                return <SectionDivider key={blockIdx} colors={colors} />;
              case 'code':
                return <CodeBlock key={blockIdx} block={block} isDark={isDark} />;
              case 'table':
                return <TableBlock key={blockIdx} block={block} isDark={isDark} />;
              case 'accordion':
                return <AccordionBlock key={blockIdx} block={block} />;
              case 'image':
                return <ImageBlock key={blockIdx} block={block} />;
              case 'embed':
                return <EmbedBlock key={blockIdx} block={block} />;
              default:
                return null;
            }
          })}

          {/* Key takeaway */}
          {section.keyTakeaway && (
            <Callout
              content={`Key Takeaway: ${section.keyTakeaway}`}
              style="success"
              isDark={isDark}
            />
          )}

          {/* Section divider (except after last section) */}
          {sectionIdx < content.sections.length - 1 && (
            <hr
              style={{
                border: 'none',
                borderTop: `1px solid ${borderColor}`,
                margin: '2.5rem 0 0 0',
              }}
            />
          )}
        </section>
      ))}
    </div>
  );
}
