// Survey Question Templates
// Pre-configured question sets that can be loaded into the funnel builder

import type { AnswerType } from '@/lib/types/funnel';

export interface SurveyTemplateQuestion {
  questionText: string;
  answerType: AnswerType;
  options: string[] | null;
  placeholder: string | null;
  isQualifying: boolean;
  qualifyingAnswer: string | string[] | null;
  isRequired: boolean;
}

export const SURVEY_TEMPLATE_QUESTIONS: SurveyTemplateQuestion[] = [
  {
    questionText: "What's your full name? Ideally as it appears on your primary social channels.",
    answerType: 'text',
    options: null,
    placeholder: 'e.g. Tim Smith',
    isQualifying: false,
    qualifyingAnswer: null,
    isRequired: true,
  },
  {
    questionText: "What's your best mobile number? (Promise I won't spam or prank call you)",
    answerType: 'text',
    options: null,
    placeholder: 'e.g. +1 555 123 4567',
    isQualifying: false,
    qualifyingAnswer: null,
    isRequired: true,
  },
  {
    questionText: "What's the best email address to send your bonuses to for helping me with this?",
    answerType: 'text',
    options: null,
    placeholder: 'your@email.com',
    isQualifying: false,
    qualifyingAnswer: null,
    isRequired: true,
  },
  {
    questionText: 'What is your biggest LinkedIn challenge right now?',
    answerType: 'textarea',
    options: null,
    placeholder: 'Tell me about your biggest challenge...',
    isQualifying: false,
    qualifyingAnswer: null,
    isRequired: true,
  },
  {
    questionText: 'What type of business do you run?',
    answerType: 'multiple_choice',
    options: [
      'Agency / Consultancy',
      'SaaS / Tech',
      'Coaching / Training',
      'Professional Services',
      'E-commerce',
      'Other',
    ],
    placeholder: null,
    isQualifying: false,
    qualifyingAnswer: null,
    isRequired: true,
  },
  {
    questionText: 'What part of LinkedIn do you want most help with?',
    answerType: 'multiple_choice',
    options: [
      'Content creation & posting',
      'Lead generation & outreach',
      'Profile optimization',
      'Building authority & thought leadership',
      'All of the above',
    ],
    placeholder: null,
    isQualifying: false,
    qualifyingAnswer: null,
    isRequired: true,
  },
  {
    questionText: 'Are you posting on LinkedIn right now?',
    answerType: 'yes_no',
    options: null,
    placeholder: null,
    isQualifying: true,
    qualifyingAnswer: 'yes',
    isRequired: true,
  },
  {
    questionText: 'Do you send people from content into a funnel?',
    answerType: 'yes_no',
    options: null,
    placeholder: null,
    isQualifying: true,
    qualifyingAnswer: 'yes',
    isRequired: true,
  },
  {
    questionText: 'How much have you invested in your own learning last year?',
    answerType: 'multiple_choice',
    options: [
      'Less than $500',
      '$500 - $2,000',
      '$2,000 - $5,000',
      '$5,000 - $10,000',
      '$10,000+',
    ],
    placeholder: null,
    isQualifying: true,
    qualifyingAnswer: ['$2,000 - $5,000', '$5,000 - $10,000', '$10,000+'],
    isRequired: true,
  },
  {
    questionText: 'Monthly business income (approx.)',
    answerType: 'multiple_choice',
    options: [
      'Less than $5,000',
      '$5,000 - $10,000',
      '$10,000 - $25,000',
      '$25,000 - $50,000',
      '$50,000+',
    ],
    placeholder: null,
    isQualifying: true,
    qualifyingAnswer: ['$10,000 - $25,000', '$25,000 - $50,000', '$50,000+'],
    isRequired: true,
  },
  {
    questionText: 'Want to learn about the Modern Agency Sales system that helps business owners build a lead and sales machine?',
    answerType: 'yes_no',
    options: null,
    placeholder: null,
    isQualifying: true,
    qualifyingAnswer: 'yes',
    isRequired: true,
  },
  {
    questionText: "What's your LinkedIn Profile URL?",
    answerType: 'text',
    options: null,
    placeholder: 'https://linkedin.com/in/yourprofile',
    isQualifying: false,
    qualifyingAnswer: null,
    isRequired: false,
  },
];
