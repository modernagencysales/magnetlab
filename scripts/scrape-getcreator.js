// getcreator.io Scraper -> MagnetLab PolishedContent
// Run with: node scripts/scrape-getcreator.js
// Outputs: scripts/push-getcreator-content.js (paste into browser console)

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const PAGES = [
  {
    leadMagnetId: 'df144e0c-45a8-48b3-8c48-3aff3cc2ddec',
    name: 'Gemini 3: Agency Sales System',
    url: 'https://app.getcreator.io/ResourceLibraryPage?id=695c1c7cbfd0842c2b9349fa'
  },
  {
    leadMagnetId: '0f6415fc-4519-4a25-acdf-1565603108b5',
    name: '60-Day LinkedIn Inbound System',
    url: 'https://app.getcreator.io/PublicLeadMagnet?id=6968b72969c207a8adda97aa'
  },
  {
    leadMagnetId: '45f87f59-f6c0-4116-a0b7-3968945e03ce',
    name: '$5M Claude Code Agency Sales Vault',
    url: 'https://app.getcreator.io/PromptLibraryPublicPage?id=6968b19d26f4c73d3ee1184f'
  }
];

async function scrapePage(browser, pageConfig) {
  var page = await browser.newPage();
  console.log('  Loading: ' + pageConfig.url);

  try {
    await page.goto(pageConfig.url, { waitUntil: 'networkidle', timeout: 30000 });
    // Extra wait for SPA content to render
    await page.waitForTimeout(3000);

    // Try to extract structured content from the page
    var content = await page.evaluate(function() {
      var sections = [];
      var currentSection = null;

      function ensureSection(name) {
        if (!currentSection) {
          currentSection = {
            id: 'section-' + sections.length,
            sectionName: name || 'Overview',
            introduction: '',
            blocks: [],
            keyTakeaway: ''
          };
          sections.push(currentSection);
        }
        return currentSection;
      }

      // Get the page title
      var title = '';
      var titleEl = document.querySelector('h1') || document.querySelector('[class*="title"]');
      if (titleEl) title = titleEl.textContent.trim();

      // Strategy: walk through all visible content elements
      var body = document.querySelector('main') || document.querySelector('[class*="content"]') || document.querySelector('[class*="page"]') || document.body;
      var elements = body.querySelectorAll('h1, h2, h3, h4, p, li, blockquote, [class*="card"], [class*="item"], [class*="resource"], [class*="prompt"], a[href]');

      var seenText = {};
      elements.forEach(function(el) {
        var text = el.textContent.trim();
        if (!text || text.length < 3 || seenText[text]) return;
        seenText[text] = true;

        var tag = el.tagName.toLowerCase();

        if (tag === 'h1' || tag === 'h2') {
          currentSection = {
            id: 'section-' + sections.length,
            sectionName: text.substring(0, 100),
            introduction: '',
            blocks: [],
            keyTakeaway: ''
          };
          sections.push(currentSection);
        } else if (tag === 'h3' || tag === 'h4') {
          ensureSection('Overview');
          currentSection.blocks.push({ type: 'paragraph', content: '### ' + text });
        } else if (tag === 'blockquote') {
          ensureSection('Overview');
          currentSection.blocks.push({ type: 'quote', content: text });
        } else if (tag === 'li') {
          ensureSection('Overview');
          currentSection.blocks.push({ type: 'paragraph', content: '- ' + text });
        } else if (tag === 'a' && el.href && !el.href.includes('getcreator.io')) {
          ensureSection('Overview');
          currentSection.blocks.push({
            type: 'callout',
            content: (text || 'Link') + '\n' + el.href,
            style: 'info'
          });
        } else if (text.length > 10) {
          ensureSection('Overview');
          if (!currentSection.introduction && currentSection.blocks.length === 0) {
            currentSection.introduction = text.substring(0, 500);
          } else {
            currentSection.blocks.push({ type: 'paragraph', content: text.substring(0, 2000) });
          }
        }
      });

      // If we got nothing from structured approach, grab all text
      if (sections.length === 0) {
        var allText = body.innerText || body.textContent || '';
        var lines = allText.split('\n').filter(function(l) { return l.trim().length > 5; });
        ensureSection(title || 'Content');
        currentSection.introduction = lines.slice(0, 2).join(' ');
        for (var i = 2; i < Math.min(lines.length, 50); i++) {
          currentSection.blocks.push({ type: 'paragraph', content: lines[i].trim() });
        }
      }

      return { title: title, sections: sections };
    });

    await page.close();
    return content;
  } catch (err) {
    await page.close();
    throw err;
  }
}

