/**
 * @jest-environment node
 */

import {
  parseQuizQuestions,
  validateQuizQuestion,
} from '@/lib/ai/content-pipeline/quiz-generator';
import type { GeneratedQuestion } from '@/lib/ai/content-pipeline/quiz-generator';

describe('quiz-generator', () => {
  // ============================================
  // validateQuizQuestion
  // ============================================

  describe('validateQuizQuestion', () => {
    it('accepts valid multiple_choice question', () => {
      const q: GeneratedQuestion = {
        question_text: 'What best describes your role?',
        answer_type: 'multiple_choice',
        options: ['C-Suite / VP', 'Director / Manager', 'Individual Contributor'],
        qualifying_answer: ['C-Suite / VP', 'Director / Manager'],
        is_qualifying: true,
        is_required: true,
      };

      expect(validateQuizQuestion(q)).toBe(true);
    });

    it('rejects multiple_choice with fewer than 2 options', () => {
      const q: GeneratedQuestion = {
        question_text: 'Pick one',
        answer_type: 'multiple_choice',
        options: ['Only option'],
        qualifying_answer: ['Only option'],
        is_qualifying: true,
        is_required: true,
      };

      expect(validateQuizQuestion(q)).toBe(false);
    });

    it('rejects multiple_choice with null options', () => {
      const q: GeneratedQuestion = {
        question_text: 'Pick one',
        answer_type: 'multiple_choice',
        options: null,
        qualifying_answer: null,
        is_qualifying: false,
        is_required: true,
      };

      expect(validateQuizQuestion(q)).toBe(false);
    });

    it('accepts valid yes_no question with qualifying_answer "yes"', () => {
      const q: GeneratedQuestion = {
        question_text: 'Do you manage a team of 10+?',
        answer_type: 'yes_no',
        options: null,
        qualifying_answer: 'yes',
        is_qualifying: true,
        is_required: true,
      };

      expect(validateQuizQuestion(q)).toBe(true);
    });

    it('accepts valid yes_no question with qualifying_answer "no"', () => {
      const q: GeneratedQuestion = {
        question_text: 'Are you using a competitor tool?',
        answer_type: 'yes_no',
        options: null,
        qualifying_answer: 'no',
        is_qualifying: true,
        is_required: true,
      };

      expect(validateQuizQuestion(q)).toBe(true);
    });

    it('rejects yes_no with invalid qualifying_answer when is_qualifying is true', () => {
      const q: GeneratedQuestion = {
        question_text: 'Do you have budget?',
        answer_type: 'yes_no',
        options: null,
        qualifying_answer: 'maybe',
        is_qualifying: true,
        is_required: true,
      };

      expect(validateQuizQuestion(q)).toBe(false);
    });

    it('accepts yes_no with any qualifying_answer when is_qualifying is false', () => {
      const q: GeneratedQuestion = {
        question_text: 'Have you heard of us?',
        answer_type: 'yes_no',
        options: null,
        qualifying_answer: null,
        is_qualifying: false,
        is_required: false,
      };

      expect(validateQuizQuestion(q)).toBe(true);
    });

    it('accepts valid text question', () => {
      const q: GeneratedQuestion = {
        question_text: 'What is your biggest challenge?',
        answer_type: 'text',
        options: null,
        qualifying_answer: null,
        is_qualifying: false,
        is_required: true,
      };

      expect(validateQuizQuestion(q)).toBe(true);
    });

    it('accepts valid textarea question', () => {
      const q: GeneratedQuestion = {
        question_text: 'Tell us about your goals',
        answer_type: 'textarea',
        options: null,
        qualifying_answer: null,
        is_qualifying: false,
        is_required: true,
      };

      expect(validateQuizQuestion(q)).toBe(true);
    });

    it('rejects question with empty question_text', () => {
      const q: GeneratedQuestion = {
        question_text: '',
        answer_type: 'text',
        options: null,
        qualifying_answer: null,
        is_qualifying: false,
        is_required: true,
      };

      expect(validateQuizQuestion(q)).toBe(false);
    });
  });

  // ============================================
  // parseQuizQuestions
  // ============================================

  describe('parseQuizQuestions', () => {
    it('parses valid quiz JSON', () => {
      const raw = JSON.stringify([
        {
          question_text: 'What best describes your role?',
          answer_type: 'multiple_choice',
          options: ['C-Suite / VP', 'Director / Manager', 'Individual Contributor', 'Consultant'],
          qualifying_answer: ['C-Suite / VP', 'Director / Manager'],
          is_qualifying: true,
          is_required: true,
        },
        {
          question_text: 'What is your biggest challenge right now?',
          answer_type: 'textarea',
          options: null,
          qualifying_answer: null,
          is_qualifying: false,
          is_required: true,
        },
      ]);

      const results = parseQuizQuestions(raw);

      expect(results).toHaveLength(2);
      expect(results[0].question_text).toBe('What best describes your role?');
      expect(results[0].answer_type).toBe('multiple_choice');
      expect(results[0].options).toEqual(['C-Suite / VP', 'Director / Manager', 'Individual Contributor', 'Consultant']);
      expect(results[0].qualifying_answer).toEqual(['C-Suite / VP', 'Director / Manager']);
      expect(results[0].is_qualifying).toBe(true);
      expect(results[1].answer_type).toBe('textarea');
      expect(results[1].is_qualifying).toBe(false);
    });

    it('caps at 5 questions', () => {
      const questions = Array.from({ length: 8 }, (_, i) => ({
        question_text: `Question ${i + 1}`,
        answer_type: 'text',
        options: null,
        qualifying_answer: null,
        is_qualifying: false,
        is_required: true,
      }));

      const results = parseQuizQuestions(JSON.stringify(questions));

      expect(results).toHaveLength(5);
      expect(results[4].question_text).toBe('Question 5');
    });

    it('filters out invalid questions', () => {
      const raw = JSON.stringify([
        {
          question_text: 'Valid MC question',
          answer_type: 'multiple_choice',
          options: ['A', 'B', 'C'],
          qualifying_answer: ['A'],
          is_qualifying: true,
          is_required: true,
        },
        {
          question_text: 'Bad MC — only 1 option',
          answer_type: 'multiple_choice',
          options: ['Only'],
          qualifying_answer: ['Only'],
          is_qualifying: true,
          is_required: true,
        },
        {
          question_text: 'Valid text question',
          answer_type: 'text',
          options: null,
          qualifying_answer: null,
          is_qualifying: false,
          is_required: true,
        },
      ]);

      const results = parseQuizQuestions(raw);

      expect(results).toHaveLength(2);
      expect(results[0].question_text).toBe('Valid MC question');
      expect(results[1].question_text).toBe('Valid text question');
    });

    it('parses JSON inside markdown code blocks', () => {
      const raw = '```json\n[{"question_text":"What is your role?","answer_type":"multiple_choice","options":["A","B"],"qualifying_answer":["A"],"is_qualifying":true,"is_required":true}]\n```';

      const results = parseQuizQuestions(raw);

      expect(results).toHaveLength(1);
      expect(results[0].question_text).toBe('What is your role?');
    });

    it('returns empty array for invalid JSON', () => {
      const results = parseQuizQuestions('not valid json');

      expect(results).toEqual([]);
    });

    it('returns empty array for non-array JSON', () => {
      const results = parseQuizQuestions('{"question": "not an array"}');

      expect(results).toEqual([]);
    });

    it('defaults answer_type to text for unknown types', () => {
      const raw = JSON.stringify([
        {
          question_text: 'Something weird',
          answer_type: 'slider',
          options: null,
          qualifying_answer: null,
          is_qualifying: false,
          is_required: true,
        },
      ]);

      const results = parseQuizQuestions(raw);

      expect(results).toHaveLength(1);
      expect(results[0].answer_type).toBe('text');
    });
  });
});
