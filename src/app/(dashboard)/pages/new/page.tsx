import { permanentRedirect } from 'next/navigation';

// /pages/new redirects to the quick page creator
export default function PagesNewRedirect() {
  permanentRedirect('/create/page-quick');
}
