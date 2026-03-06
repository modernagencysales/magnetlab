'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { logError } from '@/lib/utils/logger';
import { createSupabaseBrowserClient } from '@/lib/utils/supabase-browser';
import * as swipeFileApi from '@/frontend/api/swipe-file';
import * as creatorsApi from '@/frontend/api/content-pipeline/creators';

export interface SwipePost {
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

export interface SwipeLeadMagnet {
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

export interface DiscoveredPost {
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

const PAGE_SIZE = 50;

export function useSwipeFileContent() {
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

  // Filter discovered/CTA posts by creator and topic
  const filteredDiscovered = useMemo(() => {
    let filtered = discoveredPosts;
    if (creatorFilter) {
      filtered = filtered.filter((p) => p.author_url === creatorFilter);
    }
    if (topicFilter) {
      filtered = filtered.filter((p) => p.topics?.includes(topicFilter));
    }
    const orderKey = discoveredSort === 'engagement' ? 'engagement_score' : 'created_at';
    return [...filtered].sort((a, b) => {
      if (orderKey === 'engagement_score') return b.engagement_score - a.engagement_score;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [discoveredPosts, creatorFilter, topicFilter, discoveredSort]);

  const filteredCtaPosts = useMemo(() => {
    let filtered = ctaPosts;
    if (creatorFilter) {
      filtered = filtered.filter((p) => p.author_url === creatorFilter);
    }
    if (topicFilter) {
      filtered = filtered.filter((p) => p.topics?.includes(topicFilter));
    }
    return [...filtered].sort((a, b) => b.engagement_score - a.engagement_score);
  }, [ctaPosts, creatorFilter, topicFilter]);

  const fetchWinningPosts = useCallback(
    async (reset: boolean) => {
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
          .select(
            'id, author_name, author_headline, author_url, content, likes, comments, shares, engagement_score, template_extracted, extracted_template_id, is_lead_magnet, topics, created_at'
          )
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
    },
    [allWinningPosts.length, discoveredSort, topicFilter]
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      if (activeTab === 'posts') {
        const data = await swipeFileApi.listPosts({
          niche: niche || undefined,
          type: postType || undefined,
          featured: featuredOnly || undefined,
        });
        setPosts((data.posts || []) as SwipePost[]);
        setLoading(false);
      } else if (activeTab === 'lead-magnets' || activeTab === 'discovered') {
        if (allWinningPosts.length === 0) {
          await fetchWinningPosts(true);
        } else {
          setLoading(false);
        }

        if (activeTab === 'lead-magnets') {
          const data = await swipeFileApi.listLeadMagnets({
            niche: niche || undefined,
            format: format || undefined,
            featured: featuredOnly || undefined,
          });
          setLeadMagnets((data.leadMagnets || []) as SwipeLeadMagnet[]);
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
      await creatorsApi.addCreator({
        linkedin_url: post.author_url,
        name: post.author_name ?? null,
        headline: post.author_headline ?? null,
      });
      setTrackedCreatorUrls((prev) => new Set(prev).add(post.author_url!));
    } catch (error) {
      logError('swipe-file', error, { step: 'track_creator_error' });
    } finally {
      setTrackingInProgress(null);
    }
  };

  return {
    // Tab
    activeTab,
    setActiveTab,
    // Data
    posts,
    leadMagnets,
    ctaPosts,
    discoveredPosts,
    filteredDiscovered,
    filteredCtaPosts,
    fetchData,
    // Loading
    loading,
    loadingMore,
    hasMore,
    // Filters
    niche,
    setNiche,
    postType,
    setPostType,
    format,
    setFormat,
    featuredOnly,
    setFeaturedOnly,
    // Discovered filters
    discoveredSort,
    setDiscoveredSort,
    creatorFilter,
    setCreatorFilter,
    topicFilter,
    setTopicFilter,
    creatorOptions,
    // UI state
    expandedPostIds,
    copiedId,
    trackedCreatorUrls,
    trackingInProgress,
    showSubmitModal,
    setShowSubmitModal,
    // Handlers
    fetchWinningPosts,
    handleCopy,
    toggleExpandPost,
    handleTrackCreator,
  };
}
