'use client';

import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Loader2, Zap, Check } from 'lucide-react';
import { format, startOfWeek, addWeeks, subWeeks } from 'date-fns';
import type { WeekPlan, PillarDistribution } from '@/lib/types/content-pipeline';
import { PillarDistributionSlider } from './PillarDistributionSlider';
import { WeekGrid } from './WeekGrid';

export function PlannerView() {
  const [currentWeek, setCurrentWeek] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [plan, setPlan] = useState<WeekPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [approving, setApproving] = useState(false);
  const [postsPerWeek, setPostsPerWeek] = useState(5);
  const [pillarDistribution, setPillarDistribution] = useState<PillarDistribution>({
    moments_that_matter: 25,
    teaching_promotion: 25,
    human_personal: 25,
    collaboration_social_proof: 25,
  });

  const fetchPlan = useCallback(async () => {
    setLoading(true);
    try {
      const weekDate = format(currentWeek, 'yyyy-MM-dd');
      const response = await fetch(`/api/content-pipeline/planner?week=${weekDate}`);
      const data = await response.json();
      const plans = data.plans || [];
      const match = plans.find((p: WeekPlan) => p.week_start_date === weekDate);
      setPlan(match || null);
      if (match) {
        setPostsPerWeek(match.posts_per_week);
        setPillarDistribution({
          moments_that_matter: match.pillar_moments_pct,
          teaching_promotion: match.pillar_teaching_pct,
          human_personal: match.pillar_human_pct,
          collaboration_social_proof: match.pillar_collab_pct,
        });
      }
    } catch {
      // Silent failure
    } finally {
      setLoading(false);
    }
  }, [currentWeek]);

  useEffect(() => {
    fetchPlan();
  }, [fetchPlan]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const response = await fetch('/api/content-pipeline/planner/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          week_start_date: format(currentWeek, 'yyyy-MM-dd'),
          posts_per_week: postsPerWeek,
          pillar_distribution: pillarDistribution,
        }),
      });
      if (response.ok) {
        const data = await response.json();
        setPlan(data.plan);
      }
    } catch {
      // Silent failure
    } finally {
      setGenerating(false);
    }
  };

  const handleApprove = async () => {
    if (!plan) return;
    setApproving(true);
    try {
      const response = await fetch('/api/content-pipeline/planner/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_id: plan.id }),
      });
      if (response.ok) {
        await fetchPlan();
      }
    } catch {
      // Silent failure
    } finally {
      setApproving(false);
    }
  };

  return (
    <div className="rounded-xl border bg-card p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-semibold">Week Planner</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentWeek(subWeeks(currentWeek, 1))}
            className="rounded-lg p-1.5 hover:bg-secondary transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-medium">
            Week of {format(currentWeek, 'MMM d')}
          </span>
          <button
            onClick={() => setCurrentWeek(addWeeks(currentWeek, 1))}
            className="rounded-lg p-1.5 hover:bg-secondary transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-end gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium">Posts per week</label>
              <input
                type="number"
                min={1}
                max={14}
                value={postsPerWeek}
                onChange={(e) => setPostsPerWeek(parseInt(e.target.value) || 5)}
                disabled={plan?.status === 'approved'}
                className="w-20 rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
              />
            </div>
          </div>

          <div className="mb-4">
            <PillarDistributionSlider
              value={pillarDistribution}
              onChange={setPillarDistribution}
              disabled={plan?.status === 'approved'}
            />
          </div>

          {plan && plan.planned_posts && plan.planned_posts.length > 0 && (
            <div className="mb-4">
              <WeekGrid plan={plan} weekStart={currentWeek} />
            </div>
          )}

          {plan?.generation_notes && (
            <p className="mb-4 text-xs text-muted-foreground">{plan.generation_notes}</p>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleGenerate}
              disabled={generating || plan?.status === 'approved'}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {generating ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Generating...</>
              ) : (
                <><Zap className="h-4 w-4" /> {plan ? 'Regenerate Plan' : 'Generate Plan'}</>
              )}
            </button>

            {plan && plan.status === 'draft' && (
              <button
                onClick={handleApprove}
                disabled={approving}
                className="flex items-center gap-2 rounded-lg border border-green-300 px-4 py-2 text-sm font-medium text-green-700 hover:bg-green-50 dark:border-green-800 dark:text-green-400 dark:hover:bg-green-950 disabled:opacity-50 transition-colors"
              >
                {approving ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Approving...</>
                ) : (
                  <><Check className="h-4 w-4" /> Approve Plan</>
                )}
              </button>
            )}

            {plan?.status === 'approved' && (
              <span className="flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1.5 text-sm font-medium text-green-700 dark:bg-green-950 dark:text-green-300">
                <Check className="h-4 w-4" /> Approved
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
