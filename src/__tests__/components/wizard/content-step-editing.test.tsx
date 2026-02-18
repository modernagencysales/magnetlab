/**
 * @jest-environment jsdom
 */

import '@testing-library/jest-dom';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { ContentStep } from '@/components/wizard/steps/ContentStep';
import type { ExtractedContent } from '@/lib/types/lead-magnet';

const mockContent: ExtractedContent = {
  title: '5-Step Client Acquisition Framework',
  format: '5-Step Framework',
  structure: [
    {
      sectionName: 'Step 1: Identify Your Ideal Client',
      contents: [
        'Define your niche audience',
        'Research their biggest pain points',
      ],
    },
    {
      sectionName: 'Step 2: Build Your Outreach System',
      contents: [
        'Create a template library',
        'Set up automated follow-ups',
      ],
    },
  ],
  nonObviousInsight: 'Most consultants focus on volume when they should focus on targeting.',
  personalExperience: 'I discovered this after burning through 500 cold emails with 0 replies.',
  proof: 'Helped 200+ B2B founders generate $2.3M in pipeline revenue.',
  commonMistakes: ['Sending generic messages', 'Not following up'],
  differentiation: 'This framework combines AI personalization with proven sales psychology.',
};

/** Find the edit button inside a section identified by a unique label text */
function findEditButton(labelText: string): HTMLButtonElement {
  const label = screen.getByText(labelText);
  // Walk up to the flex container that holds both the label and the button
  const flexContainer = label.parentElement!;
  const button = within(flexContainer).getByRole('button');
  return button as HTMLButtonElement;
}

