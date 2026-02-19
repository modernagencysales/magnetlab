'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { logError } from '@/lib/utils/logger';
import { createSupabaseBrowserClient } from '@/lib/utils/supabase-browser';

import {
  FileText,
  Magnet,
  Filter,
  Star,
  ThumbsUp,
  MessageCircle,
  Users,
  Loader2,
  Copy,
  Check,
  ChevronDown,
  Plus,
  Sparkles,
  Share2,
  TrendingUp,
  UserPlus,
  ArrowUpDown,
  ExternalLink,
} from 'lucide-react';
import { VIRAL_POST_TOPICS } from '@/lib/ai/content-pipeline/template-extractor';

interface SwipePost {
  id: string;
  content: string;
  hook: string;
  post_type: string;
  niche: string;
  topic_tags: string[];
  likes_count: number | null;
  comments_count: number | null;
  leads_generated: number | null;
  author_name: string | null;
  author_headline: string | null;
  notes: string | null;
  status: string;
  created_at: string;
}

interface SwipeLeadMagnet {
  id: string;
  title: string;
  description: string;
  content: string;
  format: string;
  niche: string;
  topic_tags: string[];
  downloads_count: number | null;
  conversion_rate: number | null;
  leads_generated: number | null;
  thumbnail_url: string | null;
  notes: string | null;
  status: string;
  created_at: string;
}

interface DiscoveredPost {
  id: string;
  author_name: string | null;
  author_headline: string | null;
  author_url: string | null;
  content: string;
  likes: number;
  comments: number;
  shares: number;
  engagement_score: number;
  template_extracted: boolean;
  extracted_template_id: string | null;
  is_lead_magnet: boolean;
  topics: string[];
  created_at: string;
}

const POST_TYPES = [
  { value: '', label: 'All Types' },
  { value: 'story', label: 'Story' },
  { value: 'listicle', label: 'Listicle' },
  { value: 'hot-take', label: 'Hot Take' },
  { value: 'educational', label: 'Educational' },
  { value: 'case-study', label: 'Case Study' },
  { value: 'carousel', label: 'Carousel' },
];

const FORMATS = [
  { value: '', label: 'All Formats' },
  { value: 'checklist', label: 'Checklist' },
  { value: 'template', label: 'Template' },
  { value: 'guide', label: 'Guide' },
  { value: 'swipe-file', label: 'Swipe File' },
  { value: 'calculator', label: 'Calculator' },
  { value: 'quiz', label: 'Quiz' },
  { value: 'cheatsheet', label: 'Cheatsheet' },
];

const NICHES = [
  { value: '', label: 'All Niches' },
  { value: 'coaching', label: 'Coaching' },
  { value: 'saas', label: 'SaaS' },
  { value: 'agency', label: 'Agency' },
  { value: 'creator', label: 'Creator' },
  { value: 'b2b', label: 'B2B' },
  { value: 'other', label: 'Other' },
];

const PAGE_SIZE = 50;

