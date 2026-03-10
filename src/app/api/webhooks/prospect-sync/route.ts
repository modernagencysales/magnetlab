import { NextRequest, NextResponse } from 'next/server';
import { importProspects } from '@/server/services/signals.service';

const WEBHOOK_SECRET = process.env.PROSPECT_SYNC_SECRET;
const SYNC_USER_ID = process.env.SIGNAL_SYNC_USER_ID;

function parseMonthlyIncome(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[^0-9.kKmM]/g, '');
  const lower = cleaned.toLowerCase();
  if (lower.endsWith('k')) return parseFloat(lower) * 1000;
  if (lower.endsWith('m')) return parseFloat(lower) * 1_000_000;
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-webhook-secret');
  if (!WEBHOOK_SECRET || !secret || secret !== WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!SYNC_USER_ID) {
    return NextResponse.json({ error: 'SIGNAL_SYNC_USER_ID not configured' }, { status: 500 });
  }

  const body = await req.json();
  const prospect = body.prospect;
  if (!prospect || !prospect.linkedin_url) {
    return NextResponse.json({ error: 'prospect with linkedin_url required' }, { status: 400 });
  }

  const monthlyIncome = parseMonthlyIncome(prospect.monthly_income);

  const prospectData = {
    linkedin_url: prospect.linkedin_url,
    full_name: prospect.full_name || '',
    company: prospect.company || null,
    prospect_id: prospect.id || null,
    custom_data: {
      authority_score: prospect.authority_score ?? null,
      monthly_income: monthlyIncome,
      has_viewed_blueprint: !!prospect.first_viewed_at,
      blueprint_views: prospect.view_count ?? 0,
      qualified: prospect.qualified ? 'qualified' : 'not qualified',
      blueprint_slug: prospect.slug ?? null,
    },
  };

  const result = await importProspects(SYNC_USER_ID, [prospectData]);
  return NextResponse.json(result);
}
