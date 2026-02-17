import { schedules, logger } from '@trigger.dev/sdk/v3';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { generateEmbedding, cosineSimilarity } from '@/lib/ai/embeddings';
import { fetchAllSopFiles, fetchSidebars, commitChanges } from '@/lib/ai/playbook-sync/github-client';
import type { FileChange } from '@/lib/ai/playbook-sync/github-client';
import { syncSopEmbeddings } from '@/lib/ai/playbook-sync/sop-embeddings';
import type { CachedSop } from '@/lib/ai/playbook-sync/sop-embeddings';
import { classifyKnowledgeForSop } from '@/lib/ai/playbook-sync/classifier';
import type { ClassificationResult } from '@/lib/ai/playbook-sync/classifier';
import { generateSopEdit } from '@/lib/ai/playbook-sync/edit-generator';
import type { GeneratedEdit } from '@/lib/ai/playbook-sync/edit-generator';
import { clusterOrphans, generateNewSop } from '@/lib/ai/playbook-sync/sop-creator';
import type { KnowledgeEntry } from '@/lib/types/content-pipeline';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SIMILARITY_THRESHOLD = 0.75;

const EXISTING_MODULES = [
  'module-0-positioning',
  'module-1-lead-magnets',
  'module-2-tam-building',
  'module-3-linkedin-outreach',
  'module-4-cold-email',
  'module-5-linkedin-ads',
  'module-6-operating-system',
  'module-7-daily-content',
];

// ---------------------------------------------------------------------------
// Helper: apply an edit to SOP content
// ---------------------------------------------------------------------------

/**
 * Find the anchor text (edit.insert_after) in the SOP and insert
 * edit.new_content after it. Falls back to fuzzy matching if exact match fails.
 */
function applyEdit(sopContent: string, edit: GeneratedEdit): string {
  const anchor = edit.insert_after;

  // Exact match first
  const exactIdx = sopContent.indexOf(anchor);
  if (exactIdx !== -1) {
    const insertionPoint = exactIdx + anchor.length;
    return (
      sopContent.slice(0, insertionPoint) +
      '\n\n' +
      edit.new_content +
      '\n' +
      sopContent.slice(insertionPoint)
    );
  }

  // Fuzzy fallback: find the line with the highest overlap
  logger.warn('Exact anchor not found, trying fuzzy match', {
    anchor: anchor.slice(0, 80),
  });

  const lines = sopContent.split('\n');
  const anchorLower = anchor.toLowerCase().trim();
  const anchorWords = new Set(anchorLower.split(/\s+/));

  let bestScore = 0;
  let bestLineIdx = -1;

  for (let i = 0; i < lines.length; i++) {
    const lineLower = lines[i].toLowerCase().trim();
    if (lineLower.length === 0) continue;

    // Check substring containment in both directions
    if (lineLower.includes(anchorLower) || anchorLower.includes(lineLower)) {
      bestLineIdx = i;
      break;
    }

    // Jaccard word overlap
    const lineWords = new Set(lineLower.split(/\s+/));
    const intersection = [...anchorWords].filter((w) => lineWords.has(w)).length;
    const union = new Set([...anchorWords, ...lineWords]).size;
    const score = union > 0 ? intersection / union : 0;

    if (score > bestScore) {
      bestScore = score;
      bestLineIdx = i;
    }
  }

  if (bestLineIdx >= 0 && bestScore >= 0.4) {
    logger.info('Fuzzy match found', {
      line: lines[bestLineIdx].slice(0, 80),
      score: bestScore,
    });
    // Insert after the matched line
    const before = lines.slice(0, bestLineIdx + 1).join('\n');
    const after = lines.slice(bestLineIdx + 1).join('\n');
    return before + '\n\n' + edit.new_content + '\n' + after;
  }

  // Last resort: append to end
  logger.warn('No suitable anchor found, appending to end');
  return sopContent + '\n\n' + edit.new_content + '\n';
}

// ---------------------------------------------------------------------------
// Helper: add a new SOP entry to sidebars.js
// ---------------------------------------------------------------------------

/**
 * Insert a new SOP entry into the correct module category in sidebars.js.
 * Expects sidebars.js to contain arrays of items grouped by module folder name.
 */
