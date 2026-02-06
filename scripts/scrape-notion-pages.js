// Notion Public Page Scraper -> MagnetLab PolishedContent
// Run with: node scripts/scrape-notion-pages.js
// Outputs: scripts/push-notion-content.js (paste into browser console)

const https = require('https');
const fs = require('fs');
const path = require('path');

// Notion pages to scrape with their lead magnet IDs
const PAGES = [
  {
    leadMagnetId: 'ce17fc03-aea0-4cda-821d-26d7b93e4911',
    name: '7-Figure Lead Magnet Method',
    notionHost: 'meadow-leader-47c.notion.site',
    pageId: '28581f7d-c527-8051-8d95-caa8d8a70e0a'
  },
  {
    leadMagnetId: '7b138303-ba63-47cc-afbc-274deb3c1a59',
    name: '7-Figure Agency Sales System Library',
    notionHost: 'courselaunchr.notion.site',
    pageId: '2edf971f-c677-8095-ac7e-d13fb14f77a3'
  },
  {
    leadMagnetId: '29d95003-d53b-4ed8-8748-8bc1b5216a26',
    name: '$1M+ Lead Magnet Swipefile (6 Templates)',
    notionHost: 'unexpected-pyroraptor-13c.notion.site',
    pageId: '2767aba7-ab66-812d-b1a3-cae8cf3d9f6b'
  },
  {
    leadMagnetId: '03235a60-4daa-424e-8efc-f03855474af2',
    name: '30-Day LinkedIn Speed-run System',
    notionHost: 'meadow-leader-47c.notion.site',
    pageId: '29581f7d-c527-8013-869f-e2596c11487c'
  },
  {
    leadMagnetId: 'b6de9f0d-9eab-439e-885c-5878e65f974d',
    name: 'LinkedIn Inbound Playbook',
    notionHost: 'unexpected-pyroraptor-13c.notion.site',
    pageId: '26d7aba7-ab66-8091-9398-df9410912571'
  },
  {
    leadMagnetId: '1faa51c4-cfaf-4219-bb06-563406985c03',
    name: 'LinkedIn Foundations Pack',
    notionHost: 'courselaunchr.notion.site',
    pageId: '2f1f971f-c677-80b4-a688-eae03ebe7fe7'
  },
  {
    leadMagnetId: '23b2c5c1-3400-4ffa-91ca-dd818898037e',
    name: 'Top 1% LinkedIn Content Pack',
    notionHost: 'courselaunchr.notion.site',
    pageId: '2f1f971f-c677-805d-a8d7-c9dcf3fa60a1'
  },
  {
    leadMagnetId: '38c240a3-01ec-468f-b535-76f86242e7bc',
    name: '$5M AI Lead Magnet Machine Pack',
    notionHost: 'courselaunchr.notion.site',
    pageId: '2f1f971f-c677-8014-bf49-f190b8f1c95c'
  },
  {
    leadMagnetId: '7c280fba-1e44-4cea-9d79-41ef3e6a1235',
    name: 'Zero to One Offer and Close Pack',
    notionHost: 'courselaunchr.notion.site',
    pageId: '2f1f971f-c677-8025-a202-d006fe2bdc57'
  },
  {
    // Same Notion page as #3 ($1M+ Swipefile) - reuse content
    leadMagnetId: 'f9233ffb-674d-42df-aabd-ebefb1822349',
    name: '$5M Lead Magnet Swipe File (10,000 Leads)',
    notionHost: 'unexpected-pyroraptor-13c.notion.site',
    pageId: '2767aba7-ab66-812d-b1a3-cae8cf3d9f6b'
  },
  {
    leadMagnetId: '452ae0f9-ff6e-4574-9900-6bb503f32be6',
    name: 'Build Your Own AI Assistant',
    notionHost: 'courselaunchr.notion.site',
    pageId: '2f4f971f-c677-8070-80a9-f62faf169076'
  }
];

