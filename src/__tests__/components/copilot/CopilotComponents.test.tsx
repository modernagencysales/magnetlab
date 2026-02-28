/**
 * @jest-environment jsdom
 */
import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';

// Mock react-markdown (ESM-only, can't be transformed by Jest)
jest.mock('react-markdown', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: ({ children, components }: { children: string; components?: Record<string, React.ComponentType<Record<string, unknown>>> }) => {
      // Simple markdown-like rendering that uses the component overrides
      if (!components) return React.createElement('div', null, children);

      // Parse bold: **text** → <strong>text</strong>
      let content: React.ReactNode = children;
      const boldMatch = children.match(/\*\*(.+?)\*\*/);
      if (boldMatch && components.strong) {
        const Strong = components.strong;
        const parts = children.split(/\*\*(.+?)\*\*/);
        content = React.createElement(React.Fragment, null,
          parts[0],
          React.createElement(Strong, { key: 'bold' }, parts[1]),
          parts[2] || '',
        );
      }

      // Parse code blocks: ```\n...\n``` → <pre><code>...</code></pre>
      const codeBlockMatch = children.match(/```\n?([\s\S]*?)\n?```/);
      if (codeBlockMatch && components.code) {
        const Code = components.code;
        const Pre = components.pre || 'pre';
        content = React.createElement(Pre, { key: 'pre' },
          React.createElement(Code, { node: { position: { start: { line: 1 }, end: { line: 3 } } }, className: 'language-' }, codeBlockMatch[1]),
        );
      }

      const P = components.p || 'p';
      // Wrap in a paragraph if we're doing inline content (not code block)
      if (!codeBlockMatch) {
        return React.createElement(P, null, content);
      }
      return React.createElement('div', null, content);
    },
  };
});

jest.mock('remark-gfm', () => ({
  __esModule: true,
  default: () => {},
}));

// Mock lucide-react icons used by both components
jest.mock('lucide-react', () => ({
  Send: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-send" {...props} />,
  Square: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-square" {...props} />,
  ThumbsUp: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-thumbs-up" {...props} />,
  ThumbsDown: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-thumbs-down" {...props} />,
  Wrench: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-wrench" {...props} />,
  X: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-x" {...props} />,
}));

import { ConversationInput } from '@/components/copilot/ConversationInput';
import { CopilotMessage } from '@/components/copilot/CopilotMessage';
import type { CopilotMessage as CopilotMessageType } from '@/components/copilot/CopilotProvider';

// ---------------------------------------------------------------------------
// ConversationInput
// ---------------------------------------------------------------------------