export function SwipeFileContent() {
  const [activeTab, setActiveTab] = useState<'posts' | 'lead-magnets' | 'discovered'>('discovered');
  const [posts, setPosts] = useState<SwipePost[]>([]);
  const [leadMagnets, setLeadMagnets] = useState<SwipeLeadMagnet[]>([]);
  const [allWinningPosts, setAllWinningPosts] = useState<DiscoveredPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Filters
  const [niche, setNiche] = useState('');
  const [postType, setPostType] = useState('');
  const [format, setFormat] = useState('');
  const [featuredOnly, setFeaturedOnly] = useState(false);

  // Discovered tab state
  const [discoveredSort, setDiscoveredSort] = useState<'engagement' | 'recent'>('engagement');
  const [creatorFilter, setCreatorFilter] = useState('');
  const [topicFilter, setTopicFilter] = useState('');
  const [expandedPostIds, setExpandedPostIds] = useState<Set<string>>(new Set());
  const [trackedCreatorUrls, setTrackedCreatorUrls] = useState<Set<string>>(new Set());
  const [trackingInProgress, setTrackingInProgress] = useState<string | null>(null);

  // Submission modal
  const [showSubmitModal, setShowSubmitModal] = useState(false);

  // Split winning posts: CTA posts → lead magnets section, rest → discovered
  const { ctaPosts, discoveredPosts } = useMemo(() => {
    const cta: DiscoveredPost[] = [];
    const discovered: DiscoveredPost[] = [];
    for (const post of allWinningPosts) {
      if (post.is_lead_magnet) {
        cta.push(post);
      } else {
        discovered.push(post);
      }
    }
    return { ctaPosts: cta, discoveredPosts: discovered };
  }, [allWinningPosts]);

  // Build unique creator list for filter dropdown
  const creatorOptions = useMemo(() => {
    const currentPosts = activeTab === 'lead-magnets' ? ctaPosts : discoveredPosts;
    const names = new Map<string, string>(); // url → name
    for (const post of currentPosts) {
      if (post.author_name && post.author_url) {
        names.set(post.author_url, post.author_name);
      }
    }
    return Array.from(names.entries())
      .map(([url, name]) => ({ url, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [ctaPosts, discoveredPosts, activeTab]);

  // Static topic list from the canonical enum (always shows all options)
  const topicOptions = VIRAL_POST_TOPICS;

  // Filter discovered/CTA posts by creator and topic
  const filteredDiscovered = useMemo(() => {
    let posts = discoveredPosts;
    if (creatorFilter) {
      posts = posts.filter((p) => p.author_url === creatorFilter);
    }
    if (topicFilter) {
      posts = posts.filter((p) => p.topics?.includes(topicFilter));
    }
    const orderKey = discoveredSort === 'engagement' ? 'engagement_score' : 'created_at';
    return [...posts].sort((a, b) => {
      if (orderKey === 'engagement_score') return b.engagement_score - a.engagement_score;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [discoveredPosts, creatorFilter, topicFilter, discoveredSort]);

  const filteredCtaPosts = useMemo(() => {
    let posts = ctaPosts;
    if (creatorFilter) {
      posts = posts.filter((p) => p.author_url === creatorFilter);
    }
    if (topicFilter) {
      posts = posts.filter((p) => p.topics?.includes(topicFilter));
    }
    return [...posts].sort((a, b) => b.engagement_score - a.engagement_score);
  }, [ctaPosts, creatorFilter, topicFilter]);

  const fetchWinningPosts = useCallback(async (reset: boolean) => {
    if (reset) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }
    try {
      const supabase = createSupabaseBrowserClient();
      const offset = reset ? 0 : allWinningPosts.length;

      const orderCol = discoveredSort === 'engagement' ? 'engagement_score' : 'created_at';

      let query = supabase
        .from('cp_viral_posts')
        .select('id, author_name, author_headline, author_url, content, likes, comments, shares, engagement_score, template_extracted, extracted_template_id, is_lead_magnet, topics, created_at')
        .eq('is_winner', true)
        .is('user_id', null);

      if (topicFilter) {
        query = query.contains('topics', [topicFilter]);
      }

      const { data, error } = await query
        .order(orderCol, { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);

      if (error) {
        logError('swipe-file', error, { step: 'discovered_fetch_error' });
        if (reset) setAllWinningPosts([]);
      } else {
        const newPosts = data || [];
        setHasMore(newPosts.length === PAGE_SIZE);
        if (reset) {
          setAllWinningPosts(newPosts);
        } else {
          setAllWinningPosts((prev) => [...prev, ...newPosts]);
        }
      }
    } catch {
      if (reset) setAllWinningPosts([]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [allWinningPosts.length, discoveredSort, topicFilter]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      if (activeTab === 'posts') {
        const params = new URLSearchParams();
        if (niche) params.append('niche', niche);
        if (postType) params.append('type', postType);
        if (featuredOnly) params.append('featured', 'true');

        const response = await fetch(`/api/swipe-file/posts?${params}`);
        const data = await response.json();
        setPosts(data.posts || []);
        setLoading(false);
      } else if (activeTab === 'lead-magnets' || activeTab === 'discovered') {
        // Fetch first page of winning posts (or skip if already loaded)
        if (allWinningPosts.length === 0) {
          await fetchWinningPosts(true);
        } else {
          setLoading(false);
        }

        // Also fetch submitted lead magnets for the lead-magnets tab
        if (activeTab === 'lead-magnets') {
          const params = new URLSearchParams();
          if (niche) params.append('niche', niche);
          if (format) params.append('format', format);
          if (featuredOnly) params.append('featured', 'true');

          const response = await fetch(`/api/swipe-file/lead-magnets?${params}`);
          const data = await response.json();
          setLeadMagnets(data.leadMagnets || []);
        }
      }
    } catch {
      setLoading(false);
    }
  }, [activeTab, niche, postType, format, featuredOnly, allWinningPosts.length, fetchWinningPosts]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Reset and re-fetch when sort or topic filter changes
  useEffect(() => {
    if (allWinningPosts.length > 0) {
      fetchWinningPosts(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [discoveredSort, topicFilter]);

  // Reset creator and topic filters when switching tabs
  useEffect(() => {
    setCreatorFilter('');
    setTopicFilter('');
  }, [activeTab]);

  const handleCopy = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const toggleExpandPost = (postId: string) => {
    setExpandedPostIds((prev) => {
      const next = new Set(prev);
      if (next.has(postId)) {
        next.delete(postId);
      } else {
        next.add(postId);
      }
      return next;
    });
  };

  const handleTrackCreator = async (post: DiscoveredPost) => {
    if (!post.author_url) return;
    setTrackingInProgress(post.id);
    try {
      const response = await fetch('/api/content-pipeline/creators', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          linkedin_url: post.author_url,
          name: post.author_name,
          headline: post.author_headline,
        }),
      });

      if (response.ok) {
        setTrackedCreatorUrls((prev) => new Set(prev).add(post.author_url!));
      }
    } catch (error) {
      logError('swipe-file', error, { step: 'track_creator_error' });
    } finally {
      setTrackingInProgress(null);
    }
  };

  const truncateContent = (content: string, maxLength: number = 200) => {
    if (content.length <= maxLength) return content;
    return content.slice(0, maxLength).trimEnd() + '...';
  };

  // Shared post card renderer for discovered/CTA posts
  const renderPostCard = (dPost: DiscoveredPost) => {
    const isExpanded = expandedPostIds.has(dPost.id);
    const isTracked = dPost.author_url ? trackedCreatorUrls.has(dPost.author_url) : false;
    const isTrackingThis = trackingInProgress === dPost.id;

    return (
      <div
        key={dPost.id}
        className="group rounded-lg border bg-card p-4 transition-colors hover:border-primary/30"
      >
        {/* Author info + badges */}
        <div className="mb-3 flex items-start justify-between">
          <div className="min-w-0 flex-1">
            {dPost.author_name && (
              <p className="font-medium leading-snug truncate">
                {dPost.author_url ? (
                  <a
                    href={dPost.author_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 hover:text-primary transition-colors"
                  >
                    {dPost.author_name}
                    <ExternalLink className="h-3 w-3 shrink-0" />
                  </a>
                ) : (
                  dPost.author_name
                )}
              </p>
            )}
            {dPost.author_headline && (
              <p className="mt-0.5 text-xs text-muted-foreground truncate">
                {dPost.author_headline}
              </p>
            )}
          </div>
          <div className="ml-2 flex items-center gap-1.5 shrink-0">
            {dPost.topics?.slice(0, 2).map((t) => (
              <span key={t} className="rounded-md bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                {t}
              </span>
            ))}
            {dPost.template_extracted && (
              <span className="rounded-md bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                Template
              </span>
            )}
            <button
              onClick={() => handleCopy(dPost.content, dPost.id)}
              className="rounded-lg p-1.5 text-muted-foreground opacity-0 hover:bg-secondary hover:text-foreground group-hover:opacity-100 transition-all"
              title="Copy content"
            >
              {copiedId === dPost.id ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        {/* Content preview / expanded */}
        <div
          className="mb-4 cursor-pointer"
          onClick={() => toggleExpandPost(dPost.id)}
        >
          {isExpanded ? (
            <div>
              <p className="text-sm text-muted-foreground whitespace-pre-line">
                {dPost.content}
              </p>
              <span className="mt-1 block text-xs text-primary font-medium">
                Show less
              </span>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {truncateContent(dPost.content)}
              {dPost.content.length > 200 && (
                <span className="ml-1 text-xs text-primary font-medium">
                  Read more
                </span>
              )}
            </p>
          )}
        </div>

        {/* Engagement metrics */}
        <div className="mb-3 flex items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <ThumbsUp className="h-3.5 w-3.5" />
            {dPost.likes.toLocaleString()}
          </span>
          <span className="flex items-center gap-1">
            <MessageCircle className="h-3.5 w-3.5" />
            {dPost.comments.toLocaleString()}
          </span>
          <span className="flex items-center gap-1">
            <Share2 className="h-3.5 w-3.5" />
            {dPost.shares.toLocaleString()}
          </span>
          {dPost.engagement_score > 0 && (
            <span className="flex items-center gap-1 font-medium text-primary">
              <TrendingUp className="h-3.5 w-3.5" />
              {dPost.engagement_score.toLocaleString()}
            </span>
          )}
        </div>

        {/* Track Creator button */}
        {dPost.author_url && (
          <button
            onClick={() => handleTrackCreator(dPost)}
            disabled={isTracked || isTrackingThis}
            className={`flex w-full items-center justify-center gap-2 rounded-lg border py-2 text-sm font-medium transition-colors ${
              isTracked
                ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-400'
                : 'hover:bg-secondary'
            } disabled:opacity-70`}
          >
            {isTrackingThis ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isTracked ? (
              <>
                <Check className="h-4 w-4" />
                Tracked!
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4" />
                Track Creator
              </>
            )}
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Swipe File</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Browse high-performing posts and lead magnets for inspiration
          </p>
        </div>
        <button
          onClick={() => setShowSubmitModal(true)}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Submit Yours
        </button>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-2">
        <button
          onClick={() => setActiveTab('discovered')}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'discovered'
              ? 'bg-primary text-primary-foreground'
              : 'bg-secondary hover:bg-secondary/80'
          }`}
        >
          <Sparkles className="h-4 w-4" />
          Discovered
          {discoveredPosts.length > 0 && (
            <span className="rounded-full bg-primary-foreground/20 px-1.5 py-0.5 text-xs">
              {discoveredPosts.length}{hasMore ? '+' : ''}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('lead-magnets')}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'lead-magnets'
              ? 'bg-primary text-primary-foreground'
              : 'bg-secondary hover:bg-secondary/80'
          }`}
        >
          <Magnet className="h-4 w-4" />
          Lead Magnets
          {ctaPosts.length > 0 && (
            <span className={`rounded-full px-1.5 py-0.5 text-xs ${
              activeTab === 'lead-magnets' ? 'bg-primary-foreground/20' : 'bg-primary/10 text-primary'
            }`}>
              {ctaPosts.length}{hasMore ? '+' : ''}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('posts')}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'posts'
              ? 'bg-primary text-primary-foreground'
              : 'bg-secondary hover:bg-secondary/80'
          }`}
        >
          <FileText className="h-4 w-4" />
          Community Posts
        </button>
      </div>

      {/* Filters */}
      {activeTab === 'posts' ? (
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Filter className="h-4 w-4" />
            Filters:
          </div>

          {/* Niche filter */}
          <div className="relative">
            <select
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
              className="appearance-none rounded-lg border bg-background px-3 py-1.5 pr-8 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
            >
              {NICHES.map((n) => (
                <option key={n.value} value={n.value}>
                  {n.label}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          </div>

          {/* Type filter */}
          <div className="relative">
            <select
              value={postType}
              onChange={(e) => setPostType(e.target.value)}
              className="appearance-none rounded-lg border bg-background px-3 py-1.5 pr-8 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
            >
              {POST_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          </div>

          {/* Featured toggle */}
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={featuredOnly}
              onChange={(e) => setFeaturedOnly(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <Star className="h-4 w-4 text-yellow-500" />
            Featured only
          </label>
        </div>
      ) : activeTab === 'lead-magnets' ? (
        <div className="mb-6 flex flex-wrap items-center gap-3">
          {/* Creator filter */}
          {creatorOptions.length > 0 && (
            <>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Filter className="h-4 w-4" />
                Filter:
              </div>
              <div className="relative">
                <select
                  value={creatorFilter}
                  onChange={(e) => setCreatorFilter(e.target.value)}
                  className="appearance-none rounded-lg border bg-background px-3 py-1.5 pr-8 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                >
                  <option value="">All Creators</option>
                  {creatorOptions.map((c) => (
                    <option key={c.url} value={c.url}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              </div>
            </>
          )}

          {/* Topic filter */}
          {topicOptions.length > 0 && (
            <div className="relative">
              <select
                value={topicFilter}
                onChange={(e) => setTopicFilter(e.target.value)}
                className="appearance-none rounded-lg border bg-background px-3 py-1.5 pr-8 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
              >
                <option value="">All Topics</option>
                {topicOptions.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            </div>
          )}

          {/* Also show format filters for submitted lead magnets */}
          <div className="relative">
            <select
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
              className="appearance-none rounded-lg border bg-background px-3 py-1.5 pr-8 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
            >
              {NICHES.map((n) => (
                <option key={n.value} value={n.value}>
                  {n.label}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          </div>
          <div className="relative">
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value)}
              className="appearance-none rounded-lg border bg-background px-3 py-1.5 pr-8 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
            >
              {FORMATS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          </div>
        </div>
      ) : (
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ArrowUpDown className="h-4 w-4" />
            Sort:
          </div>
          <button
            onClick={() => setDiscoveredSort('engagement')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              discoveredSort === 'engagement'
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary hover:bg-secondary/80'
            }`}
          >
            <TrendingUp className="h-3.5 w-3.5" />
            Engagement
          </button>
          <button
            onClick={() => setDiscoveredSort('recent')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              discoveredSort === 'recent'
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary hover:bg-secondary/80'
            }`}
          >
            Most Recent
          </button>

          {/* Creator filter */}
          {creatorOptions.length > 0 && (
            <>
              <div className="mx-1 h-5 w-px bg-border" />
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="h-4 w-4" />
                Creator:
              </div>
              <div className="relative">
                <select
                  value={creatorFilter}
                  onChange={(e) => setCreatorFilter(e.target.value)}
                  className="appearance-none rounded-lg border bg-background px-3 py-1.5 pr-8 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors max-w-[200px]"
                >
                  <option value="">All Creators ({creatorOptions.length})</option>
                  {creatorOptions.map((c) => (
                    <option key={c.url} value={c.url}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              </div>
            </>
          )}

          {/* Topic filter */}
          {topicOptions.length > 0 && (
            <>
              <div className="mx-1 h-5 w-px bg-border" />
              <div className="relative">
                <select
                  value={topicFilter}
                  onChange={(e) => setTopicFilter(e.target.value)}
                  className="appearance-none rounded-lg border bg-background px-3 py-1.5 pr-8 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                >
                  <option value="">All Topics</option>
                  {topicOptions.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              </div>
            </>
          )}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : activeTab === 'posts' ? (
        <div className="grid gap-4 md:grid-cols-2">
          {posts.length === 0 ? (
            <div className="col-span-2 rounded-lg border border-dashed p-12 text-center">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <p className="mt-4 text-muted-foreground">No posts found</p>
              <p className="mt-1 text-sm text-muted-foreground/70">
                Be the first to submit a high-performing post!
              </p>
            </div>
          ) : (
            posts.map((post) => (
              <div
                key={post.id}
                className="group rounded-lg border bg-card p-4 transition-colors hover:border-primary/30"
              >
                {/* Header */}
                <div className="mb-3 flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    {post.status === 'featured' && (
                      <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
                    )}
                    {post.post_type && (
                      <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                        {post.post_type}
                      </span>
                    )}
                    {post.niche && (
                      <span className="rounded-md bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                        {post.niche}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => handleCopy(post.content, post.id)}
                    className="rounded-lg p-1.5 text-muted-foreground opacity-0 hover:bg-secondary hover:text-foreground group-hover:opacity-100 transition-all"
                    title="Copy content"
                  >
                    {copiedId === post.id ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </button>
                </div>

                {/* Hook */}
                <p className="mb-2 font-medium leading-snug">{post.hook}</p>

                {/* Content preview */}
                <p className="mb-4 text-sm text-muted-foreground line-clamp-3">
                  {post.content.slice(post.hook?.length || 0).trim()}
                </p>

                {/* Metrics */}
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  {post.likes_count !== null && (
                    <span className="flex items-center gap-1">
                      <ThumbsUp className="h-3.5 w-3.5" />
                      {post.likes_count.toLocaleString()}
                    </span>
                  )}
                  {post.comments_count !== null && (
                    <span className="flex items-center gap-1">
                      <MessageCircle className="h-3.5 w-3.5" />
                      {post.comments_count.toLocaleString()}
                    </span>
                  )}
                  {post.leads_generated !== null && (
                    <span className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      {post.leads_generated} leads
                    </span>
                  )}
                </div>

                {/* Notes */}
                {post.notes && (
                  <p className="mt-3 rounded-lg bg-muted p-2 text-xs text-muted-foreground italic">
                    {post.notes}
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      ) : activeTab === 'lead-magnets' ? (
        <div className="space-y-8">
          {/* Discovered CTA posts */}
          {filteredCtaPosts.length > 0 && (
            <div>
              <div className="mb-4 flex items-center gap-2">
                <Magnet className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold uppercase text-muted-foreground">
                  Lead Magnet Posts ({filteredCtaPosts.length})
                </h3>
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                  Auto-detected CTA
                </span>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {filteredCtaPosts.map(renderPostCard)}
              </div>
            </div>
          )}

          {/* Submitted lead magnets */}
          {leadMagnets.length > 0 && (
            <div>
              <h3 className="mb-4 text-sm font-semibold uppercase text-muted-foreground">
                Submitted Lead Magnets ({leadMagnets.length})
              </h3>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {leadMagnets.map((lm) => (
                  <div
                    key={lm.id}
                    className="group rounded-lg border bg-card p-4 transition-colors hover:border-primary/30"
                  >
                    {lm.thumbnail_url && (
                      <div className="mb-3 aspect-video overflow-hidden rounded-lg bg-muted">
                        <img
                          src={lm.thumbnail_url}
                          alt={lm.title}
                          className="h-full w-full object-cover"
                        />
                      </div>
                    )}

                    <div className="mb-2 flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        {lm.status === 'featured' && (
                          <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
                        )}
                        {lm.format && (
                          <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                            {lm.format}
                          </span>
                        )}
                      </div>
                    </div>

                    <h3 className="mb-1 font-medium">{lm.title}</h3>

                    {lm.description && (
                      <p className="mb-3 text-sm text-muted-foreground line-clamp-2">
                        {lm.description}
                      </p>
                    )}

                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      {lm.leads_generated !== null && (
                        <span className="flex items-center gap-1">
                          <Users className="h-3.5 w-3.5" />
                          {lm.leads_generated} leads
                        </span>
                      )}
                      {lm.conversion_rate !== null && (
                        <span className="font-medium text-green-600">
                          {lm.conversion_rate}% CVR
                        </span>
                      )}
                    </div>

                    {lm.content && (
                      <button
                        onClick={() => handleCopy(lm.content, lm.id)}
                        className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border py-2 text-sm font-medium hover:bg-secondary transition-colors"
                      >
                        {copiedId === lm.id ? (
                          <>
                            <Check className="h-4 w-4 text-green-500" />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="h-4 w-4" />
                            Copy Content
                          </>
                        )}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Load More (shared data source with discovered tab) */}
          {hasMore && !creatorFilter && filteredCtaPosts.length > 0 && (
            <div className="flex justify-center">
              <button
                onClick={() => fetchWinningPosts(false)}
                disabled={loadingMore}
                className="flex items-center gap-2 rounded-lg border bg-card px-6 py-2.5 text-sm font-medium hover:bg-secondary transition-colors disabled:opacity-50"
              >
                {loadingMore ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4" />
                    Load More Posts
                  </>
                )}
              </button>
            </div>
          )}

          {/* Empty state */}
          {filteredCtaPosts.length === 0 && leadMagnets.length === 0 && (
            <div className="rounded-lg border border-dashed p-12 text-center">
              <Magnet className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <p className="mt-4 text-muted-foreground">No lead magnets found</p>
              <p className="mt-1 text-sm text-muted-foreground/70">
                Posts with &quot;comment X to get&quot; CTAs will automatically appear here.
              </p>
            </div>
          )}
        </div>
      ) : (
        /* Discovered tab */
        <div>
          <div className="grid gap-4 md:grid-cols-2">
            {filteredDiscovered.length === 0 ? (
              <div className="col-span-2 rounded-lg border border-dashed p-12 text-center">
                <Sparkles className="mx-auto h-12 w-12 text-muted-foreground/50" />
                <p className="mt-4 text-muted-foreground">
                  {creatorFilter ? 'No posts from this creator' : 'No winning posts discovered yet'}
                </p>
                <p className="mt-1 text-sm text-muted-foreground/70">
                  {creatorFilter
                    ? 'Try selecting a different creator or clear the filter.'
                    : 'High-performing LinkedIn posts will appear here as they are scraped and analyzed.'}
                </p>
              </div>
            ) : (
              filteredDiscovered.map(renderPostCard)
            )}
          </div>
          {hasMore && !creatorFilter && filteredDiscovered.length > 0 && (
            <div className="mt-6 flex justify-center">
              <button
                onClick={() => fetchWinningPosts(false)}
                disabled={loadingMore}
                className="flex items-center gap-2 rounded-lg border bg-card px-6 py-2.5 text-sm font-medium hover:bg-secondary transition-colors disabled:opacity-50"
              >
                {loadingMore ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4" />
                    Load More Posts
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Submit Modal */}
      {showSubmitModal && (
        <SubmitModal onClose={() => setShowSubmitModal(false)} onSubmit={fetchData} />
      )}
    </div>
  );
}

// Submit Modal Component
function SubmitModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: () => void;
}) {
  const [type, setType] = useState<'post' | 'lead_magnet'>('post');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  // Post fields
  const [content, setContent] = useState('');
  const [postType, setPostType] = useState('');
  const [postNiche, setPostNiche] = useState('');
  const [likesCount, setLikesCount] = useState('');
  const [commentsCount, setCommentsCount] = useState('');
  const [leadsGenerated, setLeadsGenerated] = useState('');
  const [notes, setNotes] = useState('');

  // Lead magnet fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [lmContent, setLmContent] = useState('');
  const [format, setFormat] = useState('');
  const [lmNiche, setLmNiche] = useState('');
  const [lmLeads, setLmLeads] = useState('');
  const [conversionRate, setConversionRate] = useState('');

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const body =
        type === 'post'
          ? {
              type: 'post',
              content,
              post_type: postType || undefined,
              niche: postNiche || undefined,
              likes_count: likesCount ? parseInt(likesCount) : undefined,
              comments_count: commentsCount ? parseInt(commentsCount) : undefined,
              leads_generated: leadsGenerated ? parseInt(leadsGenerated) : undefined,
              notes: notes || undefined,
            }
          : {
              type: 'lead_magnet',
              title,
              description: description || undefined,
              content: lmContent || undefined,
              format: format || undefined,
              niche: lmNiche || undefined,
              leads_generated: lmLeads ? parseInt(lmLeads) : undefined,
              conversion_rate: conversionRate ? parseFloat(conversionRate) : undefined,
            };

      const response = await fetch('/api/swipe-file/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        setSuccess(true);
        setTimeout(() => {
          onSubmit();
          onClose();
        }, 1500);
      }
    } catch (error) {
      logError('swipe-file', error, { step: 'submit_error' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="Submit to Swipe File">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-background p-6">
        <h2 className="mb-4 text-lg font-semibold">Submit to Swipe File</h2>

        {success ? (
          <div className="py-8 text-center">
            <Check className="mx-auto h-12 w-12 text-green-500" />
            <p className="mt-4 font-medium">Submitted for review!</p>
            <p className="mt-1 text-sm text-muted-foreground">
              We&apos;ll review your submission and add it to the swipe file.
            </p>
          </div>
        ) : (
          <>
            {/* Type toggle */}
            <div className="mb-4 flex gap-2">
              <button
                onClick={() => setType('post')}
                className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
                  type === 'post'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary hover:bg-secondary/80'
                }`}
              >
                Post
              </button>
              <button
                onClick={() => setType('lead_magnet')}
                className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
                  type === 'lead_magnet'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary hover:bg-secondary/80'
                }`}
              >
                Lead Magnet
              </button>
            </div>

            {type === 'post' ? (
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium">Post Content *</label>
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className="h-32 w-full rounded-lg border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                    placeholder="Paste your LinkedIn post content..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-sm font-medium">Post Type</label>
                    <select
                      value={postType}
                      onChange={(e) => setPostType(e.target.value)}
                      className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                    >
                      {POST_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium">Niche</label>
                    <select
                      value={postNiche}
                      onChange={(e) => setPostNiche(e.target.value)}
                      className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                    >
                      {NICHES.map((n) => (
                        <option key={n.value} value={n.value}>
                          {n.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="mb-1 block text-sm font-medium">Likes</label>
                    <input
                      type="number"
                      value={likesCount}
                      onChange={(e) => setLikesCount(e.target.value)}
                      className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium">Comments</label>
                    <input
                      type="number"
                      value={commentsCount}
                      onChange={(e) => setCommentsCount(e.target.value)}
                      className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium">Leads</label>
                    <input
                      type="number"
                      value={leadsGenerated}
                      onChange={(e) => setLeadsGenerated(e.target.value)}
                      className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                      placeholder="0"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Why does this post work?
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="h-20 w-full rounded-lg border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                    placeholder="What made this post successful?"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium">Title *</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                    placeholder="e.g., The SaaS Pricing Calculator"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">Description</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="h-20 w-full rounded-lg border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                    placeholder="What does this lead magnet offer?"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-sm font-medium">Format</label>
                    <select
                      value={format}
                      onChange={(e) => setFormat(e.target.value)}
                      className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                    >
                      {FORMATS.map((f) => (
                        <option key={f.value} value={f.value}>
                          {f.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium">Niche</label>
                    <select
                      value={lmNiche}
                      onChange={(e) => setLmNiche(e.target.value)}
                      className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                    >
                      {NICHES.map((n) => (
                        <option key={n.value} value={n.value}>
                          {n.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-sm font-medium">Leads Generated</label>
                    <input
                      type="number"
                      value={lmLeads}
                      onChange={(e) => setLmLeads(e.target.value)}
                      className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium">Conversion Rate %</label>
                    <input
                      type="number"
                      step="0.1"
                      value={conversionRate}
                      onChange={(e) => setConversionRate(e.target.value)}
                      className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                      placeholder="0.0"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Lead Magnet Content (optional)
                  </label>
                  <textarea
                    value={lmContent}
                    onChange={(e) => setLmContent(e.target.value)}
                    className="h-32 w-full rounded-lg border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                    placeholder="Paste the lead magnet content if you want to share it..."
                  />
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="mt-6 flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 rounded-lg border py-2 text-sm font-medium hover:bg-secondary transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting || (type === 'post' ? !content : !title)}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Submit for Review'
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
