/**
 * @jest-environment jsdom
 */
import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';

// Mock lucide-react icons used by both components
jest.mock('lucide-react', () => ({
  Send: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-send" {...props} />,
  Square: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-square" {...props} />,
  ThumbsUp: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-thumbs-up" {...props} />,
  ThumbsDown: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-thumbs-down" {...props} />,
  Wrench: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-wrench" {...props} />,
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
    expect(mockFeedback).toHaveBeenCalledWith('positive');
  });

  it('calls onFeedback with negative when thumbs down clicked', () => {
    const msg: CopilotMessageType = {
      id: '7',
      role: 'assistant',
      content: 'Here is a suggestion',
      createdAt: new Date().toISOString(),
    };
    render(<CopilotMessage message={msg} onFeedback={mockFeedback} />);
    fireEvent.click(screen.getByLabelText('Bad response'));
    expect(mockFeedback).toHaveBeenCalledWith('negative');
  });
});
