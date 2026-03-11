/** Eval Judge. Uses Claude to grade AI coaching responses against rubric criteria.
 *  Returns structured scores for each criterion.
 *  Never imports NextRequest, NextResponse, or cookies. */

import Anthropic from '@anthropic-ai/sdk';
import type { EvalScenario, RubricItem } from './scenarios';

// ─── Types ───────────────────────────────────────────────

export interface JudgeResult {
  scenarioId: string;
  scenarioName: string;
  overallScore: number; // 0-100
  weightedScore: number; // 0-100, weighted by criterion importance
  criteria: CriterionScore[];
  mustIncludePass: boolean;
  mustNotIncludePass: boolean;
  judgeNotes: string;
}

export interface CriterionScore {
  criterion: string;
  description: string;
  weight: number;
  score: number; // 0-10
  reasoning: string;
}

// ─── Judge ───────────────────────────────────────────────

export async function judgeResponse(
  client: Anthropic,
  scenario: EvalScenario,
  aiResponse: string
): Promise<JudgeResult> {
  // Check must-include / must-not-include
  const mustIncludePass = scenario.mustInclude.every((s) =>
    aiResponse.toLowerCase().includes(s.toLowerCase())
  );
  const mustNotIncludePass = scenario.mustNotInclude.every(
    (s) => !aiResponse.toLowerCase().includes(s.toLowerCase())
  );

  // Build judge prompt
  const rubricText = scenario.rubric
    .map((r, i) => `${i + 1}. **${r.criterion}** (weight: ${r.weight}/5): ${r.description}`)
    .join('\n');

  const judgePrompt = `You are an expert evaluator of AI coaching quality. Grade the following AI coaching response against the rubric criteria.

## Context
- Scenario: ${scenario.name}
- Category: ${scenario.category}
- Coaching mode: ${scenario.programState.coachingMode}
- Active module: ${scenario.programState.activeModule}
- User message: "${scenario.userMessage}"

## AI Response
${aiResponse}

## Rubric
${rubricText}

## Instructions
For each criterion, score from 0-10:
- 0: Completely absent or violated
- 3: Present but poor quality
- 5: Adequate
- 7: Good
- 9-10: Excellent

Return ONLY valid JSON (no markdown fences):
{
  "criteria": [
    { "criterion": "criterion_name", "score": 7, "reasoning": "one sentence why" }
  ],
  "overall_notes": "one paragraph summary of response quality"
}`;

  const result = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [{ role: 'user', content: judgePrompt }],
  });

  const responseText = result.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('');

  let parsed: {
    criteria: Array<{ criterion: string; score: number; reasoning: string }>;
    overall_notes: string;
  };
  try {
    parsed = JSON.parse(responseText);
  } catch {
    // Fallback: try extracting JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[0]);
    } else {
      console.error('Judge failed to return valid JSON:', responseText);
      return {
        scenarioId: scenario.id,
        scenarioName: scenario.name,
        overallScore: 0,
        weightedScore: 0,
        criteria: scenario.rubric.map((r) => ({
          criterion: r.criterion,
          description: r.description,
          weight: r.weight,
          score: 0,
          reasoning: 'Judge parse error',
        })),
        mustIncludePass,
        mustNotIncludePass,
        judgeNotes: 'Judge returned unparseable response',
      };
    }
  }

  // Map judge scores to rubric items
  const criteria: CriterionScore[] = scenario.rubric.map((rubricItem: RubricItem) => {
    const judged = parsed.criteria.find((c) => c.criterion === rubricItem.criterion);
    return {
      criterion: rubricItem.criterion,
      description: rubricItem.description,
      weight: rubricItem.weight,
      score: judged?.score ?? 0,
      reasoning: judged?.reasoning ?? 'Not evaluated',
    };
  });

  // Calculate scores
  const totalPoints = criteria.reduce((sum, c) => sum + c.score, 0);
  const maxPoints = criteria.length * 10;
  const overallScore = Math.round((totalPoints / maxPoints) * 100);

  const weightedTotal = criteria.reduce((sum, c) => sum + c.score * c.weight, 0);
  const weightedMax = criteria.reduce((sum, c) => sum + 10 * c.weight, 0);
  const weightedScore = Math.round((weightedTotal / weightedMax) * 100);

  return {
    scenarioId: scenario.id,
    scenarioName: scenario.name,
    overallScore,
    weightedScore,
    criteria,
    mustIncludePass,
    mustNotIncludePass,
    judgeNotes: parsed.overall_notes,
  };
}
