// Mock playwright - jest.mock is hoisted, so we cannot reference variables
// declared outside. We use jest.fn() directly and retrieve mocks from the
// module after import.
const mockScreenshot = jest.fn().mockResolvedValue(Buffer.from('fake-png-data'));
const mockGetAttribute = jest.fn().mockResolvedValue('Test Section');
const mockScrollIntoViewIfNeeded = jest.fn();
const mockWaitForTimeout = jest.fn();
const mockGoto = jest.fn();
const mockPageClose = jest.fn();
const mockBrowserClose = jest.fn();
const mockPageSelector = jest.fn();
const mockNewPage = jest.fn();
const mockLaunch = jest.fn();

jest.mock('playwright', () => {
  return {
    chromium: {
      launch: (...args: unknown[]) => mockLaunch(...args),
    },
  };
});

// Wire up the mock chain: launch -> browser -> newPage -> page
mockLaunch.mockResolvedValue({
  newPage: mockNewPage,
  close: mockBrowserClose,
});

const mockSectionElement = {
  scrollIntoViewIfNeeded: mockScrollIntoViewIfNeeded,
  getAttribute: mockGetAttribute,
};

mockNewPage.mockResolvedValue({
  goto: mockGoto,
  waitForTimeout: mockWaitForTimeout,
  screenshot: mockScreenshot,
  $: mockPageSelector,
  close: mockPageClose,
});

mockPageSelector.mockResolvedValue(mockSectionElement);

import {
  generateContentScreenshots,
  closeScreenshotBrowser,
} from '@/lib/services/screenshot';

describe('Screenshot Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Re-wire mock chain after clearAllMocks
    mockLaunch.mockResolvedValue({
      newPage: mockNewPage,
      close: mockBrowserClose,
    });

    mockNewPage.mockResolvedValue({
      goto: mockGoto,
      waitForTimeout: mockWaitForTimeout,
      screenshot: mockScreenshot,
      $: mockPageSelector,
      close: mockPageClose,
    });

    mockScreenshot.mockResolvedValue(Buffer.from('fake-png-data'));
    mockGetAttribute.mockResolvedValue('Test Section');
    mockPageSelector.mockResolvedValue(mockSectionElement);
  });

  afterEach(async () => {
    // Reset the cached browser between tests so each test gets a clean state
    await closeScreenshotBrowser();
    jest.clearAllMocks();
  });

  it('generates hero + section screenshots', async () => {
    const results = await generateContentScreenshots({
      pageUrl: 'http://localhost:3000/p/user/slug/content',
      sectionCount: 2,
    });

    // Hero + 2 sections = 3 results
    expect(results).toHaveLength(3);
    expect(results[0].type).toBe('hero');
    expect(results[1].type).toBe('section');
    expect(results[1].sectionIndex).toBe(0);
    expect(results[1].sectionName).toBe('Test Section');
    expect(results[2].type).toBe('section');
    expect(results[2].sectionIndex).toBe(1);
  });

  it('returns buffers for both sizes', async () => {
    const results = await generateContentScreenshots({
      pageUrl: 'http://localhost:3000/p/user/slug/content',
      sectionCount: 1,
    });

    expect(results[0].buffer1200x627).toBeInstanceOf(Buffer);
    expect(results[0].buffer1080x1080).toBeInstanceOf(Buffer);
  });

  it('navigates to the correct URL', async () => {
    await generateContentScreenshots({
      pageUrl: 'http://localhost:3000/p/testuser/my-magnet/content',
      sectionCount: 0,
    });

    expect(mockGoto).toHaveBeenCalledWith(
      'http://localhost:3000/p/testuser/my-magnet/content',
      { waitUntil: 'networkidle' }
    );
  });

  it('handles zero sections (hero only)', async () => {
    const results = await generateContentScreenshots({
      pageUrl: 'http://localhost:3000/p/user/slug/content',
      sectionCount: 0,
    });

    expect(results).toHaveLength(1);
    expect(results[0].type).toBe('hero');
  });

  it('skips sections that are not found in DOM', async () => {
    // First section found, second section not found
    mockPageSelector
      .mockResolvedValueOnce(mockSectionElement)
      .mockResolvedValueOnce(null);

    const results = await generateContentScreenshots({
      pageUrl: 'http://localhost:3000/p/user/slug/content',
      sectionCount: 2,
    });

    // Hero + 1 found section = 2 (second section was null)
    expect(results).toHaveLength(2);
  });

  it('closes the page after generation', async () => {
    await generateContentScreenshots({
      pageUrl: 'http://localhost:3000/p/user/slug/content',
      sectionCount: 0,
    });

    expect(mockPageClose).toHaveBeenCalled();
  });

  it('closes browser on cleanup', async () => {
    // Trigger browser creation first
    await generateContentScreenshots({
      pageUrl: 'http://localhost:3000/p/user/slug/content',
      sectionCount: 0,
    });

    await closeScreenshotBrowser();
    expect(mockBrowserClose).toHaveBeenCalled();
  });

  it('uses custom wait time', async () => {
    await generateContentScreenshots({
      pageUrl: 'http://localhost:3000/p/user/slug/content',
      sectionCount: 0,
      waitTime: 5000,
    });

    expect(mockWaitForTimeout).toHaveBeenCalledWith(5000);
  });

  it('uses default wait time of 3000ms', async () => {
    await generateContentScreenshots({
      pageUrl: 'http://localhost:3000/p/user/slug/content',
      sectionCount: 0,
    });

    expect(mockWaitForTimeout).toHaveBeenCalledWith(3000);
  });

  it('captures screenshots with correct clip dimensions', async () => {
    await generateContentScreenshots({
      pageUrl: 'http://localhost:3000/p/user/slug/content',
      sectionCount: 0,
    });

    // Hero generates two screenshots: 1200x627 and 1080x1080
    expect(mockScreenshot).toHaveBeenCalledWith({
      type: 'png',
      clip: { x: 0, y: 0, width: 1200, height: 627 },
    });
    expect(mockScreenshot).toHaveBeenCalledWith({
      type: 'png',
      clip: { x: 0, y: 0, width: 1080, height: 1080 },
    });
  });

  it('scrolls to section elements before capturing', async () => {
    await generateContentScreenshots({
      pageUrl: 'http://localhost:3000/p/user/slug/content',
      sectionCount: 1,
    });

    expect(mockPageSelector).toHaveBeenCalledWith('[data-section-index="0"]');
    expect(mockScrollIntoViewIfNeeded).toHaveBeenCalled();
  });

  it('falls back to default section name when attribute is missing', async () => {
    mockPageSelector.mockResolvedValue({
      scrollIntoViewIfNeeded: mockScrollIntoViewIfNeeded,
      getAttribute: jest.fn().mockResolvedValue(null),
    });

    const results = await generateContentScreenshots({
      pageUrl: 'http://localhost:3000/p/user/slug/content',
      sectionCount: 1,
    });

    expect(results[1].sectionName).toBe('Section 1');
  });
});
