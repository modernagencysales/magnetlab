'use client';

import { useState } from 'react';
import { Plus, Trash2, GripVertical, ChevronUp, ChevronDown, X } from 'lucide-react';
import type { PolishedContent, PolishedSection, PolishedBlock, PolishedBlockType, CalloutStyle } from '@/lib/types/lead-magnet';
import { ImageBlock, EmbedBlock } from './ContentBlocks';

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
    { type: 'code', label: 'Code Block' },
    { type: 'table', label: 'Table' },
    { type: 'accordion', label: 'Accordion' },
    { type: 'image', label: 'Image' },
    { type: 'embed', label: 'Video Embed' },
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

    let newBlock: PolishedBlock;
    switch (type) {
      case 'code':
        newBlock = { type: 'code', content: '// Your code here', language: 'typescript' };
        break;
      case 'table':
        newBlock = { type: 'table', content: '', headers: ['Column 1', 'Column 2'], rows: [['Value 1', 'Value 2']] };
        break;
      case 'accordion':
        newBlock = { type: 'accordion', content: 'Expandable content here...', title: 'Click to expand' };
        break;
      case 'image':
        newBlock = { type: 'image', content: '', src: '', alt: 'Image description' };
        break;
      case 'embed':
        newBlock = { type: 'embed', content: '', url: '' };
        break;
      case 'divider':
        newBlock = { type: 'divider', content: '' };
        break;
      default:
        newBlock = { type, content: 'New content...', ...(style ? { style } : {}) };
        break;
    }

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

  const inputStyle: React.CSSProperties = {
    background: 'transparent',
    border: `1px dashed rgba(139,92,246,0.3)`,
    borderRadius: '4px',
    padding: '4px 6px',
    outline: 'none',
    width: '100%',
    fontFamily: 'inherit',
    fontSize: '0.875rem',
    lineHeight: '1.5rem',
    color: bodyColor,
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '0.7rem',
    color: mutedColor,
    display: 'block',
    marginBottom: '0.125rem',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  };

  const CODE_LANGUAGES = [
    'typescript', 'javascript', 'python', 'bash', 'html', 'css', 'json', 'sql', 'text',
  ];

  const renderBlockEditor = (block: PolishedBlock, sectionIdx: number, blockIdx: number) => {
    switch (block.type) {
      case 'divider':
        return <hr style={{ border: 'none', borderTop: `1px solid ${borderColor}`, margin: '1rem 0' }} />;

      case 'code':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div>
              <label style={labelStyle}>Language</label>
              <select
                value={block.language || 'text'}
                onChange={(e) => updateBlock(sectionIdx, blockIdx, { language: e.target.value })}
                style={{
                  ...inputStyle,
                  width: 'auto',
                  padding: '4px 8px',
                  cursor: 'pointer',
                  backgroundColor: isDark ? '#18181B' : '#FFFFFF',
                }}
              >
                {CODE_LANGUAGES.map((lang) => (
                  <option key={lang} value={lang}>{lang}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Code</label>
              <textarea
                value={block.content}
                onChange={(e) => updateBlock(sectionIdx, blockIdx, { content: e.target.value })}
                placeholder="Enter code..."
                style={{
                  ...inputStyle,
                  fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
                  minHeight: '120px',
                  resize: 'vertical',
                  whiteSpace: 'pre',
                  tabSize: 2,
                }}
              />
            </div>
          </div>
        );

      case 'table':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <label style={{ ...labelStyle, marginBottom: 0 }}>Table</label>
              <button
                onClick={() => {
                  const headers = [...(block.headers || []), `Column ${(block.headers?.length || 0) + 1}`];
                  const rows = (block.rows || []).map((row) => [...row, '']);
                  updateBlock(sectionIdx, blockIdx, { headers, rows });
                }}
                style={{ ...inputStyle, width: 'auto', padding: '2px 8px', fontSize: '0.7rem', cursor: 'pointer' }}
              >
                + Column
              </button>
              <button
                onClick={() => {
                  const cols = block.headers?.length || 2;
                  const rows = [...(block.rows || []), Array(cols).fill('')];
                  updateBlock(sectionIdx, blockIdx, { rows });
                }}
                style={{ ...inputStyle, width: 'auto', padding: '2px 8px', fontSize: '0.7rem', cursor: 'pointer' }}
              >
                + Row
              </button>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {(block.headers || []).map((header, colIdx) => (
                      <th key={colIdx} style={{ padding: '2px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                          <input
                            value={header}
                            onChange={(e) => {
                              const headers = [...(block.headers || [])];
                              headers[colIdx] = e.target.value;
                              updateBlock(sectionIdx, blockIdx, { headers });
                            }}
                            placeholder={`Header ${colIdx + 1}`}
                            style={{ ...inputStyle, fontWeight: 600 }}
                          />
                          {(block.headers || []).length > 1 && (
                            <button
                              onClick={() => {
                                const headers = (block.headers || []).filter((_, i) => i !== colIdx);
                                const rows = (block.rows || []).map((row) => row.filter((_, i) => i !== colIdx));
                                updateBlock(sectionIdx, blockIdx, { headers, rows });
                              }}
                              style={{ ...controlButtonStyle, color: '#ef4444', padding: '1px', flexShrink: 0 }}
                            >
                              <X size={10} />
                            </button>
                          )}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(block.rows || []).map((row, rowIdx) => (
                    <tr key={rowIdx}>
                      {row.map((cell, cellIdx) => (
                        <td key={cellIdx} style={{ padding: '2px' }}>
                          <input
                            value={cell}
                            onChange={(e) => {
                              const rows = (block.rows || []).map((r, ri) =>
                                ri === rowIdx ? r.map((c, ci) => (ci === cellIdx ? e.target.value : c)) : [...r]
                              );
                              updateBlock(sectionIdx, blockIdx, { rows });
                            }}
                            placeholder="Cell value"
                            style={inputStyle}
                          />
                        </td>
                      ))}
                      <td style={{ padding: '2px', width: '24px' }}>
                        {(block.rows || []).length > 1 && (
                          <button
                            onClick={() => {
                              const rows = (block.rows || []).filter((_, i) => i !== rowIdx);
                              updateBlock(sectionIdx, blockIdx, { rows });
                            }}
                            style={{ ...controlButtonStyle, color: '#ef4444', padding: '1px' }}
                          >
                            <X size={10} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );

      case 'accordion':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div>
              <label style={labelStyle}>Title</label>
              <input
                value={block.title || ''}
                onChange={(e) => updateBlock(sectionIdx, blockIdx, { title: e.target.value })}
                placeholder="Accordion title..."
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Content</label>
              <EditableText
                value={block.content}
                onChange={(val) => updateBlock(sectionIdx, blockIdx, { content: val })}
                style={{ fontSize: '1rem', lineHeight: '1.75rem', color: bodyColor }}
                multiline
                placeholder="Accordion content..."
              />
            </div>
          </div>
        );

      case 'image':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div>
              <label style={labelStyle}>Image URL</label>
              <input
                value={block.src || ''}
                onChange={(e) => updateBlock(sectionIdx, blockIdx, { src: e.target.value })}
                placeholder="https://example.com/image.jpg"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Alt Text</label>
              <input
                value={block.alt || ''}
                onChange={(e) => updateBlock(sectionIdx, blockIdx, { alt: e.target.value })}
                placeholder="Describe the image..."
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Caption (optional)</label>
              <input
                value={block.caption || ''}
                onChange={(e) => updateBlock(sectionIdx, blockIdx, { caption: e.target.value })}
                placeholder="Image caption..."
                style={inputStyle}
              />
            </div>
            {block.src && (
              <div style={{ marginTop: '0.25rem' }}>
                <ImageBlock block={block} />
              </div>
            )}
          </div>
        );

      case 'embed':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div>
              <label style={labelStyle}>Video URL</label>
              <input
                value={block.url || ''}
                onChange={(e) => updateBlock(sectionIdx, blockIdx, { url: e.target.value })}
                placeholder="YouTube, Loom, or Vimeo URL"
                style={inputStyle}
              />
            </div>
            {block.url && (
              <div style={{ marginTop: '0.25rem' }}>
                <EmbedBlock block={block} />
              </div>
            )}
          </div>
        );

      default:
        // paragraph, callout, list, quote
        return (
          <EditableText
            value={block.content}
            onChange={(val) => updateBlock(sectionIdx, blockIdx, { content: val })}
            style={{ fontSize: '1rem', lineHeight: '1.75rem', color: bodyColor }}
            multiline
            placeholder="Block content..."
          />
        );
    }
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

              {renderBlockEditor(block, sectionIdx, blockIdx)}

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
