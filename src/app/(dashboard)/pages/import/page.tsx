import { permanentRedirect } from 'next/navigation';

// Redirect old /pages/import route to new /assets/import route
export default function PagesImportRedirect() {
  permanentRedirect('/assets/import');
}
