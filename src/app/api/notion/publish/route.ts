// API Route: Publish to Notion
// POST /api/notion/publish
//
// Note: Access tokens are decrypted only when needed for API calls.

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { NotionClient } from '@/lib/integrations/notion';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { getNotionConnection } from '@/lib/utils/encrypted-storage';
import type { ExtractedContent } from '@/lib/types/lead-magnet';

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { leadMagnetId, parentPageId, content, icon } = body as {
      leadMagnetId: string;
      parentPageId?: string;
      content: ExtractedContent;
      icon?: string;
    };

    if (!leadMagnetId || !content) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Get Notion connection with decrypted access token
    const connection = await getNotionConnection(session.user.id);

    if (!connection) {
      return NextResponse.json({ error: 'Notion not connected' }, { status: 400 });
    }

    // Use default parent page if not specified
    const targetParentId = parentPageId || connection.default_parent_page_id;
    if (!targetParentId) {
      return NextResponse.json(
        { error: 'No parent page specified. Please select a page or set a default.' },
        { status: 400 }
      );
    }

    // Create the Notion page using decrypted access token
    const notion = new NotionClient({ accessToken: connection.access_token });
    const page = await notion.createLeadMagnetPage(targetParentId, content, icon);

    // Update lead magnet with Notion info
    const supabase = createSupabaseAdminClient();
    await supabase
      .from('lead_magnets')
      .update({
        notion_page_id: page.id,
        notion_page_url: page.url,
      })
      .eq('id', leadMagnetId)
      .eq('user_id', session.user.id);

    return NextResponse.json({
      pageId: page.id,
      pageUrl: page.url,
      title: page.title,
    });
  } catch (error) {
    console.error('Notion publish error:', error);
    return NextResponse.json(
      { error: 'Failed to publish to Notion' },
      { status: 500 }
    );
  }
}
