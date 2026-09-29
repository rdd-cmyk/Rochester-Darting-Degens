import Link from "next/link";
/** Only exact private rivalry routes become links; no user-provided HTML. */
export function BoardBody({ body }: { body: string }) {
  const uuid = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
  const pattern = new RegExp(
    `(/rivalries/(?:challenges/${uuid}|pair/${uuid}/${uuid}))(?=$|\\s|[.,!?])`,
    "gi",
  );
  return (
    <p className="board-body">
      {body.split(pattern).map((part, i) =>
        i % 2 ? (
          <Link key={i} href={part}>
            Open rivalry ↗
          </Link>
        ) : (
          part
        ),
      )}
    </p>
  );
}