function addToSidebars(
  sidebarsContent: string,
  moduleName: string,
  sopId: string
): string {
  // Look for the module section in sidebars.js
  // Pattern: items: [ ... ] inside a block that mentions the module name
  const modulePattern = new RegExp(
    `(${moduleName.replace(/[-/]/g, '[-/]')}[^\\]]*items:\\s*\\[)([^\\]]*)\\]`,
    's'
  );

  const match = sidebarsContent.match(modulePattern);
  if (match) {
    const existingItems = match[2].trimEnd();
    const separator = existingItems.length > 0 && !existingItems.endsWith(',') ? ',' : '';
    const newEntry = `\n          'sops/${moduleName}/${sopId}',`;
    return sidebarsContent.replace(
      modulePattern,
      `${match[1]}${existingItems}${separator}${newEntry}\n        ]`
    );
  }

  // Fallback: look for a simpler pattern where items are listed directly
  // Try to find the module name and append after its last entry
  const simplePattern = new RegExp(
    `('sops/${moduleName}/[^']*',?)([^\\]]*?)\\]`,
    's'
  );
  const simpleMatch = sidebarsContent.match(simplePattern);
  if (simpleMatch) {
    const insertAfter = simpleMatch[0];
    const lastBracket = insertAfter.lastIndexOf(']');
    const beforeBracket = insertAfter.slice(0, lastBracket);
    const newEntry = `\n          'sops/${moduleName}/${sopId}',`;
    return sidebarsContent.replace(
      insertAfter,
      beforeBracket + newEntry + '\n        ]'
    );
  }

  // If no module section found, log a warning and return unchanged
  logger.warn('Could not find module section in sidebars.js', { moduleName });
  return sidebarsContent;
}

// ---------------------------------------------------------------------------
// Main scheduled task
// ---------------------------------------------------------------------------

