import type { Metadata } from "next";
import { formatPlayerName } from "@/lib/playerName";
import { supabase } from "@/lib/supabaseClient";

type Props = {
  children: React.ReactNode;
  params: { id: string };
};

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  if (!params?.id) {
    return { title: "Profile" };
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("display_name, first_name")
    .eq("id", params.id)
    .single();

  if (error) {
    console.error("Error loading profile metadata", error);
  }

  const displayName = data
    ? formatPlayerName(data.display_name, data.first_name)
    : null;

  return {
    title: displayName || "Profile",
  };
}

export default function ProfileLayout({ children }: Props) {
  return <>{children}</>;
}
