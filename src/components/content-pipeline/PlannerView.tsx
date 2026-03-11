'use client';

import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Loader2, Zap, Check } from 'lucide-react';
import { Button, Input, Label, Badge } from '@magnetlab/magnetui';
import { format, startOfWeek, addWeeks, subWeeks } from 'date-fns';
import type { WeekPlan, PillarDistribution } from '@/lib/types/content-pipeline';
import { PillarDistributionSlider } from './PillarDistributionSlider';
import { WeekGrid } from './WeekGrid';
import * as plannerApi from '@/frontend/api/content-pipeline/planner';

export function PlannerView() {
  const [currentWeek, setCurrentWeek] = useState<Date | null>(null);
  const [plan, setPlan] = useState<WeekPlan | null>(null);
  const [loading, setLoading] = useState(true);

  // Initialize date after mount to avoid hydration mismatch
  useEffect(() => {
    setCurrentWeek(startOfWeek(new Date(), { weekStartsOn: 1 }));
  }, []);
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
    if (!currentWeek) return;
    setLoading(true);
    try {
      const weekDate = format(currentWeek, 'yyyy-MM-dd');
      const data = await plannerApi.listPlans({ week: weekDate });
      const plans = (data.plans || []) as WeekPlan[];
      const match = plans.find((p) => p.week_start_date === weekDate);
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
    if (!currentWeek) return;
    setGenerating(true);
    try {
      const data = await plannerApi.generatePlan({
        week_start_date: format(currentWeek, 'yyyy-MM-dd'),
        posts_per_week: postsPerWeek,
        pillar_distribution: pillarDistribution as unknown as Record<string, number>,
      });
      if (data.plan) setPlan(data.plan as WeekPlan);
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
      await plannerApi.approvePlan(plan.id);
      await fetchPlan();
    } catch {
      // Silent failure
    } finally {
      setApproving(false);
    }
  };

  if (!currentWeek) {
    return (
      <div className="rounded-xl border bg-card p-6">
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-semibold">Week Planner</h3>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setCurrentWeek(subWeeks(currentWeek, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium">Week of {format(currentWeek, 'MMM d')}</span>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setCurrentWeek(addWeeks(currentWeek, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
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
              <Label className="mb-1.5">Posts per week</Label>
              <Input
                type="number"
                min={1}
                max={14}
                value={postsPerWeek}
                onChange={(e) => setPostsPerWeek(parseInt(e.target.value) || 5)}
                disabled={plan?.status === 'approved'}
                className="w-20"
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
            <Button onClick={handleGenerate} disabled={generating || plan?.status === 'approved'}>
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Generating...
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4" /> {plan ? 'Regenerate Plan' : 'Generate Plan'}
                </>
              )}
            </Button>

            {plan && plan.status === 'draft' && (
              <Button
                variant="outline"
                onClick={handleApprove}
                disabled={approving}
                className="border-green-300 text-green-700 hover:bg-green-50 dark:border-green-800 dark:text-green-400 dark:hover:bg-green-950"
              >
                {approving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Approving...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" /> Approve Plan
                  </>
                )}
              </Button>
            )}

            {plan?.status === 'approved' && (
              <Badge variant="green" className="gap-1.5">
                <Check className="h-4 w-4" /> Approved
              </Badge>
            )}
          </div>
        </>
      )}
    </div>
  );
}
