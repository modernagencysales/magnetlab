'use client';

import { useState } from 'react';
import { Plus, Trash2, GripVertical, ChevronUp, ChevronDown } from 'lucide-react';
import type { PolishedContent, PolishedSection, PolishedBlock, PolishedBlockType, CalloutStyle } from '@/lib/types/lead-magnet';

interface EditablePolishedContentRendererProps {
  content: PolishedContent;
  isDark: boolean;
  primaryColor: string;
  onChange: (content: PolishedContent) => void;
}

function EditableText({
  value,
  onChange,
  style,
  multiline = false,
  placeholder,
}: {
  value: string;
  onChange: (val: string) => void;
  style: React.CSSProperties;
  multiline?: boolean;
  placeholder?: string;
}) {
  const Tag = multiline ? 'textarea' : 'input';
  return (
    <Tag
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        ...style,
        background: 'transparent',
        border: '1px dashed rgba(139,92,246,0.3)',
        borderRadius: '4px',
        padding: '4px 6px',
        outline: 'none',
        width: '100%',
        resize: multiline ? 'vertical' : 'none',
        fontFamily: 'inherit',
        ...(multiline ? { minHeight: '80px' } : {}),
      }}
      onFocus={(e) => {
        (e.target as HTMLElement).style.borderColor = 'rgba(139,92,246,0.6)';
      }}
      onBlur={(e) => {
        (e.target as HTMLElement).style.borderColor = 'rgba(139,92,246,0.3)';
      }}
    />
  );
}