describe('ConversationInput', () => {
  const defaultProps = {
    onSend: jest.fn(),
    onCancel: jest.fn(),
    isStreaming: false,
  };

  beforeEach(() => jest.clearAllMocks());

  it('renders textarea and send button', () => {
    render(<ConversationInput {...defaultProps} />);
    expect(screen.getByPlaceholderText('Ask anything...')).toBeInTheDocument();
    expect(screen.getByLabelText('Send message')).toBeInTheDocument();
  });

  it('calls onSend on form submit with trimmed text', () => {
    render(<ConversationInput {...defaultProps} />);
    const textarea = screen.getByPlaceholderText('Ask anything...');
    fireEvent.change(textarea, { target: { value: 'Hello copilot' } });
    fireEvent.submit(textarea.closest('form')!);
    expect(defaultProps.onSend).toHaveBeenCalledWith('Hello copilot');
  });

  it('does not submit empty text', () => {
    render(<ConversationInput {...defaultProps} />);
    fireEvent.submit(screen.getByPlaceholderText('Ask anything...').closest('form')!);
    expect(defaultProps.onSend).not.toHaveBeenCalled();
  });

  it('does not submit whitespace-only text', () => {
    render(<ConversationInput {...defaultProps} />);
    const textarea = screen.getByPlaceholderText('Ask anything...');
    fireEvent.change(textarea, { target: { value: '   ' } });
    fireEvent.submit(textarea.closest('form')!);
    expect(defaultProps.onSend).not.toHaveBeenCalled();
  });

  it('shows stop button when streaming', () => {
    render(<ConversationInput {...defaultProps} isStreaming={true} />);
    expect(screen.getByLabelText('Stop generating')).toBeInTheDocument();
    // Send button should NOT be present when streaming
    expect(screen.queryByLabelText('Send message')).not.toBeInTheDocument();
  });

  it('calls onCancel when stop button clicked', () => {
    render(<ConversationInput {...defaultProps} isStreaming={true} />);
    fireEvent.click(screen.getByLabelText('Stop generating'));
    expect(defaultProps.onCancel).toHaveBeenCalled();
  });

  it('disables textarea when streaming', () => {
    render(<ConversationInput {...defaultProps} isStreaming={true} />);
    expect(screen.getByPlaceholderText('Ask anything...')).toBeDisabled();
  });

  it('disables send button when textarea is empty', () => {
    render(<ConversationInput {...defaultProps} />);
    expect(screen.getByLabelText('Send message')).toBeDisabled();
  });

  it('enables send button when textarea has text', () => {
    render(<ConversationInput {...defaultProps} />);
    const textarea = screen.getByPlaceholderText('Ask anything...');
    fireEvent.change(textarea, { target: { value: 'some text' } });
    expect(screen.getByLabelText('Send message')).not.toBeDisabled();
  });

  it('clears textarea after successful submit', () => {
    render(<ConversationInput {...defaultProps} />);
    const textarea = screen.getByPlaceholderText('Ask anything...') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'Hello' } });
    fireEvent.submit(textarea.closest('form')!);
    expect(textarea.value).toBe('');
  });
});

// ---------------------------------------------------------------------------
// CopilotMessage
// ---------------------------------------------------------------------------

