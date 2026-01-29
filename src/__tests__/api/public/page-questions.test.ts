/**
 * @jest-environment node
 */

import { GET } from '@/app/api/public/page/[id]/questions/route';

// Mock chainable Supabase client with table tracking
interface MockChainable {
  from: jest.Mock;
  select: jest.Mock;
  eq: jest.Mock;
  order: jest.Mock;
  single: jest.Mock;
  _setTableResult: (table: string, result: { data: unknown; error: unknown }) => void;
  _reset: () => void;
}

function createMockSupabase(): MockChainable {
  let tableResults: Record<string, { data: unknown; error: unknown }> = {};
  let currentTable = '';

  const chainable: MockChainable = {
    from: jest.fn((table: string) => {
      currentTable = table;
      return chainable;
    }),
    select: jest.fn(() => chainable),
    eq: jest.fn(() => chainable),
    order: jest.fn(() => {
      // order() is the terminal call for qualification_questions
      if (currentTable === 'qualification_questions') {
        return Promise.resolve(tableResults[currentTable] || { data: [], error: null });
      }
      return chainable;
    }),
    single: jest.fn(() => {
      return Promise.resolve(tableResults[currentTable] || { data: null, error: null });
    }),
    _setTableResult: (table, result) => {
      tableResults[table] = result;
    },
    _reset: () => {
      tableResults = {};
      currentTable = '';
    },
  };

  return chainable;
}

const mockSupabaseClient = createMockSupabase();

jest.mock('@/lib/utils/supabase-server', () => ({
  createSupabaseAdminClient: jest.fn(() => mockSupabaseClient),
}));

const makeParams = (id: string) => ({
  params: Promise.resolve({ id }),
});

const makeRequest = (id: string) =>
  new Request(`http://localhost:3000/api/public/page/${id}/questions`);

describe('GET /api/public/page/[id]/questions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabaseClient._reset();
  });

  it('should return 404 if funnel page not found', async () => {
    mockSupabaseClient._setTableResult('funnel_pages', {
      data: null,
      error: { code: 'PGRST116', message: 'not found' },
    });

    const response = await GET(makeRequest('bad-id'), makeParams('bad-id'));
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Page not found');
  });

  it('should return 404 if funnel page is not published', async () => {
    mockSupabaseClient._setTableResult('funnel_pages', {
      data: { id: 'page-1', is_published: false },
      error: null,
    });

    const response = await GET(makeRequest('page-1'), makeParams('page-1'));
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Page not found');
  });

  it('should return empty questions array for published page with no questions', async () => {
    mockSupabaseClient._setTableResult('funnel_pages', {
      data: { id: 'page-1', is_published: true },
      error: null,
    });
    mockSupabaseClient._setTableResult('qualification_questions', {
      data: [],
      error: null,
    });

    const response = await GET(makeRequest('page-1'), makeParams('page-1'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.questions).toEqual([]);
  });

  it('should return questions mapped to camelCase', async () => {
    mockSupabaseClient._setTableResult('funnel_pages', {
      data: { id: 'page-1', is_published: true },
      error: null,
    });
    mockSupabaseClient._setTableResult('qualification_questions', {
      data: [
        {
          id: 'q-1',
          question_text: 'Do you use LinkedIn?',
          question_order: 1,
          answer_type: 'yes_no',
          options: null,
          placeholder: null,
          is_required: true,
        },
        {
          id: 'q-2',
          question_text: 'What is your role?',
          question_order: 2,
          answer_type: 'multiple_choice',
          options: ['CEO', 'CTO', 'Developer'],
          placeholder: null,
          is_required: false,
        },
      ],
      error: null,
    });

    const response = await GET(makeRequest('page-1'), makeParams('page-1'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.questions).toHaveLength(2);

    expect(data.questions[0]).toEqual({
      id: 'q-1',
      questionText: 'Do you use LinkedIn?',
      questionOrder: 1,
      answerType: 'yes_no',
      options: null,
      placeholder: null,
      isRequired: true,
    });

    expect(data.questions[1]).toEqual({
      id: 'q-2',
      questionText: 'What is your role?',
      questionOrder: 2,
      answerType: 'multiple_choice',
      options: ['CEO', 'CTO', 'Developer'],
      placeholder: null,
      isRequired: false,
    });
  });

  it('should return 500 if questions query fails', async () => {
    mockSupabaseClient._setTableResult('funnel_pages', {
      data: { id: 'page-1', is_published: true },
      error: null,
    });
    mockSupabaseClient._setTableResult('qualification_questions', {
      data: null,
      error: { code: 'DB_ERR', message: 'query failed' },
    });

    const response = await GET(makeRequest('page-1'), makeParams('page-1'));
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to load questions');
  });
});
