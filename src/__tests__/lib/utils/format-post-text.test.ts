import { formatPostText } from '@/lib/utils/format-post-text';

describe('formatPostText', () => {
  it('returns empty string for empty input', () => {
    expect(formatPostText('')).toBe('');
  });

  it('preserves text that already has newlines', () => {
    const text = 'First line.\nSecond line.';
    expect(formatPostText(text)).toBe(text);
  });

  it('adds line breaks after sentences', () => {
    const input = 'First sentence. Second sentence. Third sentence.';
    const expected = 'First sentence.\nSecond sentence.\nThird sentence.';
    expect(formatPostText(input)).toBe(expected);
  });

  it('splits on exclamation marks', () => {
    const input = 'Wow! This is great. Amazing work!';
    expect(formatPostText(input)).toBe('Wow!\nThis is great.\nAmazing work!');
  });

  it('splits on question marks', () => {
    const input = 'Why? Because it works. Do you agree?';
    expect(formatPostText(input)).toBe('Why?\nBecause it works.\nDo you agree?');
  });

  it('does not split after abbreviations', () => {
    const input = 'Dr. Smith is here. He arrived today.';
    expect(formatPostText(input)).toBe('Dr. Smith is here.\nHe arrived today.');
  });

  it('does not split after single-letter initials', () => {
    const input = 'J. K. Rowling wrote that. She is famous.';
    expect(formatPostText(input)).toBe('J. K. Rowling wrote that.\nShe is famous.');
  });

  it('does not split after numbers', () => {
    const input = 'Revenue grew 3. 5x compared to last year.';
    // The "3." looks like a number, so don't split
    expect(formatPostText(input)).toBe('Revenue grew 3. 5x compared to last year.');
  });

  it('handles the Agile example from real data', () => {
    const input = 'Agile does not fix poor leadership Agile does not fix poor management Agile does not fix lack of engagement';
    // No sentence-ending punctuation, so no splits (this is expected — can't split without periods)
    expect(formatPostText(input)).toBe(input);
  });

  it('handles LinkedIn-style post with periods', () => {
    const input = 'I spent 10 years in sales. Here are 5 lessons I learned. Number 1: Always follow up. Number 2: Listen more.';
    const expected = 'I spent 10 years in sales.\nHere are 5 lessons I learned.\nNumber 1: Always follow up.\nNumber 2: Listen more.';
    expect(formatPostText(input)).toBe(expected);
  });

  it('does not split when followed by lowercase', () => {
    const input = 'This costs $5.50 per unit. Very affordable.';
    // "50" starts lowercase, so no split there; split after "unit."
    expect(formatPostText(input)).toBe('This costs $5.50 per unit.\nVery affordable.');
  });
});
