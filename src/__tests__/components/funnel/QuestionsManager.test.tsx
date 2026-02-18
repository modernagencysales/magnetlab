/**
 * @jest-environment jsdom
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { QuestionsManager } from '@/components/funnel/QuestionsManager';
import type { QualificationQuestion } from '@/lib/types/funnel';

// Mock lucide-react icons to avoid SVG rendering issues in tests
jest.mock('lucide-react', () => ({
  Plus: () => <span data-testid="icon-plus">+</span>,
  Trash2: () => <span data-testid="icon-trash">trash</span>,
  GripVertical: () => <span data-testid="icon-grip">grip</span>,
  Loader2: () => <span data-testid="icon-loader">loading</span>,
  HelpCircle: () => <span data-testid="icon-help">help</span>,
  ListChecks: () => <span data-testid="icon-list">list</span>,
  X: () => <span data-testid="icon-x">x</span>,
  ChevronDown: () => <span data-testid="icon-chevron">chevron</span>,
}));

// Helper to create a multiple_choice question fixture
function makeMultipleChoiceQuestion(overrides: Partial<QualificationQuestion> = {}): QualificationQuestion {
  return {
    id: 'q-mc-1',
    funnelPageId: 'funnel-1',
    formId: null,
    questionText: 'What is your budget?',
    questionOrder: 0,
    answerType: 'multiple_choice',
    qualifyingAnswer: ['$5k-$10k'],
    options: ['Under $5k', '$5k-$10k', '$10k-$25k', 'Over $25k'],
    placeholder: null,
    isQualifying: true,
    isRequired: true,
    createdAt: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeYesNoQuestion(overrides: Partial<QualificationQuestion> = {}): QualificationQuestion {
  return {
    id: 'q-yn-1',
    funnelPageId: 'funnel-1',
    formId: null,
    questionText: 'Do you have a team?',
    questionOrder: 1,
    answerType: 'yes_no',
    qualifyingAnswer: 'yes',
    options: null,
    placeholder: null,
    isQualifying: true,
    isRequired: true,
    createdAt: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

const defaultProps = {
  funnelId: 'funnel-1',
  formId: null,
  onNeedsSave: jest.fn(),
};

describe('QuestionsManager - Edit Qualification Questions (MOD-91)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock fetch globally (already done in jest.setup.js, but reset for each test)
    (global.fetch as jest.Mock).mockReset();
  });

  describe('Multiple choice option editing in expanded panel', () => {
    it('should render editable text inputs for each multiple_choice option when expanded', () => {
      const question = makeMultipleChoiceQuestion();
      const setQuestions = jest.fn();

      render(
        <QuestionsManager
          {...defaultProps}
          questions={[question]}
          setQuestions={setQuestions}
        />
      );

      // Expand the question by clicking the chevron
      const chevronButtons = screen.getAllByTestId('icon-chevron');
      fireEvent.click(chevronButtons[0].closest('button')!);

      // BUG: Options are rendered as static <span> elements, not editable <input> elements.
      // The edit panel should have text inputs for each option, just like the "Add New Question" form.
      // This test expects editable inputs for each option value.
      const optionInputs = screen.getAllByDisplayValue('Under $5k');
      expect(optionInputs.length).toBeGreaterThanOrEqual(1);
      expect(optionInputs[0].tagName).toBe('INPUT');

      // All options should be editable inputs
      expect(screen.getByDisplayValue('$5k-$10k')).toBeInTheDocument();
      expect(screen.getByDisplayValue('$10k-$25k')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Over $25k')).toBeInTheDocument();
    });

    it('should allow editing option text and trigger an update API call', () => {
      const question = makeMultipleChoiceQuestion();
      const setQuestions = jest.fn();

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          question: {
            ...question,
            options: ['Under $5k', '$5k-$15k', '$10k-$25k', 'Over $25k'],
          },
        }),
      });

      render(
        <QuestionsManager
          {...defaultProps}
          questions={[question]}
          setQuestions={setQuestions}
        />
      );

      // Expand the question
      const chevronButtons = screen.getAllByTestId('icon-chevron');
      fireEvent.click(chevronButtons[0].closest('button')!);

      // BUG: There are no input elements for option text in the edit panel.
      // Users must be able to change the text of an existing option.
      const optionInput = screen.getByDisplayValue('$5k-$10k');
      fireEvent.change(optionInput, { target: { value: '$5k-$15k' } });

      // The component should call the API with the updated options
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/funnel/funnel-1/questions/q-mc-1'),
        expect.objectContaining({
          method: 'PUT',
          body: expect.stringContaining('options'),
        })
      );
    });

    it('should have an "Add option" button in the edit panel for multiple_choice questions', () => {
      const question = makeMultipleChoiceQuestion();
      const setQuestions = jest.fn();

      render(
        <QuestionsManager
          {...defaultProps}
          questions={[question]}
          setQuestions={setQuestions}
        />
      );

      // Expand the question
      const chevronButtons = screen.getAllByTestId('icon-chevron');
      fireEvent.click(chevronButtons[0].closest('button')!);

      // BUG: There is no "Add option" button in the edit panel.
      // The "Add New Question" form has one, but the edit panel does not.
      const addOptionButton = screen.getByText(/add option/i);
      expect(addOptionButton).toBeInTheDocument();
    });

    it('should have remove buttons for options in the edit panel when more than 2 options exist', () => {
      const question = makeMultipleChoiceQuestion(); // has 4 options
      const setQuestions = jest.fn();

      render(
        <QuestionsManager
          {...defaultProps}
          questions={[question]}
          setQuestions={setQuestions}
        />
      );

      // Expand the question
      const chevronButtons = screen.getAllByTestId('icon-chevron');
      fireEvent.click(chevronButtons[0].closest('button')!);

      // BUG: There are no remove buttons for options in the edit panel.
      // Users should be able to remove existing options (when > 2 options).
      // The "Add New Question" form uses X icons for removal.
      const removeButtons = screen.getAllByTestId('icon-x');
      // At minimum, options beyond the required 2 should have remove buttons
      expect(removeButtons.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Basic edit functionality verification', () => {
    it('should show the edit panel with editable fields when chevron is clicked', () => {
      const question = makeYesNoQuestion();
      const setQuestions = jest.fn();

      render(
        <QuestionsManager
          {...defaultProps}
          questions={[question]}
          setQuestions={setQuestions}
        />
      );

      // Initially, the edit panel should not be visible
      expect(screen.queryByLabelText(/question text/i)).not.toBeInTheDocument();

      // Click the chevron to expand
      const chevronButtons = screen.getAllByTestId('icon-chevron');
      fireEvent.click(chevronButtons[0].closest('button')!);

      // Edit panel should now be visible with the question text input
      const questionInput = screen.getByDisplayValue('Do you have a team?');
      expect(questionInput).toBeInTheDocument();
      expect(questionInput.tagName).toBe('INPUT');
    });
  });
});
