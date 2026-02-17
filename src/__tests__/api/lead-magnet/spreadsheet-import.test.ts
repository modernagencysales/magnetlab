/**
 * @jest-environment node
 */

/**
 * Spreadsheet Import Tests (MOD-92)
 *
 * Tests for importing calculations from CSV/Google Sheets to create
 * interactive calculator lead magnets.
 */

import '../../__mocks__/auth';
import '../../__mocks__/supabase';
import { mockSupabaseClient, createMockSupabaseResponse } from '../../__mocks__/supabase';
import { auth } from '@/lib/auth';

// Mock Anthropic SDK (used by the text/URL import path)
jest.mock('@anthropic-ai/sdk', () => {
  return jest.fn().mockImplementation(() => ({
    messages: {
      create: jest.fn(),
    },
  }));
});

// Mock content-pipeline anthropic client (used by generateCalculatorFromSpreadsheet)
const mockAICreate = jest.fn();
jest.mock('@/lib/ai/content-pipeline/anthropic-client', () => ({
  getAnthropicClient: jest.fn(() => ({
    messages: {
      create: mockAICreate,
    },
  })),
}));

describe('Spreadsheet Import (MOD-92)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (auth as jest.Mock).mockResolvedValue({
      user: { id: 'test-user-id', email: 'test@example.com' },
    });
  });

  // Sample CSV data representing a ROI calculator spreadsheet
  const sampleCSVData = [
    'Input/Output,Label,Type,Value/Formula',
    'input,Monthly Revenue,number,',
    'input,Number of Employees,number,',
    'input,Average Deal Size,number,',
    'input,Current Conversion Rate (%),number,',
    'formula,Annual Revenue,formula,Monthly Revenue * 12',
    'formula,Revenue Per Employee,formula,Annual Revenue / Number of Employees',
    'output,Projected Growth (%),percentage,(Average Deal Size * Current Conversion Rate) / Monthly Revenue * 100',
  ].join('\n');

  // A valid CalculatorConfig that the AI would generate
  const mockCalculatorConfig = {
    type: 'calculator' as const,
    headline: 'ROI Growth Calculator',
    description: 'Calculate your projected business growth based on key metrics',
    inputs: [
      { id: 'monthlyRevenue', label: 'Monthly Revenue', type: 'number' as const, placeholder: 'e.g. 50000', min: 0, max: 10000000, step: 1000, defaultValue: 50000, unit: '$' },
      { id: 'numberOfEmployees', label: 'Number of Employees', type: 'number' as const, placeholder: 'e.g. 10', min: 1, max: 10000, step: 1, defaultValue: 10 },
      { id: 'averageDealSize', label: 'Average Deal Size', type: 'number' as const, placeholder: 'e.g. 5000', min: 0, max: 1000000, step: 100, defaultValue: 5000, unit: '$' },
      { id: 'conversionRate', label: 'Current Conversion Rate', type: 'slider' as const, min: 0, max: 100, step: 1, defaultValue: 10, unit: '%' },
    ],
    formula: '(averageDealSize * conversionRate) / monthlyRevenue * 100',
    resultLabel: 'Projected Growth',
    resultFormat: 'percentage' as const,
    resultInterpretation: [
      { range: [0, 5] as [number, number], label: 'Low Growth', description: 'Below average growth trajectory', color: 'red' as const },
      { range: [5, 15] as [number, number], label: 'Moderate Growth', description: 'Healthy growth rate', color: 'yellow' as const },
      { range: [15, 100] as [number, number], label: 'Strong Growth', description: 'Excellent growth trajectory', color: 'green' as const },
    ],
  };

  describe('Spreadsheet parser (parseSpreadsheet)', () => {
    it('should parse structured CSV with input/formula/output roles', async () => {
      const { parseSpreadsheet } = await import('@/lib/utils/spreadsheet-parser');
      const result = parseSpreadsheet(sampleCSVData);

      expect(result.inputs).toHaveLength(4);
      expect(result.inputs[0]).toMatchObject({ label: 'Monthly Revenue', type: 'number' });
      expect(result.inputs[0].unit).toBe('$');
      expect(result.inputs[3].unit).toBe('%');
      expect(result.formulas).toHaveLength(2);
      expect(result.formulas[0]).toMatchObject({ label: 'Annual Revenue', expression: 'Monthly Revenue * 12' });
      expect(result.outputs).toHaveLength(1);
      expect(result.outputs[0].format).toBe('percentage');
      expect(result.rawRowCount).toBe(8);
    });

    it('should handle unstructured CSV by treating columns as inputs', async () => {
      const { parseSpreadsheet } = await import('@/lib/utils/spreadsheet-parser');
      const plainCSV = 'Revenue,Employees,Deal Size\n50000,10,5000\n60000,12,6000';
      const result = parseSpreadsheet(plainCSV);

      expect(result.inputs).toHaveLength(3);
      expect(result.inputs[0].label).toBe('Revenue');
      expect(result.inputs[0].unit).toBe('$');
      expect(result.formulas).toHaveLength(0);
      expect(result.outputs).toHaveLength(0);
    });

    it('should throw on too-short CSV data', async () => {
      const { parseSpreadsheet } = await import('@/lib/utils/spreadsheet-parser');
      expect(() => parseSpreadsheet('only one line')).toThrow('at least 2 rows');
    });

    it('should handle quoted fields with commas', async () => {
      const { parseSpreadsheet } = await import('@/lib/utils/spreadsheet-parser');
      const csv = 'Role,Label,Type,Formula\ninput,"Revenue, Monthly",number,';
      const result = parseSpreadsheet(csv);
      expect(result.inputs[0].label).toBe('Revenue, Monthly');
    });
  });

  describe('Validation schema (spreadsheetImportSchema)', () => {
    it('should exist and validate spreadsheet import payloads', async () => {
      const { spreadsheetImportSchema } = await import('@/lib/validations/api');
      expect(spreadsheetImportSchema).toBeDefined();

      const valid = spreadsheetImportSchema.safeParse({
        spreadsheetData: sampleCSVData,
        importType: 'spreadsheet',
        title: 'My Calculator',
      });
      expect(valid.success).toBe(true);
    });

    it('should reject payloads with wrong importType', async () => {
      const { spreadsheetImportSchema } = await import('@/lib/validations/api');
      const result = spreadsheetImportSchema.safeParse({
        spreadsheetData: sampleCSVData,
        importType: 'text',
      });
      expect(result.success).toBe(false);
    });

    it('should reject empty spreadsheet data', async () => {
      const { spreadsheetImportSchema } = await import('@/lib/validations/api');
      const result = spreadsheetImportSchema.safeParse({
        spreadsheetData: 'short',
        importType: 'spreadsheet',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('AI generator (generateCalculatorFromSpreadsheet)', () => {
    it('should be exported from interactive-generators', async () => {
      const module = await import('@/lib/ai/interactive-generators');
      expect(module.generateCalculatorFromSpreadsheet).toBeDefined();
      expect(typeof module.generateCalculatorFromSpreadsheet).toBe('function');
    });
  });

  describe('POST /api/lead-magnet/import - spreadsheet path', () => {
    it('should reject unauthenticated requests', async () => {
      (auth as jest.Mock).mockResolvedValue(null);
      const { POST } = await import('@/app/api/lead-magnet/import/route');
      const request = new Request('http://localhost:3000/api/lead-magnet/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spreadsheetData: sampleCSVData, importType: 'spreadsheet' }),
      });

      const response = await POST(request);
      expect(response.status).toBe(401);
    });

    it('should accept CSV data and create a calculator lead magnet', async () => {
      // Mock AI to return a valid CalculatorConfig
      mockAICreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: JSON.stringify(mockCalculatorConfig) }],
      });

      // Mock DB calls: insert lead magnet, slug check, insert funnel page
      mockSupabaseClient.single
        .mockResolvedValueOnce(createMockSupabaseResponse({ id: 'lm-calc-1', title: 'ROI Growth Calculator' }))
        .mockResolvedValueOnce(createMockSupabaseResponse(null))
        .mockResolvedValueOnce(createMockSupabaseResponse({ id: 'fp-calc-1' }));

      const { POST } = await import('@/app/api/lead-magnet/import/route');
      const request = new Request('http://localhost:3000/api/lead-magnet/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spreadsheetData: sampleCSVData,
          importType: 'spreadsheet',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.leadMagnetId).toBe('lm-calc-1');
      expect(data.funnelPageId).toBe('fp-calc-1');
      expect(data.archetype).toBe('single-calculator');
      expect(data.interactiveConfig).toBeDefined();
      expect(data.interactiveConfig.type).toBe('calculator');
      expect(data.interactiveConfig.inputs).toHaveLength(4);

      // Verify lead magnet was created with correct archetype
      const insertCall = mockSupabaseClient.insert.mock.calls[0][0];
      expect(insertCall.archetype).toBe('single-calculator');
      expect(insertCall.interactive_config).toBeDefined();
      expect(insertCall.interactive_config.type).toBe('calculator');
    });

    it('should return 400 for invalid spreadsheet data', async () => {
      const { POST } = await import('@/app/api/lead-magnet/import/route');
      const request = new Request('http://localhost:3000/api/lead-magnet/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spreadsheetData: 'too short',
          importType: 'spreadsheet',
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
    });

    it('should return AI error when calculator generation fails', async () => {
      mockAICreate.mockRejectedValueOnce(new Error('AI service unavailable'));

      const { POST } = await import('@/app/api/lead-magnet/import/route');
      const request = new Request('http://localhost:3000/api/lead-magnet/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spreadsheetData: sampleCSVData,
          importType: 'spreadsheet',
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.code).toBe('AI_GENERATION_ERROR');
    });

    it('should accept optional title and description', async () => {
      mockAICreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: JSON.stringify(mockCalculatorConfig) }],
      });

      mockSupabaseClient.single
        .mockResolvedValueOnce(createMockSupabaseResponse({ id: 'lm-2', title: 'Custom Calc' }))
        .mockResolvedValueOnce(createMockSupabaseResponse(null))
        .mockResolvedValueOnce(createMockSupabaseResponse({ id: 'fp-2' }));

      const { POST } = await import('@/app/api/lead-magnet/import/route');
      const request = new Request('http://localhost:3000/api/lead-magnet/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spreadsheetData: sampleCSVData,
          importType: 'spreadsheet',
          title: 'My Custom Calculator',
          description: 'Calculate marketing ROI',
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(201);
    });
  });

  describe('POST /api/lead-magnet/import - existing text/URL path (unchanged)', () => {
    it('should still reject requests without url or content', async () => {
      const { POST } = await import('@/app/api/lead-magnet/import/route');
      const request = new Request('http://localhost:3000/api/lead-magnet/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
    });

    it('should still create focused-toolkit for text/URL import', async () => {
      const Anthropic = require('@anthropic-ai/sdk');
      const mockCreate = jest.fn().mockResolvedValue({
        content: [{
          type: 'text',
          text: JSON.stringify({
            title: 'SEO Guide',
            headline: 'Master SEO in 30 Days',
            subline: 'Step-by-step framework',
            socialProof: 'Used by 500+ marketers',
            painSolved: 'Low organic traffic',
            format: 'PDF Guide',
          }),
        }],
      });
      Anthropic.mockImplementation(() => ({ messages: { create: mockCreate } }));

      mockSupabaseClient.single
        .mockResolvedValueOnce(createMockSupabaseResponse({ id: 'lm-text-1', title: 'SEO Guide' }))
        .mockResolvedValueOnce(createMockSupabaseResponse(null))
        .mockResolvedValueOnce(createMockSupabaseResponse({ id: 'fp-text-1' }));

      const { POST } = await import('@/app/api/lead-magnet/import/route');
      const request = new Request('http://localhost:3000/api/lead-magnet/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'An SEO guide for marketers' }),
      });

      const response = await POST(request);
      expect(response.status).toBe(201);

      const insertCall = mockSupabaseClient.insert.mock.calls[0][0];
      expect(insertCall.archetype).toBe('focused-toolkit');
    });
  });
});
