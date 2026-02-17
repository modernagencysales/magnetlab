import { Octokit } from '@octokit/rest';

const REPO_OWNER = 'modernagencysales';
const REPO_NAME = 'playbooks';

// Lazy singleton Octokit client (same pattern as anthropic-client.ts)
let octokit: Octokit | null = null;

function getOctokit(): Octokit {
  if (!octokit) {
    const token = process.env.GITHUB_TOKEN;
    if (!token) throw new Error('GITHUB_TOKEN is not set');
    octokit = new Octokit({ auth: token });
  }
  return octokit;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RepoFile {
  path: string;
  content: string;
  sha: string;
}

export interface FileChange {
  path: string;
  content: string;
}

// ---------------------------------------------------------------------------
// Read operations
// ---------------------------------------------------------------------------

/**
 * Fetch all markdown files from `docs/` in the playbooks repo.
 * Uses the Git Trees API to enumerate files in a single call, then fetches
 * blob content for each .md file.
 */
export async function fetchAllSopFiles(): Promise<RepoFile[]> {
  const gh = getOctokit();

  // Get the latest commit SHA on main
  const { data: ref } = await gh.git.getRef({
    owner: REPO_OWNER,
    repo: REPO_NAME,
    ref: 'heads/main',
  });
  const treeSha = ref.object.sha;

  // Fetch the full tree recursively
  const { data: tree } = await gh.git.getTree({
    owner: REPO_OWNER,
    repo: REPO_NAME,
    tree_sha: treeSha,
    recursive: 'true',
  });

  // Filter to markdown files under docs/
  const mdFiles = tree.tree.filter(
    (item) =>
      item.type === 'blob' &&
      item.path?.startsWith('docs/') &&
      item.path?.endsWith('.md')
  );

  // Fetch blob content for each file
  const files: RepoFile[] = [];
  for (const file of mdFiles) {
    if (!file.path || !file.sha) continue;

    const { data: blob } = await gh.git.getBlob({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      file_sha: file.sha,
    });

    const content = Buffer.from(blob.content, 'base64').toString('utf-8');
    files.push({ path: file.path, content, sha: file.sha });
  }

  return files;
}

/**
 * Fetch the current sidebars.js content and its SHA (for change detection).
 */
export async function fetchSidebars(): Promise<{ content: string; sha: string }> {
  const gh = getOctokit();

  const { data } = await gh.repos.getContent({
    owner: REPO_OWNER,
    repo: REPO_NAME,
    path: 'sidebars.js',
  });

  if (!('content' in data)) {
    throw new Error('sidebars.js not found or is a directory');
  }

  const content = Buffer.from(data.content, 'base64').toString('utf-8');
  return { content, sha: data.sha };
}

// ---------------------------------------------------------------------------
// Write operations
// ---------------------------------------------------------------------------

/**
 * Commit multiple file changes in a single atomic commit using the Git Trees API.
 *
 * Flow: create blobs -> create tree -> create commit -> update ref
 *
 * This avoids race conditions that would occur with individual file commits.
 * Returns the new commit SHA.
 */
export async function commitChanges(
  changes: FileChange[],
  message: string
): Promise<string> {
  const gh = getOctokit();

  // Get current HEAD of main
  const { data: ref } = await gh.git.getRef({
    owner: REPO_OWNER,
    repo: REPO_NAME,
    ref: 'heads/main',
  });
  const parentSha = ref.object.sha;

  // Create blobs for all changed files in parallel
  const treeItems = await Promise.all(
    changes.map(async (change) => {
      const { data: blob } = await gh.git.createBlob({
        owner: REPO_OWNER,
        repo: REPO_NAME,
        content: change.content,
        encoding: 'utf-8',
      });
      return {
        path: change.path,
        mode: '100644' as const,
        type: 'blob' as const,
        sha: blob.sha,
      };
    })
  );

  // Create a new tree based on the current HEAD
  const { data: tree } = await gh.git.createTree({
    owner: REPO_OWNER,
    repo: REPO_NAME,
    base_tree: parentSha,
    tree: treeItems,
  });

  // Create the commit
  const { data: commit } = await gh.git.createCommit({
    owner: REPO_OWNER,
    repo: REPO_NAME,
    message,
    tree: tree.sha,
    parents: [parentSha],
  });

  // Fast-forward main to the new commit
  await gh.git.updateRef({
    owner: REPO_OWNER,
    repo: REPO_NAME,
    ref: 'heads/main',
    sha: commit.sha,
  });

  return commit.sha;
}
