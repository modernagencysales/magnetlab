import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { parseCSVTemplates, seedTemplatesFromCSV } from '@/lib/services/seed-templates';
import { logError } from '@/lib/utils/logger';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const csvContent = await file.text();
    const templates = parseCSVTemplates(csvContent);

    if (templates.length === 0) {
      return NextResponse.json(
        { error: 'No valid templates found in CSV' },
        { status: 400 }
      );
    }

    const result = await seedTemplatesFromCSV(templates, session.user.id);

    return NextResponse.json({
      message: `Import complete: ${result.imported} imported, ${result.skipped} skipped, ${result.errors} errors`,
      ...result,
      totalParsed: templates.length,
    });
  } catch (error) {
    logError('cp/templates/seed-csv', error, { step: 'seed_csv_error' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
