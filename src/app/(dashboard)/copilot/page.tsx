/** /copilot → redirect to homepage. Prevents 404 when Next.js prefetches parent route. */

import { redirect } from 'next/navigation';

export default function CopilotIndexPage() {
  redirect('/');
}
