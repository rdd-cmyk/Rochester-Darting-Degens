'use client';

import Link from 'next/link';
import { formatPlayerName } from '@/lib/playerName';

type LinkedPlayerNameProps =
  | {
      playerId: string;
      display_name: string | null | undefined;
      first_name: string | null | undefined;
      preformattedName?: undefined;
    }
  | {
      playerId: string;
      preformattedName: string;
      display_name?: undefined;
      first_name?: undefined;
    };

export function LinkedPlayerName(props: LinkedPlayerNameProps) {
  const { playerId } = props;

  const name =
    'preformattedName' in props
      ? props.preformattedName
      : formatPlayerName(props.display_name, props.first_name);

  return (
    <Link
      href={`/profiles/${playerId}`}
      style={{ color: '#0366d6', textDecoration: 'underline' }}
    >
      {name}
    </Link>
  );
}
