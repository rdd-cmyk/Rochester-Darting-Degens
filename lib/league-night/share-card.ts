import type { NightAward } from "./recap";

/** One canvas is both the exact on-screen preview and the downloaded card. */
export function drawShareCard(
  canvas: HTMLCanvasElement,
  date: string,
  games: number,
  players: number,
  awards: NightAward[],
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return false;
  canvas.width = 1200;
  function wrap(text: string, font: string, width = 984) {
    ctx!.font = font;
    const lines: string[] = [];
    let line = "";
    // Word wrapping with a character fallback keeps even unbroken names inside.
    for (const word of text.split(/(\s+)/)) {
      if (ctx!.measureText(line + word).width <= width) {
        line += word;
        continue;
      }
      if (line.trim()) lines.push(line.trim());
      line = "";
      for (const char of word.trimStart()) {
        if (ctx!.measureText(line + char).width > width) {
          lines.push(line);
          line = "";
        }
        line += char;
      }
    }
    if (line.trim()) lines.push(line.trim());
    return lines;
  }
  const cards = awards.map((a) => ({
    award: a,
    name: wrap(a.playerName, "bold 40px Arial"),
    reason: wrap(a.reason, "28px Arial"),
    scope: wrap(a.scope, "24px Arial"),
  }));
  const sizes = cards.map(
    (c) =>
      115 + c.name.length * 49 + c.reason.length * 36 + c.scope.length * 32,
  );
  canvas.height = Math.max(
    680,
    360 + sizes.reduce((a, b) => a + b + 22, 0) + 120,
  );
  ctx.fillStyle = "#08264d";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "#ffffff0c";
  ctx.lineWidth = 28;
  for (const radius of [125, 190, 255]) {
    ctx.beginPath();
    ctx.arc(1150, 80, radius, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.textBaseline = "top";
  ctx.fillStyle = "#ff9a48";
  ctx.font = "bold 21px Arial";
  ctx.fillText("ROCHESTER DARTING DEGENS  /  LEAGUE NIGHT", 64, 54);
  ctx.fillStyle = "#fff3dc";
  ctx.font = "bold 64px Arial";
  ctx.fillText("A night worth talking about.", 64, 106);
  ctx.fillStyle = "#c4d5ec";
  ctx.font = "28px Arial";
  ctx.fillText(date, 64, 192);
  ctx.fillStyle = "#ff9a48";
  ctx.font = "bold 30px Arial";
  ctx.fillText(
    `${games} games  ·  ${players} players  ·  So far tonight`,
    64,
    256,
  );
  let y = 334;
  cards.forEach((c, index) => {
    ctx.fillStyle = "#12365e";
    ctx.beginPath();
    ctx.roundRect(64, y, 1072, sizes[index], 20);
    ctx.fill();
    ctx.fillStyle = "#ff9a48";
    ctx.fillRect(64, y + 24, 5, sizes[index] - 48);
    let lineY = y + 28;
    ctx.font = "bold 21px Arial";
    ctx.fillText(c.award.title.toUpperCase(), 94, lineY);
    lineY += 39;
    ctx.fillStyle = "#fff3dc";
    ctx.font = "bold 40px Arial";
    c.name.forEach((line) => {
      ctx.fillText(line, 94, lineY);
      lineY += 49;
    });
    lineY += 8;
    ctx.font = "28px Arial";
    c.reason.forEach((line) => {
      ctx.fillText(line, 94, lineY);
      lineY += 36;
    });
    lineY += 10;
    ctx.fillStyle = "#b8cde8";
    ctx.font = "24px Arial";
    c.scope.forEach((line) => {
      ctx.fillText(line, 94, lineY);
      lineY += 32;
    });
    y += sizes[index] + 22;
  });
  if (!cards.length) {
    ctx.fillStyle = "#fff3dc";
    ctx.font = "36px Arial";
    ctx.fillText("Good darts. Better company.", 64, 390);
  }
  ctx.fillStyle = "#b8cde8";
  ctx.font = "21px Arial";
  ctx.fillText(
    "Confirmed site results. Awards use available recorded history.",
    64,
    canvas.height - 78,
  );
  ctx.fillText(
    "Night contributions only; formats and board types stay separate.",
    64,
    canvas.height - 46,
  );
  return true;
}
