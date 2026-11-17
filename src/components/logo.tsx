// rideff "RDE" mark, transparent PNG (public/brand/rideff-mark.png, 676x349).
// Sized by height so it sits on the same baseline as the old square tile.
export function LogoTile({ size = 32 }: { size?: number }) {
  const h = Math.round(size * 0.78);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/brand/rideff-mark.png"
      alt=""
      aria-hidden
      width={Math.round((h * 676) / 349)}
      height={h}
      className="flex-none select-none"
      draggable={false}
    />
  );
}