function BlockTypeSelector({
  onSelect,
  isDark,
}: {
  onSelect: (type: PolishedBlockType, style?: CalloutStyle) => void;
  isDark: boolean;
}) {
  const borderColor = isDark ? '#27272A' : '#E4E4E7';
  const bgColor = isDark ? '#18181B' : '#FFFFFF';
  const textColor = isDark ? '#A1A1AA' : '#71717A';

  const options: { type: PolishedBlockType; label: string; style?: CalloutStyle }[] = [
    { type: 'paragraph', label: 'Paragraph' },
    { type: 'list', label: 'Bullet List' },
    { type: 'quote', label: 'Quote' },
    { type: 'callout', label: 'Info Callout', style: 'info' },
    { type: 'callout', label: 'Warning', style: 'warning' },
    { type: 'callout', label: 'Success', style: 'success' },
    { type: 'divider', label: 'Divider' },
  ];

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '0.25rem',
        padding: '0.5rem',
        background: bgColor,
        border: `1px solid ${borderColor}`,
        borderRadius: '0.5rem',
      }}
    >
      {options.map((opt) => (
        <button
          key={opt.label}
          onClick={() => onSelect(opt.type, opt.style)}
          style={{
            background: 'none',
            border: `1px solid ${borderColor}`,
            borderRadius: '0.25rem',
            padding: '0.25rem 0.5rem',
            fontSize: '0.75rem',
            color: textColor,
            cursor: 'pointer',
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function EditablePolishedContentRenderer({
  content,
  isDark,
  primaryColor: _primaryColor,
  onChange,
}: EditablePolishedContentRendererProps) {
  const [addingBlockAt, setAddingBlockAt] = useState<{ sectionIdx: number; blockIdx: number } | null>(null);

  const textColor = isDark ? '#FAFAFA' : '#09090B';
  const bodyColor = isDark ? '#E4E4E7' : '#27272A';
  const mutedColor = isDark ? '#A1A1AA' : '#71717A';
  const borderColor = isDark ? '#27272A' : '#E4E4E7';
  const controlBg = isDark ? '#27272A' : '#E4E4E7';

  const updateSection = (sectionIdx: number, updates: Partial<PolishedSection>) => {
    const newSections = [...content.sections];
    newSections[sectionIdx] = { ...newSections[sectionIdx], ...updates };
    onChange({ ...content, sections: newSections });
  };

  const updateBlock = (sectionIdx: number, blockIdx: number, updates: Partial<PolishedBlock>) => {
    const newSections = [...content.sections];
    const newBlocks = [...newSections[sectionIdx].blocks];
    newBlocks[blockIdx] = { ...newBlocks[blockIdx], ...updates };
    newSections[sectionIdx] = { ...newSections[sectionIdx], blocks: newBlocks };
    onChange({ ...content, sections: newSections });
  };

  const addBlock = (sectionIdx: number, afterBlockIdx: number, type: PolishedBlockType, style?: CalloutStyle) => {
    const newSections = [...content.sections];
    const newBlocks = [...newSections[sectionIdx].blocks];
    const newBlock: PolishedBlock = {
      type,
      content: type === 'divider' ? '' : 'New content...',
      ...(style ? { style } : {}),
    };
    newBlocks.splice(afterBlockIdx + 1, 0, newBlock);
    newSections[sectionIdx] = { ...newSections[sectionIdx], blocks: newBlocks };
    onChange({ ...content, sections: newSections });
    setAddingBlockAt(null);
  };

  const deleteBlock = (sectionIdx: number, blockIdx: number) => {
    const newSections = [...content.sections];
    const newBlocks = [...newSections[sectionIdx].blocks];
    newBlocks.splice(blockIdx, 1);
    newSections[sectionIdx] = { ...newSections[sectionIdx], blocks: newBlocks };
    onChange({ ...content, sections: newSections });
  };

  const moveBlock = (sectionIdx: number, blockIdx: number, direction: 'up' | 'down') => {
    const newSections = [...content.sections];
    const newBlocks = [...newSections[sectionIdx].blocks];
    const targetIdx = direction === 'up' ? blockIdx - 1 : blockIdx + 1;
    if (targetIdx < 0 || targetIdx >= newBlocks.length) return;
    [newBlocks[blockIdx], newBlocks[targetIdx]] = [newBlocks[targetIdx], newBlocks[blockIdx]];
    newSections[sectionIdx] = { ...newSections[sectionIdx], blocks: newBlocks };
    onChange({ ...content, sections: newSections });
  };

  const addSection = (afterIdx: number) => {
    const newSections = [...content.sections];
    const newSection: PolishedSection = {
      id: `section-${Date.now()}`,
      sectionName: 'New Section',
      introduction: '',
      blocks: [{ type: 'paragraph', content: 'Start writing...' }],
      keyTakeaway: '',
    };
    newSections.splice(afterIdx + 1, 0, newSection);
    onChange({ ...content, sections: newSections });
  };

  const deleteSection = (sectionIdx: number) => {
    if (content.sections.length <= 1) return;
    const newSections = [...content.sections];
    newSections.splice(sectionIdx, 1);
    onChange({ ...content, sections: newSections });
  };

  const moveSection = (sectionIdx: number, direction: 'up' | 'down') => {
    const newSections = [...content.sections];
    const targetIdx = direction === 'up' ? sectionIdx - 1 : sectionIdx + 1;
    if (targetIdx < 0 || targetIdx >= newSections.length) return;
    [newSections[sectionIdx], newSections[targetIdx]] = [newSections[targetIdx], newSections[sectionIdx]];
    onChange({ ...content, sections: newSections });
  };

  const controlButtonStyle: React.CSSProperties = {
    background: controlBg,
    border: 'none',
    cursor: 'pointer',
    padding: '2px',
    borderRadius: '3px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: mutedColor,
  };

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <label style={{ fontSize: '0.75rem', color: mutedColor, display: 'block', marginBottom: '0.25rem' }}>
          Hero Summary
        </label>
        <EditableText
          value={content.heroSummary}
          onChange={(val) => onChange({ ...content, heroSummary: val })}
          style={{ fontSize: '1.125rem', lineHeight: '1.75rem', color: bodyColor }}
          multiline
          placeholder="A compelling 1-2 sentence summary..."
        />
      </div>

      {content.sections.map((section, sectionIdx) => (
        <section
          key={section.id}
          id={section.id}
          style={{ marginBottom: '3rem', scrollMarginTop: '5rem', position: 'relative' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginBottom: '0.5rem' }}>
            <GripVertical size={14} style={{ color: mutedColor }} />
            <button onClick={() => moveSection(sectionIdx, 'up')} style={controlButtonStyle} disabled={sectionIdx === 0}>
              <ChevronUp size={14} />
            </button>
            <button onClick={() => moveSection(sectionIdx, 'down')} style={controlButtonStyle} disabled={sectionIdx === content.sections.length - 1}>
              <ChevronDown size={14} />
            </button>
            <button onClick={() => deleteSection(sectionIdx)} style={{ ...controlButtonStyle, color: '#ef4444' }} disabled={content.sections.length <= 1}>
              <Trash2 size={14} />
            </button>
          </div>

          <EditableText
            value={section.sectionName}
            onChange={(val) => updateSection(sectionIdx, { sectionName: val })}
            style={{ fontSize: '1.5rem', fontWeight: 600, letterSpacing: '-0.02em', lineHeight: '2rem', color: textColor, marginBottom: '0.75rem' }}
            placeholder="Section title"
          />

          <EditableText
            value={section.introduction}
            onChange={(val) => updateSection(sectionIdx, { introduction: val })}
            style={{ fontSize: '1.125rem', lineHeight: '1.875rem', color: mutedColor, fontStyle: 'italic', marginBottom: '1.5rem' }}
            multiline
            placeholder="Section introduction (optional)"
          />

          {section.blocks.map((block, blockIdx) => (
            <div key={blockIdx} style={{ position: 'relative', marginBottom: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginBottom: '0.25rem' }}>
                <span style={{ fontSize: '0.65rem', color: mutedColor, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {block.type}{block.style ? ` (${block.style})` : ''}
                </span>
                <button onClick={() => moveBlock(sectionIdx, blockIdx, 'up')} style={controlButtonStyle} disabled={blockIdx === 0}>
                  <ChevronUp size={12} />
                </button>
                <button onClick={() => moveBlock(sectionIdx, blockIdx, 'down')} style={controlButtonStyle} disabled={blockIdx === section.blocks.length - 1}>
                  <ChevronDown size={12} />
                </button>
                <button onClick={() => deleteBlock(sectionIdx, blockIdx)} style={{ ...controlButtonStyle, color: '#ef4444' }}>
                  <Trash2 size={12} />
                </button>
              </div>

              {block.type === 'divider' ? (
                <hr style={{ border: 'none', borderTop: `1px solid ${borderColor}`, margin: '1rem 0' }} />
              ) : (
                <EditableText
                  value={block.content}
                  onChange={(val) => updateBlock(sectionIdx, blockIdx, { content: val })}
                  style={{ fontSize: '1rem', lineHeight: '1.75rem', color: bodyColor }}
                  multiline
                  placeholder="Block content..."
                />
              )}

              <div style={{ display: 'flex', justifyContent: 'center', margin: '0.5rem 0' }}>
                {addingBlockAt?.sectionIdx === sectionIdx && addingBlockAt?.blockIdx === blockIdx ? (
                  <BlockTypeSelector onSelect={(type, style) => addBlock(sectionIdx, blockIdx, type, style)} isDark={isDark} />
                ) : (
                  <button
                    onClick={() => setAddingBlockAt({ sectionIdx, blockIdx })}
                    style={{
                      background: 'none',
                      border: `1px dashed ${borderColor}`,
                      borderRadius: '4px',
                      padding: '2px 12px',
                      fontSize: '0.75rem',
                      color: mutedColor,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <Plus size={12} /> Add block
                  </button>
                )}
              </div>
            </div>
          ))}

          <div style={{ marginTop: '1rem' }}>
            <label style={{ fontSize: '0.75rem', color: mutedColor, display: 'block', marginBottom: '0.25rem' }}>
              Key Takeaway
            </label>
            <EditableText
              value={section.keyTakeaway}
              onChange={(val) => updateSection(sectionIdx, { keyTakeaway: val })}
              style={{ fontSize: '1rem', lineHeight: '1.75rem', color: bodyColor }}
              placeholder="Key takeaway for this section (optional)"
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '2rem' }}>
            <hr style={{ flex: 1, border: 'none', borderTop: `1px solid ${borderColor}` }} />
            <button
              onClick={() => addSection(sectionIdx)}
              style={{
                background: 'none',
                border: `1px dashed ${borderColor}`,
                borderRadius: '4px',
                padding: '4px 12px',
                fontSize: '0.75rem',
                color: mutedColor,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                whiteSpace: 'nowrap',
              }}
            >
              <Plus size={12} /> Add section
            </button>
            <hr style={{ flex: 1, border: 'none', borderTop: `1px solid ${borderColor}` }} />
          </div>
        </section>
      ))}
    </div>
  );
}
