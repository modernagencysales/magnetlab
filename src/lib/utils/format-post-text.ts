/**
 * Reformat scraped LinkedIn post text to restore line breaks.
 *
 * Bright Data strips newlines from post_text, leaving sentences
 * jammed together. This heuristic inserts \n after sentence-ending
 * punctuation followed by a space and an uppercase letter.
 *
 * It avoids splitting on common abbreviations (Dr., Mr., etc.)
 * and preserves any existing newlines.
 */

const ABBREVIATIONS = new Set([
  'Dr', 'Mr', 'Mrs', 'Ms', 'Jr', 'Sr', 'Prof', 'Rev',
  'St', 'Ave', 'Blvd', 'vs', 'etc', 'Inc', 'Ltd', 'Corp',
  'Jan', 'Feb', 'Mar', 'Apr', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  'No', 'Vol', 'Dept', 'Univ', 'Gen', 'Gov', 'Sgt', 'Cpl',
]);

export function formatPostText(text: string): string {
  if (!text) return text;

  // If the text already has newlines, it's already formatted
  if (text.includes('\n')) return text;

  // Match: (word before period)(. or ! or ?)(space+)(uppercase letter)
  // Capture the preceding word to check for abbreviations
  return text.replace(
    /(\S+)([.!?])\s+([A-Z])/g,
    (_match, prevWord: string, punct: string, nextChar: string) => {
      // Don't split after abbreviations
      if (punct === '.' && ABBREVIATIONS.has(prevWord)) {
        return `${prevWord}${punct} ${nextChar}`;
      }
      // Don't split after single letters (initials like "J. K. Rowling")
      if (punct === '.' && prevWord.length === 1) {
        return `${prevWord}${punct} ${nextChar}`;
      }
      // Don't split after numbers (e.g. "3.5 Million" — but "won 3. Now" should split)
      // Only skip if the next part looks like a decimal continuation
      if (punct === '.' && /\d$/.test(prevWord)) {
        return `${prevWord}${punct} ${nextChar}`;
      }
      return `${prevWord}${punct}\n${nextChar}`;
    }
  );
}
