/**
 * Spreadsheet Parser (MOD-92)
 *
 * Parses CSV text into a structured representation of inputs, formulas,
 * and outputs for conversion to interactive calculator lead magnets.
 */

export interface SpreadsheetInput {
  label: string;
  type: 'number' | 'select' | 'slider';
  unit?: string;
  min?: number;
  max?: number;
}

export interface SpreadsheetFormula {
  label: string;
  expression: string;
}

export interface SpreadsheetOutput {
  label: string;
  expression: string;
  format: 'number' | 'currency' | 'percentage';
}

export interface ParsedSpreadsheet {
  inputs: SpreadsheetInput[];
  formulas: SpreadsheetFormula[];
  outputs: SpreadsheetOutput[];
  rawHeaders: string[];
  rawRowCount: number;
}

/**
 * Parse a single CSV line, respecting quoted fields.
 */
function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  fields.push(current.trim());
  return fields;
}

/**
 * Detect if a row is a header row.
 */
function isHeaderRow(fields: string[]): boolean {
  const headerKeywords = ['input', 'output', 'label', 'type', 'value', 'formula', 'field', 'role', 'name', 'description'];
  const lowerFields = fields.map(f => f.toLowerCase());
  return lowerFields.some(f => headerKeywords.includes(f)) ||
    lowerFields.some(f => headerKeywords.some(kw => f.includes(kw)));
}

/**
 * Infer unit from a label string.
 */
function inferUnit(label: string): string | undefined {
  const lower = label.toLowerCase();
  if (lower.includes('$') || lower.includes('revenue') || lower.includes('cost') ||
      lower.includes('price') || lower.includes('salary') || lower.includes('budget') ||
      lower.includes('spend') || lower.includes('income')) {
    return '$';
  }
  if (lower.includes('%') || lower.includes('rate') || lower.includes('percentage') ||
      lower.includes('percent') || lower.includes('ratio')) {
    return '%';
  }
  return undefined;
}

/**
 * Infer output format from label and expression.
 */
function inferFormat(label: string, expression: string): 'number' | 'currency' | 'percentage' {
  const text = `${label} ${expression}`.toLowerCase();
  if (text.includes('%') || text.includes('percentage') || text.includes('rate') || text.includes('percent')) {
    return 'percentage';
  }
  if (text.includes('$') || text.includes('revenue') || text.includes('cost') ||
      text.includes('price') || text.includes('roi') || text.includes('profit') ||
      text.includes('salary') || text.includes('income')) {
    return 'currency';
  }
  return 'number';
}

/**
 * Classify a row's role based on its first field.
 */
function classifyRole(role: string): 'input' | 'formula' | 'output' | null {
  const lower = role.toLowerCase().trim();
  if (lower === 'input' || lower === 'in') return 'input';
  if (lower === 'formula' || lower === 'calculated' || lower === 'calc') return 'formula';
  if (lower === 'output' || lower === 'out' || lower === 'result') return 'output';
  return null;
}

/**
 * Parse CSV text into a structured spreadsheet representation.
 *
 * Supports two formats:
 * 1. Structured: rows with Role (input/formula/output), Label, Type, Value/Formula columns
 * 2. Unstructured: plain data table where columns become inputs
 *
 * @throws Error if CSV has fewer than 2 rows or no columns
 */
export function parseSpreadsheet(csvText: string): ParsedSpreadsheet {
  const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);

  if (lines.length < 2) {
    throw new Error('Spreadsheet must have at least 2 rows (header + data)');
  }

  const allRows = lines.map(parseCSVLine);

  if (allRows[0].length === 0) {
    throw new Error('No columns detected in spreadsheet');
  }

  // Skip header row if detected
  let startIndex = 0;
  const rawHeaders = allRows[0];
  if (isHeaderRow(rawHeaders)) {
    startIndex = 1;
  }

  const inputs: SpreadsheetInput[] = [];
  const formulas: SpreadsheetFormula[] = [];
  const outputs: SpreadsheetOutput[] = [];

  // Try structured format (role-based classification)
  for (let i = startIndex; i < allRows.length; i++) {
    const fields = allRows[i];
    if (fields.length < 2) continue;

    const role = classifyRole(fields[0]);
    if (!role) continue;

    const label = fields[1] || `Field ${i}`;
    const expression = fields.length >= 4 ? fields[3] : (fields.length >= 3 ? fields[2] : '');

    switch (role) {
      case 'input': {
        const unit = inferUnit(label);
        inputs.push({
          label,
          type: 'number',
          unit,
          ...(unit === '%' ? { min: 0, max: 100 } : {}),
        });
        break;
      }
      case 'formula':
        formulas.push({ label, expression });
        break;
      case 'output':
        outputs.push({
          label,
          expression,
          format: inferFormat(label, expression),
        });
        break;
    }
  }

  // Fallback: unstructured CSV -- treat columns as inputs
  if (inputs.length === 0 && formulas.length === 0 && outputs.length === 0) {
    for (const header of rawHeaders) {
      if (header.trim()) {
        const unit = inferUnit(header);
        inputs.push({
          label: header.trim(),
          type: 'number',
          unit,
          ...(unit === '%' ? { min: 0, max: 100 } : {}),
        });
      }
    }
  }

  return {
    inputs,
    formulas,
    outputs,
    rawHeaders,
    rawRowCount: lines.length,
  };
}