// Fetch JSON via HTTPS POST
function fetchJSON(host, path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = https.request({
      hostname: host,
      path: path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    }, (res) => {
      let chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString()));
        } catch (e) {
          reject(new Error('Failed to parse JSON: ' + Buffer.concat(chunks).toString().substring(0, 200)));
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// Extract text from Notion rich text array
function extractText(richText) {
  if (!richText) return '';
  if (typeof richText === 'string') return richText;
  if (!Array.isArray(richText)) return '';
  return richText.map(function(segment) {
    if (typeof segment === 'string') return segment;
    if (Array.isArray(segment)) return segment[0] || '';
    return '';
  }).join('');
}

// Convert Notion blocks to PolishedContent sections
function blocksToSections(blocks, blockMap) {
  var sections = [];
  var currentSection = null;
  var pendingListItems = [];

  function flushList() {
    if (pendingListItems.length > 0 && currentSection) {
      currentSection.blocks.push({
        type: 'list',
        content: pendingListItems.join('\n')
      });
      pendingListItems = [];
    }
  }

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
  }

  for (var i = 0; i < blocks.length; i++) {
    var blockId = blocks[i];
    var blockData = blockMap[blockId];
    if (!blockData || !blockData.value) continue;

    var block = blockData.value;
    var type = block.type;
    var text = extractText(block.properties && block.properties.title);

    if (type === 'header' || type === 'sub_header') {
      flushList();
      // Start new section
      currentSection = {
        id: 'section-' + sections.length,
        sectionName: text || 'Section',
        introduction: '',
        blocks: [],
        keyTakeaway: ''
      };
      sections.push(currentSection);
    } else if (type === 'sub_sub_header') {
      flushList();
      ensureSection('Overview');
      currentSection.blocks.push({
        type: 'paragraph',
        content: '### ' + text
      });
    } else if (type === 'text' || type === 'paragraph') {
      flushList();
      if (text.trim()) {
        ensureSection('Overview');
        // Check if first block in section and no introduction yet
        if (currentSection.blocks.length === 0 && !currentSection.introduction) {
          currentSection.introduction = text;
        } else {
          currentSection.blocks.push({ type: 'paragraph', content: text });
        }
      }
    } else if (type === 'bulleted_list' || type === 'numbered_list') {
      ensureSection('Overview');
      pendingListItems.push('- ' + text);
      // Process children if any
      if (block.content && block.content.length > 0) {
        for (var j = 0; j < block.content.length; j++) {
          var childData = blockMap[block.content[j]];
          if (childData && childData.value && childData.value.properties) {
            var childText = extractText(childData.value.properties.title);
            if (childText.trim()) {
              pendingListItems.push('  - ' + childText);
            }
          }
        }
      }
    } else if (type === 'callout') {
      flushList();
      ensureSection('Overview');
      currentSection.blocks.push({
        type: 'callout',
        content: text,
        style: 'info'
      });
    } else if (type === 'quote') {
      flushList();
      ensureSection('Overview');
      currentSection.blocks.push({ type: 'quote', content: text });
    } else if (type === 'divider') {
      flushList();
      ensureSection('Overview');
      currentSection.blocks.push({ type: 'divider', content: '' });
    } else if (type === 'toggle') {
      flushList();
      ensureSection('Overview');
      currentSection.blocks.push({ type: 'paragraph', content: text });
      // Process toggle children
      if (block.content && block.content.length > 0) {
        for (var k = 0; k < block.content.length; k++) {
          var toggleChild = blockMap[block.content[k]];
          if (toggleChild && toggleChild.value && toggleChild.value.properties) {
            var toggleText = extractText(toggleChild.value.properties.title);
            if (toggleText.trim()) {
              currentSection.blocks.push({ type: 'paragraph', content: toggleText });
            }
          }
        }
      }
    } else if (type === 'image') {
      flushList();
      ensureSection('Overview');
      var src = '';
      if (block.properties && block.properties.source) {
        src = extractText(block.properties.source);
      } else if (block.format && block.format.display_source) {
        src = block.format.display_source;
      }
      if (src) {
        currentSection.blocks.push({ type: 'paragraph', content: '![image](' + src + ')' });
      }
    } else if (type === 'bookmark' || type === 'link_to_page' || type === 'embed') {
      flushList();
      ensureSection('Overview');
      var link = '';
      if (block.properties && block.properties.link) {
        link = extractText(block.properties.link);
      } else if (block.format && block.format.bookmark_link) {
        link = block.format.bookmark_link;
      } else if (block.format && block.format.display_source) {
        link = block.format.display_source;
      }
      var caption = text || link;
      if (link) {
        currentSection.blocks.push({ type: 'callout', content: caption + '\n' + link, style: 'info' });
      }
    } else if (type === 'child_page' || type === 'page') {
      flushList();
      // Treat as a new section with the page title
      var pageTitle = text || 'Untitled';
      currentSection = {
        id: 'section-' + sections.length,
        sectionName: pageTitle,
        introduction: 'See: ' + pageTitle,
        blocks: [],
        keyTakeaway: ''
      };
      sections.push(currentSection);
    }
  }

  // Final flush
  flushList();

  // If no sections were created, add a default one
  if (sections.length === 0) {
    sections.push({
      id: 'section-0',
      sectionName: 'Content',
      introduction: 'Content from this resource.',
      blocks: [],
      keyTakeaway: ''
    });
  }

  return sections;
}