export const playbookSync = schedules.task({
  id: 'playbook-sync',
  cron: '0 0 * * 0', // Sunday midnight UTC
  maxDuration: 900, // 15 minutes
  retry: { maxAttempts: 1 },
  run: async () => {
    const supabase = createSupabaseAdminClient();

    // -----------------------------------------------------------------------
    // Step 1: Determine knowledge window
    // -----------------------------------------------------------------------
    logger.info('Step 1: Determining knowledge window');

    const { data: lastSuccessRun } = await supabase
      .from('cp_playbook_sync_runs')
      .select('run_at')
      .in('status', ['success', 'partial'])
      .order('run_at', { ascending: false })
      .limit(1)
      .single();

    const windowStart = lastSuccessRun?.run_at || '2020-01-01T00:00:00Z';

    // Create a new run record
    const { data: currentRun, error: runError } = await supabase
      .from('cp_playbook_sync_runs')
      .insert({
        status: 'running',
        run_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (runError || !currentRun) {
      logger.error('Failed to create sync run record', { error: runError?.message });
      throw new Error(`Failed to create sync run: ${runError?.message}`);
    }

    const runId = currentRun.id;
    logger.info('Created sync run', { runId, windowStart });

    // Stats to accumulate
    let entriesProcessed = 0;
    let entriesEnriched = 0;
    let entriesRedundant = 0;
    let entriesOrphaned = 0;
    const sopsEnriched: string[] = [];
    const sopsCreated: string[] = [];
    const errors: string[] = [];

    try {
      // -------------------------------------------------------------------
      // Step 2: Fetch new knowledge entries + prior orphans
      // -------------------------------------------------------------------
      logger.info('Step 2: Fetching knowledge entries', { windowStart });

      const { data: newEntries } = await supabase
        .from('cp_knowledge_entries')
        .select('*')
        .gt('created_at', windowStart)
        .order('created_at', { ascending: true });

      // Fetch prior orphans that might now match new SOPs
      const { data: priorOrphanMatches } = await supabase
        .from('cp_knowledge_sop_matches')
        .select('knowledge_entry_id')
        .eq('action', 'orphaned');

      const orphanEntryIds = [
        ...new Set(priorOrphanMatches?.map((m) => m.knowledge_entry_id) || []),
      ];

      let orphanEntries: KnowledgeEntry[] = [];
      if (orphanEntryIds.length > 0) {
        const { data: fetchedOrphans } = await supabase
          .from('cp_knowledge_entries')
          .select('*')
          .in('id', orphanEntryIds);
        orphanEntries = (fetchedOrphans as KnowledgeEntry[]) || [];
      }

      // Combine new entries + prior orphans (deduplicated)
      const newEntryIds = new Set((newEntries || []).map((e) => e.id));
      const allEntries: KnowledgeEntry[] = [
        ...((newEntries as KnowledgeEntry[]) || []),
        ...orphanEntries.filter((e) => !newEntryIds.has(e.id)),
      ];

      logger.info('Entries to process', {
        newEntries: newEntries?.length || 0,
        priorOrphans: orphanEntries.length,
        total: allEntries.length,
      });

      if (allEntries.length === 0) {
        logger.info('No entries to process, marking run as success');
        await supabase
          .from('cp_playbook_sync_runs')
          .update({
            status: 'success',
            entries_processed: 0,
            entries_enriched: 0,
            entries_redundant: 0,
            entries_orphaned: 0,
            sops_enriched: [],
            sops_created: [],
          })
          .eq('id', runId);
        return { status: 'success', entriesProcessed: 0, message: 'No new entries' };
      }

      // -------------------------------------------------------------------
      // Step 3: Fetch and embed SOPs
      // -------------------------------------------------------------------
      logger.info('Step 3: Fetching and embedding SOPs');

      const sopFiles = await fetchAllSopFiles();
      logger.info('Fetched SOP files', { count: sopFiles.length });

      const cachedSops = await syncSopEmbeddings(sopFiles);
      logger.info('SOP embeddings synced', { count: cachedSops.length });

      // Build a lookup map: filePath -> CachedSop
      const sopByPath = new Map<string, CachedSop>();
      for (const sop of cachedSops) {
        sopByPath.set(sop.filePath, sop);
      }

      // -------------------------------------------------------------------
      // Step 4: Match and classify each entry
      // -------------------------------------------------------------------
      logger.info('Step 4: Matching and classifying entries');

      // Grouped enrichments by SOP file path
      const enrichmentsBySop = new Map<
        string,
        { entries: KnowledgeEntry[]; targetSections: string[] }
      >();
      const orphanedEntries: KnowledgeEntry[] = [];

      for (const entry of allEntries) {
        entriesProcessed++;

        try {
          // Generate embedding for the entry
          const entryText = `${entry.category}: ${entry.content}\nContext: ${entry.context || 'N/A'}`;
          const entryEmbedding = await generateEmbedding(entryText);

          // Find best matching SOP by cosine similarity
          let bestSop: CachedSop | null = null;
          let bestScore = 0;

          for (const sop of cachedSops) {
            const score = cosineSimilarity(entryEmbedding, sop.embedding);
            if (score > bestScore) {
              bestScore = score;
              bestSop = sop;
            }
          }

          if (bestScore >= SIMILARITY_THRESHOLD && bestSop) {
            // Classify with Opus
            logger.info('Classifying entry against SOP', {
              entryId: entry.id,
              sop: bestSop.filePath,
              similarity: bestScore.toFixed(3),
            });

            let classification: ClassificationResult;
            try {
              classification = await classifyKnowledgeForSop(
                entry,
                bestSop.content,
                bestSop.title
              );
            } catch (classifyError) {
              logger.error('Classification failed, defaulting to tangential', {
                entryId: entry.id,
                error: classifyError instanceof Error ? classifyError.message : String(classifyError),
              });
              classification = {
                action: 'tangential',
                reasoning: 'Classification failed',
                target_section: null,
              };
              errors.push(`classify:${entry.id}: ${classifyError instanceof Error ? classifyError.message : String(classifyError)}`);
            }

            // Log the match
            await supabase.from('cp_knowledge_sop_matches').insert({
              knowledge_entry_id: entry.id,
              sop_file_path: bestSop.filePath,
              similarity_score: bestScore,
              action: classification.action,
              edit_summary: classification.reasoning,
              sync_run_id: runId,
            });

            if (classification.action === 'enrich') {
              entriesEnriched++;
              const group = enrichmentsBySop.get(bestSop.filePath) || {
                entries: [],
                targetSections: [],
              };
              group.entries.push(entry);
              group.targetSections.push(classification.target_section || 'General');
              enrichmentsBySop.set(bestSop.filePath, group);
            } else if (classification.action === 'redundant') {
              entriesRedundant++;
            }
            // tangential entries are just logged, not acted on
          } else {
            // No strong match -> orphaned
            entriesOrphaned++;
            orphanedEntries.push(entry);

            await supabase.from('cp_knowledge_sop_matches').insert({
              knowledge_entry_id: entry.id,
              sop_file_path: bestSop?.filePath || null,
              similarity_score: bestScore,
              action: 'orphaned',
              edit_summary: `Best match score ${bestScore.toFixed(3)} below threshold ${SIMILARITY_THRESHOLD}`,
              sync_run_id: runId,
            });
          }
        } catch (entryError) {
          logger.error('Failed to process entry', {
            entryId: entry.id,
            error: entryError instanceof Error ? entryError.message : String(entryError),
          });
          errors.push(`entry:${entry.id}: ${entryError instanceof Error ? entryError.message : String(entryError)}`);
        }
      }

      logger.info('Classification complete', {
        processed: entriesProcessed,
        enriched: entriesEnriched,
        redundant: entriesRedundant,
        orphaned: entriesOrphaned,
        sopsToEdit: enrichmentsBySop.size,
      });

      // -------------------------------------------------------------------
      // Step 5: Generate edits for enriched SOPs
      // -------------------------------------------------------------------
      logger.info('Step 5: Generating SOP edits');

      const fileChanges: FileChange[] = [];

      for (const [sopPath, group] of enrichmentsBySop) {
        try {
          const sop = sopByPath.get(sopPath);
          if (!sop) {
            logger.warn('SOP not found in cache', { sopPath });
            continue;
          }

          // Use the most common target section
          const sectionCounts = new Map<string, number>();
          for (const section of group.targetSections) {
            sectionCounts.set(section, (sectionCounts.get(section) || 0) + 1);
          }
          const primarySection = [...sectionCounts.entries()].sort(
            (a, b) => b[1] - a[1]
          )[0][0];

          logger.info('Generating edit', {
            sop: sopPath,
            entries: group.entries.length,
            section: primarySection,
          });

          const edit: GeneratedEdit = await generateSopEdit(
            group.entries,
            sop.content,
            sop.title,
            primarySection
          );

          const updatedContent = applyEdit(sop.content, edit);
          fileChanges.push({ path: sopPath, content: updatedContent });
          sopsEnriched.push(sopPath);

          logger.info('Edit generated', {
            sop: sopPath,
            summary: edit.summary,
          });
        } catch (editError) {
          logger.error('Failed to generate edit for SOP', {
            sopPath,
            error: editError instanceof Error ? editError.message : String(editError),
          });
          errors.push(`edit:${sopPath}: ${editError instanceof Error ? editError.message : String(editError)}`);
        }
      }

      // -------------------------------------------------------------------
      // Step 6: Cluster orphans and create new SOPs
      // -------------------------------------------------------------------
      logger.info('Step 6: Clustering orphans', { count: orphanedEntries.length });

      if (orphanedEntries.length >= 3) {
        try {
          const clusters = await clusterOrphans(orphanedEntries, EXISTING_MODULES);
          logger.info('Orphan clusters found', { count: clusters.length });

          if (clusters.length > 0) {
            // Fetch sidebars.js for updating
            const sidebars = await fetchSidebars();
            let sidebarsContent = sidebars.content;
            let sidebarsChanged = false;

            // Determine next SOP number per module
            const existingSopIds = cachedSops.map((s) => {
              const idMatch = s.content.match(/^id:\s*(.+)/m);
              return idMatch?.[1]?.trim() || '';
            }).filter(Boolean);

            let sopCounter = 100; // Start high to avoid collisions

            for (const cluster of clusters) {
              try {
                const newSop = await generateNewSop(
                  cluster,
                  existingSopIds,
                  sopCounter++
                );

                fileChanges.push({
                  path: newSop.filePath,
                  content: newSop.content,
                });
                sopsCreated.push(newSop.filePath);

                // Update sidebars.js
                sidebarsContent = addToSidebars(
                  sidebarsContent,
                  newSop.module,
                  newSop.sidebarEntry
                );
                sidebarsChanged = true;

                // Update match records: mark orphaned entries as new_sop
                for (const entry of cluster.entries) {
                  await supabase
                    .from('cp_knowledge_sop_matches')
                    .update({
                      action: 'new_sop',
                      sop_file_path: newSop.filePath,
                      edit_summary: `Grouped into new SOP: ${newSop.title}`,
                    })
                    .eq('knowledge_entry_id', entry.id)
                    .eq('sync_run_id', runId);
                }

                logger.info('New SOP generated', {
                  path: newSop.filePath,
                  title: newSop.title,
                  entriesUsed: cluster.entries.length,
                });
              } catch (sopError) {
                logger.error('Failed to generate new SOP', {
                  title: cluster.suggestedTitle,
                  error: sopError instanceof Error ? sopError.message : String(sopError),
                });
                errors.push(`new-sop:${cluster.suggestedTitle}: ${sopError instanceof Error ? sopError.message : String(sopError)}`);
              }
            }

            // Add sidebars.js to file changes if modified
            if (sidebarsChanged) {
              fileChanges.push({
                path: 'sidebars.js',
                content: sidebarsContent,
              });
            }
          }
        } catch (clusterError) {
          logger.error('Orphan clustering failed', {
            error: clusterError instanceof Error ? clusterError.message : String(clusterError),
          });
          errors.push(`cluster: ${clusterError instanceof Error ? clusterError.message : String(clusterError)}`);
        }
      }

      // -------------------------------------------------------------------
      // Step 7: Commit to GitHub
      // -------------------------------------------------------------------
      let commitSha: string | null = null;

      if (fileChanges.length > 0) {
        logger.info('Step 7: Committing changes to GitHub', {
          fileCount: fileChanges.length,
        });

        const changelogLines: string[] = [];
        if (sopsEnriched.length > 0) {
          changelogLines.push(`Enriched ${sopsEnriched.length} SOP(s):`);
          for (const path of sopsEnriched) {
            changelogLines.push(`  - ${path}`);
          }
        }
        if (sopsCreated.length > 0) {
          changelogLines.push(`Created ${sopsCreated.length} new SOP(s):`);
          for (const path of sopsCreated) {
            changelogLines.push(`  - ${path}`);
          }
        }

        const commitMessage = [
          `[playbook-sync] ${entriesEnriched} enrichments, ${sopsCreated.length} new SOPs`,
          '',
          `Processed ${entriesProcessed} knowledge entries (window: ${windowStart})`,
          `  Enriched: ${entriesEnriched}`,
          `  Redundant: ${entriesRedundant}`,
          `  Orphaned: ${entriesOrphaned}`,
          '',
          ...changelogLines,
        ].join('\n');

        // Attempt commit with one retry
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            commitSha = await commitChanges(fileChanges, commitMessage);
            logger.info('Committed to GitHub', { sha: commitSha, attempt });
            break;
          } catch (commitError) {
            if (attempt === 0) {
              logger.warn('Commit failed, retrying once', {
                error: commitError instanceof Error ? commitError.message : String(commitError),
              });
            } else {
              logger.error('Commit failed on retry', {
                error: commitError instanceof Error ? commitError.message : String(commitError),
              });
              errors.push(`commit: ${commitError instanceof Error ? commitError.message : String(commitError)}`);
            }
          }
        }
      } else {
        logger.info('Step 7: No file changes to commit');
      }

      // -------------------------------------------------------------------
      // Step 8: Log the run
      // -------------------------------------------------------------------
      logger.info('Step 8: Logging run results');

      const finalStatus =
        errors.length === 0
          ? 'success'
          : entriesEnriched > 0 || sopsCreated.length > 0
            ? 'partial'
            : 'failed';

      await supabase
        .from('cp_playbook_sync_runs')
        .update({
          status: finalStatus,
          entries_processed: entriesProcessed,
          entries_enriched: entriesEnriched,
          entries_redundant: entriesRedundant,
          entries_orphaned: entriesOrphaned,
          sops_enriched: sopsEnriched,
          sops_created: sopsCreated,
          commit_sha: commitSha,
          commit_message: fileChanges.length > 0 ? `${entriesEnriched} enrichments, ${sopsCreated.length} new SOPs` : null,
          error_log: errors.length > 0 ? errors.join('\n') : null,
        })
        .eq('id', runId);

      logger.info('Playbook sync complete', {
        status: finalStatus,
        entriesProcessed,
        entriesEnriched,
        entriesRedundant,
        entriesOrphaned,
        sopsEnriched: sopsEnriched.length,
        sopsCreated: sopsCreated.length,
        commitSha,
        errors: errors.length,
      });

      return {
        status: finalStatus,
        entriesProcessed,
        entriesEnriched,
        entriesRedundant,
        entriesOrphaned,
        sopsEnriched,
        sopsCreated,
        commitSha,
        errors,
      };
    } catch (fatalError) {
      // Fatal error — mark run as failed
      logger.error('Fatal error in playbook sync', {
        error: fatalError instanceof Error ? fatalError.message : String(fatalError),
      });

      await supabase
        .from('cp_playbook_sync_runs')
        .update({
          status: 'failed',
          entries_processed: entriesProcessed,
          entries_enriched: entriesEnriched,
          entries_redundant: entriesRedundant,
          entries_orphaned: entriesOrphaned,
          sops_enriched: sopsEnriched,
          sops_created: sopsCreated,
          error_log: fatalError instanceof Error ? fatalError.message : String(fatalError),
        })
        .eq('id', runId);

      throw fatalError;
    }
  },
});
