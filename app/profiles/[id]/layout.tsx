import type { Metadata } from "next";
import { formatPlayerName } from "@/lib/playerName";
import { supabase } from "@/lib/supabaseClient";

type Props = {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const resolvedParams = await params;

  if (!resolvedParams?.id) {
    return { title: { absolute: "RDD - Player Profile" } };
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("display_name, first_name, include_first_name_in_display")
    .eq("id", resolvedParams.id)
    .maybeSingle();

  if (error) {
    console.error("Error loading profile metadata", error);
  }

  const displayName = data
    ? formatPlayerName(
        data.display_name,
        data.first_name,
        data.include_first_name_in_display
      )
    : null;

  return {
    title: {
      absolute: displayName
        ? `RDD - ${displayName}`
        // This server client has no browser session. RLS can hide an existing
        // profile, so an empty result cannot establish that the player is missing.
        : "RDD - Player Profile",
    },
  };
}

export default async function ProfileLayout({ children }: Props) {
  return <>{children}</>;
}
