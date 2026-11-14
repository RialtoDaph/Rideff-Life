// The Life Wrapped card as a picture: drawn on a canvas so it can be shared or saved as an image.
// The score, its four parts and the money left over. Names are optional and left empty by default,
// so a card shared by a real household shows no names.

export type WrappedData = {
  title: string;
  month: string;
  names: string;
  scoreLabel: string;
  score: number | null;
  pillars: { label: string; score: number | null }[];
  leftLabel: string;
  left: string;
  made: string;
  serif: string;
};

export const CARD_W = 1080;
export const CARD_H = 1920;

export function drawWrapped(ctx: CanvasRenderingContext2D, d: WrappedData) {
  const mono = "ui-monospace, Menlo, monospace";
  ctx.fillStyle = "#0B0A09";
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  // A soft champagne glow behind the score.
  const g = ctx.createRadialGradient(CARD_W / 2, 760, 40, CARD_W / 2, 760, 760);
  g.addColorStop(0, "rgba(232,217,181,.28)");
  g.addColorStop(1, "rgba(232,217,181,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  ctx.textAlign = "left";
  ctx.fillStyle = "#E8D9B5";
  ctx.font = `700 34px ${mono}`;
  ctx.fillText(d.title.toUpperCase(), 90, 170);
  ctx.fillStyle = "#B3B0A8";
  ctx.fillText(d.month.toUpperCase(), 90, 222);

  ctx.textAlign = "center";
  ctx.fillStyle = "#F4F2EC";
  ctx.font = `400 460px ${d.serif}`;
  ctx.fillText(d.score === null ? "—" : String(d.score), CARD_W / 2, 860);
  ctx.fillStyle = "#E8D9B5";
  ctx.font = `700 36px ${mono}`;
  ctx.fillText(d.scoreLabel.toUpperCase(), CARD_W / 2, 940);

  // Four parts of the score in a row.
  d.pillars.forEach((p, i) => {
    const x = 180 + i * 240;
    ctx.fillStyle = "#F4F2EC";
    ctx.font = `400 96px ${d.serif}`;
    ctx.fillText(p.score === null ? "—" : String(p.score), x, 1180);
    ctx.fillStyle = "#8D8A83";
    ctx.font = `700 28px ${mono}`;
    ctx.fillText(p.label.toUpperCase(), x, 1230);
  });

  ctx.strokeStyle = "rgba(244,242,236,.16)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(90, 1370);
  ctx.lineTo(CARD_W - 90, 1370);
  ctx.stroke();

  ctx.fillStyle = "#F4F2EC";
  ctx.font = `400 170px ${d.serif}`;
  ctx.fillText(d.left, CARD_W / 2, 1580);
  ctx.fillStyle = "#B3B0A8";
  ctx.font = `700 32px ${mono}`;
  ctx.fillText(d.leftLabel.toUpperCase(), CARD_W / 2, 1650);

  ctx.fillStyle = "#8D8A83";
  ctx.font = `700 28px ${mono}`;
  if (d.names) ctx.fillText(d.names, CARD_W / 2, 1790);
  ctx.fillText(d.made.toUpperCase(), CARD_W / 2, 1840);
}