async function main() {
  console.log('Launching browser...');
  var browser = await chromium.launch({ headless: true });

  console.log('Scraping ' + PAGES.length + ' getcreator.io pages...\n');

  var results = [];
  var errors = [];

  for (var i = 0; i < PAGES.length; i++) {
    var pageConfig = PAGES[i];
    console.log('[' + (i + 1) + '/' + PAGES.length + '] ' + pageConfig.name);

    try {
      var content = await scrapePage(browser, pageConfig);
      var wordCount = 0;
      content.sections.forEach(function(s) {
        wordCount += (s.introduction || '').split(/\s+/).length;
        s.blocks.forEach(function(b) {
          wordCount += (b.content || '').split(/\s+/).length;
        });
      });

      console.log('  OK - ' + content.sections.length + ' sections, ' + wordCount + ' words');

      results.push({
        leadMagnetId: pageConfig.leadMagnetId,
        name: pageConfig.name,
        content: {
          version: 1,
          polishedAt: new Date().toISOString(),
          heroSummary: content.sections[0] ? content.sections[0].introduction.substring(0, 200) : pageConfig.name,
          sections: content.sections,
          metadata: {
            readingTimeMinutes: Math.max(1, Math.ceil(wordCount / 200)),
            wordCount: wordCount
          }
        }
      });
    } catch (err) {
      console.error('  ERROR: ' + err.message);
      errors.push({ name: pageConfig.name, error: err.message });
    }
  }

  await browser.close();

  console.log('\nScraped: ' + results.length + '/' + PAGES.length + ' (' + errors.length + ' errors)');

  if (errors.length > 0) {
    console.log('\nErrors:');
    errors.forEach(function(e) {
      console.log('  - ' + e.name + ': ' + e.error);
    });
  }

  // Generate browser console script
  var script = '(async () => {\n';
  script += '  var items = ' + JSON.stringify(results.map(function(r) {
    return { id: r.leadMagnetId, name: r.name, content: r.content };
  })) + ';\n\n';
  script += '  console.log("Pushing content for " + items.length + " getcreator.io pages...");\n';
  script += '  var success = 0, errors = 0;\n';
  script += '  for (var i = 0; i < items.length; i++) {\n';
  script += '    var item = items[i];\n';
  script += '    console.log("Pushing: " + item.name + "...");\n';
  script += '    try {\n';
  script += '      var res = await fetch("/api/lead-magnet/" + item.id + "/content", {\n';
  script += '        method: "PUT",\n';
  script += '        headers: { "Content-Type": "application/json" },\n';
  script += '        body: JSON.stringify({ polishedContent: item.content })\n';
  script += '      });\n';
  script += '      if (!res.ok) {\n';
  script += '        var data = await res.json();\n';
  script += '        throw new Error(res.status + ": " + JSON.stringify(data));\n';
  script += '      }\n';
  script += '      console.log("  Done");\n';
  script += '      success++;\n';
  script += '    } catch (err) {\n';
  script += '      console.error("  Error: " + err.message);\n';
  script += '      errors++;\n';
  script += '    }\n';
  script += '    await new Promise(function(r) { setTimeout(r, 300); });\n';
  script += '  }\n';
  script += '  console.log("\\nComplete! " + success + "/" + items.length + " pushed (" + errors + " errors)");\n';
  script += '})();\n';

  var outputPath = path.join(__dirname, 'push-getcreator-content.js');
  fs.writeFileSync(outputPath, script, 'utf-8');
  console.log('\nBrowser script saved to: ' + outputPath);
  console.log('Open that file, copy all, and paste into the browser console at magnetlab.app');
}

main().catch(function(err) {
  console.error('Fatal error:', err);
  process.exit(1);
});
