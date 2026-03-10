'use client';

import { useState, useEffect, useCallback } from 'react';
import { Loader2, Wand2, ThumbsUp, MessageSquare, Eye } from 'lucide-react';
import { Button, Input, Textarea, Badge } from '@magnetlab/magnetui';
import type { ViralPost } from '@/lib/types/content-pipeline';
import * as scraperApi from '@/frontend/api/content-pipeline/scraper';

interface ViralPostsSectionProps {
  onTemplateExtracted: () => void;
}

export function ViralPostsSection({ onTemplateExtracted }: ViralPostsSectionProps) {
  const [posts, setPosts] = useState<ViralPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPaste, setShowPaste] = useState(false);
  const [pasteContent, setPasteContent] = useState('');
  const [pasteAuthor, setPasteAuthor] = useState('');
  const [pasting, setPasting] = useState(false);
  const [extractingId, setExtractingId] = useState<string | null>(null);

  const fetchPosts = useCallback(async () => {
    try {
      const data = await scraperApi.getScraperRunsAndPosts();
      setPosts((data.posts || []) as ViralPost[]);
    } catch {
      // Silent failure
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const handlePaste = async () => {
    if (!pasteContent.trim()) return;
    setPasting(true);
    try {
      await scraperApi.importPosts({
        posts: [{ content: pasteContent, author_name: pasteAuthor || null }],
      });
      setShowPaste(false);
      setPasteContent('');
      setPasteAuthor('');
      await fetchPosts();
    } catch {
      // Silent failure
    } finally {
      setPasting(false);
    }
  };

  const handleExtractTemplate = async (post: ViralPost) => {
    setExtractingId(post.id);
    try {
      await scraperApi.extractTemplate({ content: post.content, viral_post_id: post.id });
      onTemplateExtracted();
      await fetchPosts();
    } catch {
      // Silent failure
    } finally {
      setExtractingId(null);
    }
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase text-muted-foreground">Viral Posts</h3>
        <Button variant="outline" size="sm" onClick={() => setShowPaste(!showPaste)}>
          Add Post
        </Button>
      </div>

      {showPaste && (
        <div className="mb-4 rounded-lg border bg-card p-4 space-y-3">
          <Input
            type="text"
            value={pasteAuthor}
            onChange={(e) => setPasteAuthor(e.target.value)}
            placeholder="Author name (optional)"
          />
          <Textarea
            value={pasteContent}
            onChange={(e) => setPasteContent(e.target.value)}
            placeholder="Paste the LinkedIn post content..."
            rows={4}
            className="resize-none"
          />
          <Button size="sm" onClick={handlePaste} disabled={pasting || !pasteContent.trim()}>
            {pasting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
          </Button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : posts.length === 0 ? (
        <div className="rounded-lg border border-dashed p-6 text-center">
          <p className="text-sm text-muted-foreground">
            No viral posts saved. Paste posts to analyze their structure.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => (
            <div key={post.id} className="rounded-lg border bg-card p-4">
              <div className="mb-2 flex items-start justify-between">
                <div>
                  {post.author_name && <p className="text-sm font-medium">{post.author_name}</p>}
                  {post.author_headline && (
                    <p className="text-xs text-muted-foreground">{post.author_headline}</p>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <ThumbsUp className="h-3 w-3" /> {post.likes}
                  </span>
                  <span className="flex items-center gap-1">
                    <MessageSquare className="h-3 w-3" /> {post.comments}
                  </span>
                  <span className="flex items-center gap-1">
                    <Eye className="h-3 w-3" /> {post.views}
                  </span>
                </div>
              </div>
              <p className="mb-3 text-sm line-clamp-4 whitespace-pre-wrap">{post.content}</p>
              <div className="flex items-center gap-2">
                {post.extracted_template_id ? (
                  <Badge variant="green">Template extracted</Badge>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleExtractTemplate(post)}
                    disabled={extractingId === post.id}
                  >
                    {extractingId === post.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Wand2 className="h-3 w-3" />
                    )}
                    Extract Template
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
