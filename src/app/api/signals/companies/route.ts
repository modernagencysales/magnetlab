import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { logError } from '@/lib/utils/logger';
import * as signalsService from '@/server/services/signals.service';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await signalsService.listCompanies(session.user.id);
    if (!result.success) {
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
    return NextResponse.json({ companies: result.companies });
  } catch (error) {
    logError('api/signals/companies', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const linkedinCompanyUrl = (body.linkedin_company_url as string)?.trim();
    const heyreachCampaignId = body.heyreach_campaign_id as string | undefined;

    const result = await signalsService.createCompany(session.user.id, {
      linkedin_company_url: linkedinCompanyUrl ?? '',
      heyreach_campaign_id: heyreachCampaignId ?? null,
    });

    if (!result.success) {
      if (result.error === 'validation') {
        return NextResponse.json({ error: result.message }, { status: 400 });
      }
      if (result.error === 'limit') {
        return NextResponse.json({ error: result.message }, { status: 400 });
      }
      if (result.error === 'conflict') {
        return NextResponse.json({ error: result.message }, { status: 409 });
      }
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
    return NextResponse.json({ company: result.company }, { status: 201 });
  } catch (error) {
    logError('api/signals/companies', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