describe('CopilotMessage', () => {
  const mockFeedback = jest.fn();

  beforeEach(() => jest.clearAllMocks());

  it('renders user message content', () => {
    const msg: CopilotMessageType = {
      id: '1',
      role: 'user',
      content: 'Hello there',
      createdAt: new Date().toISOString(),
    };
    render(<CopilotMessage message={msg} onFeedback={mockFeedback} />);
    expect(screen.getByText('Hello there')).toBeInTheDocument();
  });

  it('does not show feedback buttons on user messages', () => {
    const msg: CopilotMessageType = {
      id: '1',
      role: 'user',
      content: 'Hello there',
      createdAt: new Date().toISOString(),
    };
    render(<CopilotMessage message={msg} onFeedback={mockFeedback} />);
    expect(screen.queryByLabelText('Good response')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Bad response')).not.toBeInTheDocument();
  });

  it('renders assistant message with feedback buttons', () => {
    const msg: CopilotMessageType = {
      id: '2',
      role: 'assistant',
      content: 'I can help!',
      createdAt: new Date().toISOString(),
    };
    render(<CopilotMessage message={msg} onFeedback={mockFeedback} />);
    expect(screen.getByText('I can help!')).toBeInTheDocument();
    expect(screen.getByLabelText('Good response')).toBeInTheDocument();
    expect(screen.getByLabelText('Bad response')).toBeInTheDocument();
  });

  it('does not show feedback buttons on empty assistant messages', () => {
    const msg: CopilotMessageType = {
      id: '2',
      role: 'assistant',
      content: '',
      createdAt: new Date().toISOString(),
    };
    render(<CopilotMessage message={msg} onFeedback={mockFeedback} />);
    // The component checks `message.content` is truthy before rendering feedback
    expect(screen.queryByLabelText('Good response')).not.toBeInTheDocument();
  });

  it('renders tool_call message with tool name', () => {
    const msg: CopilotMessageType = {
      id: '3',
      role: 'tool_call',
      content: '',
      toolName: 'search_knowledge',
      toolArgs: { query: 'pricing' },
      createdAt: new Date().toISOString(),
    };
    render(<CopilotMessage message={msg} onFeedback={mockFeedback} />);
    expect(screen.getByText('search_knowledge')).toBeInTheDocument();
    // Wrench icon should be rendered
    expect(screen.getByTestId('icon-wrench')).toBeInTheDocument();
  });

  it('renders tool_result success', () => {
    const msg: CopilotMessageType = {
      id: '4',
      role: 'tool_result',
      content: '',
      toolName: 'search_knowledge',
      toolResult: { success: true, data: [] },
      createdAt: new Date().toISOString(),
    };
    render(<CopilotMessage message={msg} onFeedback={mockFeedback} />);
    expect(screen.getByText(/Done/)).toBeInTheDocument();
  });

  it('renders tool_result failure', () => {
    const msg: CopilotMessageType = {
      id: '5',
      role: 'tool_result',
      content: '',
      toolName: 'write_post',
      toolResult: { success: false, error: 'No content' },
      createdAt: new Date().toISOString(),
    };
    render(<CopilotMessage message={msg} onFeedback={mockFeedback} />);
    expect(screen.getByText(/Failed/)).toBeInTheDocument();
  });

  it('renders tool_result without explicit success as failure', () => {
    const msg: CopilotMessageType = {
      id: '5b',
      role: 'tool_result',
      content: '',
      toolName: 'some_tool',
      toolResult: { error: 'Something went wrong' },
      createdAt: new Date().toISOString(),
    };
    render(<CopilotMessage message={msg} onFeedback={mockFeedback} />);
    expect(screen.getByText(/Failed/)).toBeInTheDocument();
  });

  it('calls onFeedback with positive when thumbs up clicked', () => {
    const msg: CopilotMessageType = {
      id: '6',
      role: 'assistant',
      content: 'Great post!',
      createdAt: new Date().toISOString(),
    };
    render(<CopilotMessage message={msg} onFeedback={mockFeedback} />);
    fireEvent.click(screen.getByLabelText('Good response'));
    expect(mockFeedback).toHaveBeenCalledWith('positive', undefined);
  });

  it('shows note input when thumbs down clicked (FeedbackWidget)', () => {
    const msg: CopilotMessageType = {
      id: '7',
      role: 'assistant',
      content: 'Here is a suggestion',
      createdAt: new Date().toISOString(),
    };
    render(<CopilotMessage message={msg} onFeedback={mockFeedback} />);
    fireEvent.click(screen.getByLabelText('Bad response'));
    // FeedbackWidget shows note input instead of immediately calling onFeedback
    expect(screen.getByPlaceholderText(/what could be better/i)).toBeInTheDocument();
    // Skip note to submit negative feedback without a note
    fireEvent.click(screen.getByLabelText('Skip note'));
    expect(mockFeedback).toHaveBeenCalledWith('negative', undefined);
  });

  it('renders markdown bold in assistant messages', () => {
    const msg: CopilotMessageType = {
      id: '8',
      role: 'assistant',
      content: 'This is **bold** text',
      createdAt: new Date().toISOString(),
    };
    const { container } = render(<CopilotMessage message={msg} onFeedback={mockFeedback} />);
    const strong = container.querySelector('strong');
    expect(strong).toBeInTheDocument();
    expect(strong?.textContent).toBe('bold');
  });

  it('renders markdown code blocks in assistant messages', () => {
    const msg: CopilotMessageType = {
      id: '9',
      role: 'assistant',
      content: '```\nconst x = 1;\n```',
      createdAt: new Date().toISOString(),
    };
    const { container } = render(<CopilotMessage message={msg} onFeedback={mockFeedback} />);
    const code = container.querySelector('code');
    expect(code).toBeInTheDocument();
    expect(code?.textContent).toContain('const x = 1;');
  });

  it('does not render markdown in user messages', () => {
    const msg: CopilotMessageType = {
      id: '10',
      role: 'user',
      content: 'This is **bold** text',
      createdAt: new Date().toISOString(),
    };
    const { container } = render(<CopilotMessage message={msg} onFeedback={mockFeedback} />);
    const strong = container.querySelector('strong');
    expect(strong).not.toBeInTheDocument();
    // The raw markdown syntax should be visible as plain text
    expect(screen.getByText('This is **bold** text')).toBeInTheDocument();
  });
});
