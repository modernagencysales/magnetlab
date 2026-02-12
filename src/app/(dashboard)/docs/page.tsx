import { permanentRedirect } from 'next/navigation';

export default function DocsRedirect() {
  permanentRedirect('/settings#api-docs');
}