describe('ContentStep editing', () => {
  const defaultProps = {
    content: mockContent,
    onApprove: jest.fn(),
    onBack: jest.fn(),
    loading: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('read-only mode (no onContentChange)', () => {
    it('does not render edit buttons when onContentChange is not provided', () => {
      render(<ContentStep {...defaultProps} />);

      expect(screen.getByText('5-Step Client Acquisition Framework')).toBeInTheDocument();
      expect(screen.getByText('Helped 200+ B2B founders generate $2.3M in pipeline revenue.')).toBeInTheDocument();

      // No "Edit" pencil buttons should exist
      const editButtons = screen.queryAllByText('Edit');
      expect(editButtons).toHaveLength(0);
    });

    it('renders all structure sections in read-only mode', () => {
      render(<ContentStep {...defaultProps} />);

      expect(screen.getByText('Step 1: Identify Your Ideal Client')).toBeInTheDocument();
      expect(screen.getByText('Define your niche audience')).toBeInTheDocument();
      expect(screen.getByText('Step 2: Build Your Outreach System')).toBeInTheDocument();
    });
  });

  describe('with onContentChange', () => {
    it('renders edit buttons for proof and structure', () => {
      const onContentChange = jest.fn();
      render(<ContentStep {...defaultProps} onContentChange={onContentChange} />);

      // "Framework / Steps" label only appears when onContentChange is provided
      expect(screen.getByText('Framework / Steps')).toBeInTheDocument();
      expect(screen.getByText('Proof & Results')).toBeInTheDocument();

      // Should have Edit buttons
      const editButtons = screen.getAllByText('Edit');
      expect(editButtons.length).toBeGreaterThanOrEqual(2);
    });

    describe('proof editing', () => {
      it('shows textarea when proof Edit is clicked', () => {
        const onContentChange = jest.fn();
        render(<ContentStep {...defaultProps} onContentChange={onContentChange} />);

        const editButton = findEditButton('Proof & Results');
        fireEvent.click(editButton);

        const textarea = screen.getByPlaceholderText('Describe your results, metrics, case studies...');
        expect(textarea).toBeInTheDocument();
        expect(textarea).toHaveValue('Helped 200+ B2B founders generate $2.3M in pipeline revenue.');
      });

      it('calls onContentChange when proof text is edited', () => {
        const onContentChange = jest.fn();
        render(<ContentStep {...defaultProps} onContentChange={onContentChange} />);

        fireEvent.click(findEditButton('Proof & Results'));

        const textarea = screen.getByPlaceholderText('Describe your results, metrics, case studies...');
        fireEvent.change(textarea, {
          target: { value: 'New proof: Generated $5M in revenue for 300+ clients.' },
        });

        expect(onContentChange).toHaveBeenCalledWith(
          expect.objectContaining({
            proof: 'New proof: Generated $5M in revenue for 300+ clients.',
            title: mockContent.title,
            structure: mockContent.structure,
          })
        );
      });

      it('toggles back to read-only when Done is clicked', () => {
        const onContentChange = jest.fn();
        render(<ContentStep {...defaultProps} onContentChange={onContentChange} />);

        // Enter edit mode
        fireEvent.click(findEditButton('Proof & Results'));
        expect(screen.getByPlaceholderText('Describe your results, metrics, case studies...')).toBeInTheDocument();

        // Click Done (the same button now says "Done")
        const doneButton = findEditButton('Proof & Results');
        fireEvent.click(doneButton);

        // Should be back to read-only
        expect(screen.queryByPlaceholderText('Describe your results, metrics, case studies...')).not.toBeInTheDocument();
      });
    });

    describe('structure editing', () => {
      it('shows editable inputs when structure Edit is clicked', () => {
        const onContentChange = jest.fn();
        render(<ContentStep {...defaultProps} onContentChange={onContentChange} />);

        fireEvent.click(findEditButton('Framework / Steps'));

        const inputs = screen.getAllByPlaceholderText('Add a step or point...');
        expect(inputs.length).toBe(4); // 2 items in section 1 + 2 items in section 2
      });

      it('calls onContentChange when a section item is edited', () => {
        const onContentChange = jest.fn();
        render(<ContentStep {...defaultProps} onContentChange={onContentChange} />);

        fireEvent.click(findEditButton('Framework / Steps'));

        const inputs = screen.getAllByPlaceholderText('Add a step or point...');
        fireEvent.change(inputs[0], {
          target: { value: 'Updated: Define your dream client profile' },
        });

        expect(onContentChange).toHaveBeenCalledWith(
          expect.objectContaining({
            structure: expect.arrayContaining([
              expect.objectContaining({
                sectionName: 'Step 1: Identify Your Ideal Client',
                contents: ['Updated: Define your dream client profile', 'Research their biggest pain points'],
              }),
            ]),
          })
        );
      });

      it('calls onContentChange when adding a new item to a section', () => {
        const onContentChange = jest.fn();
        render(<ContentStep {...defaultProps} onContentChange={onContentChange} />);

        fireEvent.click(findEditButton('Framework / Steps'));

        const addItemButtons = screen.getAllByText('Add item');
        fireEvent.click(addItemButtons[0]);

        expect(onContentChange).toHaveBeenCalledWith(
          expect.objectContaining({
            structure: expect.arrayContaining([
              expect.objectContaining({
                sectionName: 'Step 1: Identify Your Ideal Client',
                contents: [
                  'Define your niche audience',
                  'Research their biggest pain points',
                  '',
                ],
              }),
            ]),
          })
        );
      });

      it('calls onContentChange when removing an item from a section', () => {
        const onContentChange = jest.fn();
        render(<ContentStep {...defaultProps} onContentChange={onContentChange} />);

        fireEvent.click(findEditButton('Framework / Steps'));

        const removeButtons = screen.getAllByTitle('Remove item');
        fireEvent.click(removeButtons[0]);

        expect(onContentChange).toHaveBeenCalledWith(
          expect.objectContaining({
            structure: expect.arrayContaining([
              expect.objectContaining({
                sectionName: 'Step 1: Identify Your Ideal Client',
                contents: ['Research their biggest pain points'],
              }),
            ]),
          })
        );
      });

      it('calls onContentChange when editing a section name', () => {
        const onContentChange = jest.fn();
        render(<ContentStep {...defaultProps} onContentChange={onContentChange} />);

        fireEvent.click(findEditButton('Framework / Steps'));

        const sectionNameInputs = screen.getAllByPlaceholderText('Section name...');
        fireEvent.change(sectionNameInputs[0], {
          target: { value: 'Step 1: Define Your Dream Client' },
        });

        expect(onContentChange).toHaveBeenCalledWith(
          expect.objectContaining({
            structure: expect.arrayContaining([
              expect.objectContaining({
                sectionName: 'Step 1: Define Your Dream Client',
              }),
            ]),
          })
        );
      });

      it('shows Add section button in edit mode and calls onContentChange when clicked', () => {
        const onContentChange = jest.fn();
        render(<ContentStep {...defaultProps} onContentChange={onContentChange} />);

        fireEvent.click(findEditButton('Framework / Steps'));

        const addSectionButton = screen.getByText('Add section');
        fireEvent.click(addSectionButton);

        expect(onContentChange).toHaveBeenCalledWith(
          expect.objectContaining({
            structure: expect.arrayContaining([
              expect.objectContaining({ sectionName: 'Step 1: Identify Your Ideal Client' }),
              expect.objectContaining({ sectionName: 'Step 2: Build Your Outreach System' }),
              expect.objectContaining({ sectionName: '', contents: [''] }),
            ]),
          })
        );
      });

      it('allows removing sections (but not the last one)', () => {
        const onContentChange = jest.fn();
        render(<ContentStep {...defaultProps} onContentChange={onContentChange} />);

        fireEvent.click(findEditButton('Framework / Steps'));

        const removeSectionButtons = screen.getAllByTitle('Remove section');
        expect(removeSectionButtons).toHaveLength(2);

        fireEvent.click(removeSectionButtons[0]);

        expect(onContentChange).toHaveBeenCalledWith(
          expect.objectContaining({
            structure: [
              expect.objectContaining({ sectionName: 'Step 2: Build Your Outreach System' }),
            ],
          })
        );
      });
    });

    it('preserves unedited fields when changing content', () => {
      const onContentChange = jest.fn();
      render(<ContentStep {...defaultProps} onContentChange={onContentChange} />);

      fireEvent.click(findEditButton('Proof & Results'));

      const textarea = screen.getByPlaceholderText('Describe your results, metrics, case studies...');
      fireEvent.change(textarea, { target: { value: 'New proof text' } });

      const updatedContent = onContentChange.mock.calls[0][0];
      expect(updatedContent.title).toBe(mockContent.title);
      expect(updatedContent.format).toBe(mockContent.format);
      expect(updatedContent.nonObviousInsight).toBe(mockContent.nonObviousInsight);
      expect(updatedContent.personalExperience).toBe(mockContent.personalExperience);
      expect(updatedContent.structure).toEqual(mockContent.structure);
      expect(updatedContent.commonMistakes).toEqual(mockContent.commonMistakes);
      expect(updatedContent.differentiation).toBe(mockContent.differentiation);
      expect(updatedContent.proof).toBe('New proof text');
    });
  });

  describe('single-section edge case', () => {
    it('does not show remove section button when only one section exists', () => {
      const singleSectionContent: ExtractedContent = {
        ...mockContent,
        structure: [
          {
            sectionName: 'Only Section',
            contents: ['Only item'],
          },
        ],
      };

      const onContentChange = jest.fn();
      render(
        <ContentStep
          {...defaultProps}
          content={singleSectionContent}
          onContentChange={onContentChange}
        />
      );

      fireEvent.click(findEditButton('Framework / Steps'));

      const removeSectionButtons = screen.queryAllByTitle('Remove section');
      expect(removeSectionButtons).toHaveLength(0);
    });
  });
});
