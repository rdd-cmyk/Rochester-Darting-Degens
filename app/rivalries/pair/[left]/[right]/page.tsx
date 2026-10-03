import { RivalryRoom } from "@/components/rivalries/RivalryRoom";
export default async function Page({
  params,
}: {
  params: Promise<{ left: string; right: string }>;
}) {
  const { left, right } = await params;
  return <RivalryRoom pair={[left, right]} />;
}
