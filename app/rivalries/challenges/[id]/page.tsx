import { RivalryRoom } from "@/components/rivalries/RivalryRoom";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <RivalryRoom challengeId={id} />;
}
