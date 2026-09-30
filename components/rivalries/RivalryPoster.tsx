"use client";
import { useRef, useState } from "react";
import Image from "next/image";
import { avatarById } from "@/lib/rivalries/catalog";
import BoardComposer from "@/components/board/BoardComposer";
import { boardWrite, getBoardMember } from "@/lib/board";
import { rivalryError } from "@/lib/rivalries/api";
export function RivalryPoster({
  userId,
  names,
  avatars,
  headline,
  score,
  terms,
  href,
}: {
  userId: string;
  names: [string, string];
  avatars: [string | null, string | null];
  headline: string;
  score: string;
  terms: string;
  href: string;
}) {
  const [includeNames, setIncludeNames] = useState(true);
  const [includeAvatars, setIncludeAvatars] = useState(true);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [board, setBoard] = useState(false);
  const revision = useRef(0);
  function invalidate() {
    revision.current++;
    setUrl("");
    setBusy(false);
  }
  async function preview() {
    const current = ++revision.current;
    setBusy(true);
    setError("");
    setUrl("");
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 1200;
      canvas.height = 1500;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw Error("Poster preview is unavailable in this browser.");
      ctx.fillStyle = "#101a2b";
      ctx.fillRect(0, 0, 1200, 1500);
      ctx.fillStyle = "#ed692f";
      ctx.fillRect(0, 0, 1200, 24);
      ctx.fillRect(0, 1468, 1200, 32);
      ctx.textAlign = "center";
      ctx.fillStyle = "#ed692f";
      ctx.font = "800 30px sans-serif";
      ctx.fillText("ROCHESTER DARTING DEGENS", 600, 100);
      ctx.fillStyle = "#f6e9ce";
      ctx.font = "900 70px sans-serif";
      headline
        .split(" ")
        .reduce((lines: string[], word) => {
          const last = lines.at(-1) ?? "";
          if (ctx.measureText(`${last} ${word}`).width > 1050) lines.push(word);
          else if (lines.length) lines[lines.length - 1] = `${last} ${word}`;
          else lines.push(word);
          return lines;
        }, [])
        .forEach((line, i) => ctx.fillText(line, 600, 230 + i * 85));
      if (includeAvatars)
        await Promise.all(
          avatars.map(async (id, i) => {
            const avatar = avatarById(id);
            if (!avatar) return;
            const img = new window.Image();
            img.src = avatar.image;
            await img.decode();
            ctx.drawImage(img, i ? 620 : 20, 480, 560, 560);
          }),
        );
      ctx.fillStyle = "#f6e9ce";
      names.forEach((name, i) => {
        let size = 45;
        ctx.font = `900 ${size}px sans-serif`;
        const text = includeNames ? name : `Player ${i + 1}`;
        while (size > 16 && ctx.measureText(text).width > 530) {
          ctx.font = `900 ${--size}px sans-serif`;
        }
        ctx.fillText(text, i ? 900 : 300, 1120, 530);
      });
      ctx.font = "900 115px sans-serif";
      ctx.fillText(score, 600, 1270);
      ctx.font = "500 26px sans-serif";
      const words = terms.split(" ");
      let line = "",
        y = 1345;
      for (const word of words) {
        if (ctx.measureText(`${line} ${word}`).width > 1040) {
          ctx.fillText(line, 600, y);
          y += 34;
          line = word;
        } else line += `${line ? " " : ""}${word}`;
      }
      ctx.fillText(line, 600, y);
      ctx.font = "500 20px sans-serif";
      ctx.fillText("Recorded league games · The Rivalry Room", 600, 1435);
      if (current === revision.current) setUrl(canvas.toDataURL("image/png"));
    } catch (cause) {
      if (current === revision.current) setError(rivalryError(cause));
    } finally {
      if (current === revision.current) setBusy(false);
    }
  }
  async function openBoard() {
    setError("");
    try {
      const member = await getBoardMember(userId);
      if (member?.status !== "approved")
        throw Error("The League Board requires approved board membership.");
      setBoard(true);
    } catch (cause) {
      setError(rivalryError(cause));
    }
  }
  return (
    <div className="rr-poster">
      <p>
        Review the poster before downloading. The Board post includes text and a rivalry link. The downloaded poster image
        is not attached.
      </p>
      <div className="rr-actions">
        <label>
          <input
            type="checkbox"
            checked={includeNames}
            onChange={(e) => {
              setIncludeNames(e.target.checked);
              invalidate();
            }}
          />{" "}
          Include player names
        </label>
        <label>
          <input
            type="checkbox"
            checked={includeAvatars}
            onChange={(e) => {
              setIncludeAvatars(e.target.checked);
              invalidate();
            }}
          />{" "}
          Include avatars
        </label>
      </div>
      <div className="rr-actions">
        <button disabled={busy} onClick={() => void preview()}>
          {busy ? "Creating preview…" : "Preview poster"}
        </button>
        {url && (
          <a
            className="rr-primary"
            href={url}
            download="rdd-rivalry-poster.png"
          >
            Download this poster
          </a>
        )}
        <button onClick={() => void openBoard()}>Draft a text post for the Board</button>
      </div>
      {url && (
        <Image
          src={url}
          alt="Exact poster download preview"
          width={1200}
          height={1500}
          unoptimized
          style={{ width: "100%", maxWidth: 400, height: "auto", display: "block", margin: "16px auto" }}
        />
      )}
      {board && (
        <BoardComposer
          draftKey={`rdd:rivalry-board:${userId}:${href}`}
          label="Review your Board post"
          submitLabel="Post to League Board"
          initialTopic="highlight"
          initialBody={`${includeNames ? names.join(" vs ") : "A league rivalry"} · ${score}\n${terms}\n${href}`}
          onCancel={() => setBoard(false)}
          onSubmit={async (body, topic, id) => {
            await boardWrite("create_post", undefined, body, topic, id);
          }}
        />
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
