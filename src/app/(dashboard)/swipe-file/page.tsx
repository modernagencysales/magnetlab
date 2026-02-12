import { permanentRedirect } from 'next/navigation';

export default function SwipeFileRedirect() {
  permanentRedirect('/posts?tab=inspiration');
}
