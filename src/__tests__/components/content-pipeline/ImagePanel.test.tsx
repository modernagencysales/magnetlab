import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ImagePanel } from '@/components/content-pipeline/ImagePanel';

// Mock fetch globally
global.fetch = jest.fn();

describe('ImagePanel', () => {
  const defaultProps = {
    postId: 'post-123',
    imageUrls: [] as string[],
    generationStatus: null as string | null,
    onImageGenerated: jest.fn(),
    onImageRemoved: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders generate button when no images', () => {
    render(<ImagePanel {...defaultProps} />);
    expect(screen.getByText(/generate image/i)).toBeInTheDocument();
  });

  it('shows image preview when imageUrls has entries', () => {
    render(<ImagePanel {...defaultProps} imageUrls={['https://example.com/img.png']} />);
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', 'https://example.com/img.png');
  });

  it('shows style picker on generate click', () => {
    render(<ImagePanel {...defaultProps} />);
    fireEvent.click(screen.getByText(/generate image/i));
    expect(screen.getByText(/abstract/i)).toBeInTheDocument();
    expect(screen.getByText(/illustration/i)).toBeInTheDocument();
    expect(screen.getByText(/photography/i)).toBeInTheDocument();
    expect(screen.getByText(/minimal/i)).toBeInTheDocument();
  });

  it('shows loading state during generation', () => {
    render(<ImagePanel {...defaultProps} generationStatus="generating" />);
    expect(screen.getByText(/generating/i)).toBeInTheDocument();
  });

  it('shows remove button when image exists', () => {
    render(<ImagePanel {...defaultProps} imageUrls={['https://example.com/img.png']} />);
    expect(screen.getByLabelText(/remove/i)).toBeInTheDocument();
  });

  it('calls onImageRemoved when remove clicked', () => {
    render(<ImagePanel {...defaultProps} imageUrls={['https://example.com/img.png']} />);
    fireEvent.click(screen.getByLabelText(/remove/i));
    expect(defaultProps.onImageRemoved).toHaveBeenCalled();
  });

  it('calls fetch with correct URL on style selection', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      json: () => Promise.resolve({ imageUrl: 'https://example.com/generated.png' }),
    });

    render(<ImagePanel {...defaultProps} />);
    fireEvent.click(screen.getByText(/generate image/i));
    fireEvent.click(screen.getByText(/abstract/i));

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/content-pipeline/posts/post-123/generate-image',
      expect.objectContaining({ method: 'POST' })
    );
  });
});
