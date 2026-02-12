import { permanentRedirect } from 'next/navigation';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function LibraryDetailRedirect({ params }: PageProps) {
  const { id } = await params;
  permanentRedirect(`/magnets/${id}`);
}
