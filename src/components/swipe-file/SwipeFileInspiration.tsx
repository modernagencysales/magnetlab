'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronDown, ChevronUp, Lightbulb, ExternalLink, ThumbsUp, Users } from 'lucide-react';
import Link from 'next/link';

interface SwipePost {
  id: string;
  hook: string;
  post_type: string;
  niche: string;
  likes_count: number | null;
  leads_generated: number | null;
}

interface SwipeLeadMagnet {
  id: string;
  title: string;
  format: string;
  leads_generated: number | null;
  conversion_rate: number | null;
}

interface SwipeFileInspirationProps {
  type?: 'posts' | 'lead-magnets' | 'both';
  niche?: string;
  limit?: number;
}

export function SwipeFileInspiration({
  type = 'both',
  niche,
  limit = 3,
}: SwipeFileInspirationProps) {
  const [expanded, setExpanded] = useState(false);
  const [posts, setPosts] = useState<SwipePost[]>([]);
  const [leadMagnets, setLeadMagnets] = useState<SwipeLeadMagnet[]>([]);
  const [loading, setLoading] = useState(false);
  const hasFetched = useRef(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        featured: 'true',
        limit: limit.toString(),
      });
      if (niche) params.append('niche', niche);

      if (type === 'posts' || type === 'both') {
        const postRes = await fetch(`/api/swipe-file/posts?${params}`);
        const postData = await postRes.json();
        setPosts(postData.posts || []);
      }

      if (type === 'lead-magnets' || type === 'both') {
        const lmRes = await fetch(`/api/swipe-file/lead-magnets?${params}`);
        const lmData = await lmRes.json();
        setLeadMagnets(lmData.leadMagnets || []);
      }
    } catch {
      // Error handled silently - data will be empty
    } finally {
      setLoading(false);
    }
  }, [type, niche, limit]);

  useEffect(() => {
    if (expanded && !hasFetched.current) {
      hasFetched.current = true;
      fetchData();
    }
  }, [expanded, fetchData]);

  const hasContent = posts.length > 0 || leadMagnets.length > 0;

  return (
    <div className="rounded-lg border bg-card">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between p-4 text-left hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-yellow-500" />
          <span className="text-sm font-medium">Need inspiration?</span>
          <span className="text-xs text-muted-foreground">
            Browse high-performing examples
          </span>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {expanded && (
        <div className="border-t px-4 pb-4">
          {loading ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              Loading inspiration...
            </div>
          ) : !hasContent ? (
            <div className="py-6 text-center">
              <p className="text-sm text-muted-foreground">No examples yet</p>
              <Link
                href="/posts?tab=inspiration"
                className="mt-2 inline-flex items-center gap-1 text-sm text-primary hover:text-primary/80"
              >
                Browse the full swipe file
                <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          ) : (
            <div className="space-y-4 pt-4">
              {/* Featured Posts */}
              {posts.length > 0 && (type === 'posts' || type === 'both') && (
                <div>
                  <h4 className="mb-2 text-xs font-medium text-muted-foreground uppercase">
                    Top Posts
                  </h4>
                  <div className="space-y-2">
                    {posts.map((post) => (
                      <div
                        key={post.id}
                        className="rounded-lg bg-muted/50 p-3"
                      >
                        <p className="text-sm font-medium line-clamp-2">{post.hook}</p>
                        <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                          {post.post_type && (
                            <span className="rounded bg-primary/10 px-1.5 py-0.5 text-primary">
                              {post.post_type}
                            </span>
                          )}
                          {post.likes_count !== null && (
                            <span className="flex items-center gap-1">
                              <ThumbsUp className="h-3 w-3" />
                              {post.likes_count.toLocaleString()}
                            </span>
                          )}
                          {post.leads_generated !== null && (
                            <span className="flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              {post.leads_generated} leads
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Featured Lead Magnets */}
              {leadMagnets.length > 0 && (type === 'lead-magnets' || type === 'both') && (
                <div>
                  <h4 className="mb-2 text-xs font-medium text-muted-foreground uppercase">
                    Top Lead Magnets
                  </h4>
                  <div className="space-y-2">
                    {leadMagnets.map((lm) => (
                      <div
                        key={lm.id}
                        className="rounded-lg bg-muted/50 p-3"
                      >
                        <p className="text-sm font-medium">{lm.title}</p>
                        <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                          {lm.format && (
                            <span className="rounded bg-primary/10 px-1.5 py-0.5 text-primary">
                              {lm.format}
                            </span>
                          )}
                          {lm.leads_generated !== null && (
                            <span className="flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              {lm.leads_generated} leads
                            </span>
                          )}
                          {lm.conversion_rate !== null && (
                            <span className="font-medium text-green-600">
                              {lm.conversion_rate}% CVR
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Link to full swipe file */}
              <Link
                href="/posts?tab=inspiration"
                className="flex items-center justify-center gap-1 rounded-lg border py-2 text-sm font-medium hover:bg-muted/50 transition-colors"
              >
                Browse full swipe file
                <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