// Scrape a single Notion page
async function scrapePage(pageConfig) {
  console.log('  Fetching blocks from Notion...');

  var result = await fetchJSON(pageConfig.notionHost, '/api/v3/loadPageChunk', {
    page: { id: pageConfig.pageId },
    limit: 200,
    cursor: { stack: [] },
    chunkNumber: 0,
    verticalColumns: false
  });

  if (!result.recordMap || !result.recordMap.block) {
    throw new Error('No blocks returned from Notion API');
  }

  var blockMap = result.recordMap.block;
  var pageBlock = blockMap[pageConfig.pageId];

  if (!pageBlock || !pageBlock.value) {
    throw new Error('Page block not found');
  }

  var contentIds = pageBlock.value.content || [];
  var title = extractText(pageBlock.value.properties && pageBlock.value.properties.title) || pageConfig.name;

  console.log('  Found ' + contentIds.length + ' blocks, title: ' + title);

  var sections = blocksToSections(contentIds, blockMap);

  // Build hero summary from first section intro
  var heroSummary = sections[0] ? sections[0].introduction : title;
  if (heroSummary.length > 200) {
    heroSummary = heroSummary.substring(0, 197) + '...';
  }

  // Count words
  var wordCount = 0;
  sections.forEach(function(s) {
    wordCount += (s.introduction || '').split(/\s+/).length;
    s.blocks.forEach(function(b) {
      wordCount += (b.content || '').split(/\s+/).length;
    });
  });

  return {
    version: 1,
    polishedAt: new Date().toISOString(),
    heroSummary: heroSummary,
    sections: sections,
    metadata: {
      readingTimeMinutes: Math.max(1, Math.ceil(wordCount / 200)),
      wordCount: wordCount
    }
  };
}

// Main
async function main() {
  console.log('Scraping ' + PAGES.length + ' Notion pages...\n');

  var results = [];
  var errors = [];

  for (var i = 0; i < PAGES.length; i++) {
    var page = PAGES[i];
    console.log('[' + (i + 1) + '/' + PAGES.length + '] ' + page.name);

    try {
      var content = await scrapePage(page);
      console.log('  OK - ' + content.sections.length + ' sections, ' + content.metadata.wordCount + ' words');
      results.push({
        leadMagnetId: page.leadMagnetId,
        name: page.name,
        content: content
      });
    } catch (err) {
      console.error('  ERROR: ' + err.message);
      errors.push({ name: page.name, error: err.message });
    }

    // Delay between requests
    await new Promise(function(r) { setTimeout(r, 500); });
  }

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
  script += '  console.log("Pushing content for " + items.length + " Notion pages...");\n';
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

  var outputPath = path.join(__dirname, 'push-notion-content.js');
  fs.writeFileSync(outputPath, script, 'utf-8');
  console.log('\nBrowser script saved to: ' + outputPath);
  console.log('Open that file, copy all, and paste into the browser console at magnetlab.app');
}

main().catch(function(err) {
  console.error('Fatal error:', err);
  process.exit(1);
});
