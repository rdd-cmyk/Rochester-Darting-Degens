import { notFound } from 'next/navigation';
import LeagueBoard from '@/components/board/LeagueBoard';

export default async function BoardThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) notFound();
  return <LeagueBoard postId={id} />;
}
