import { describe, it, expect } from 'vitest';
import { workflowRecipes } from '../../tools/category-tools.js';

describe('guide command', () => {
  it('create_lead_magnet recipe exists and is non-empty', () => {
    expect(workflowRecipes['create_lead_magnet']).toBeTruthy();
    expect(workflowRecipes['create_lead_magnet'].length).toBeGreaterThan(100);
  });

  it('list_tasks recipe lists all available tasks', () => {
    const listing = workflowRecipes['list_tasks'];
    expect(listing).toContain('create_lead_magnet');
    expect(listing).toContain('write_linkedin_post');
    expect(listing).toContain('setup_funnel');
    expect(listing).toContain('analyze_content_gaps');
    expect(listing).toContain('plan_content_week');
  });

  it('all recipe keys are valid', () => {
    for (const key of Object.keys(workflowRecipes)) {
      expect(typeof workflowRecipes[key]).toBe('string');
      expect(workflowRecipes[key].length).toBeGreaterThan(0);
    }
  });
});
