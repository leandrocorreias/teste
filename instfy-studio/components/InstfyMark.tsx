/** Original Instfy mark: an eight-point asterisk in a disc. Pure SVG, no raster assets. */
export function InstfyMark({ size = 28, discColor, inkColor }: { size?: number; discColor?: string; inkColor?: string }) {
  const spokes = Array.from({ length: 8 }, (_, i) => (i * 360) / 8);
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" role="presentation">
      <circle cx="20" cy="20" r="20" fill={discColor ?? 'var(--c-accent, #A8D92A)'} />
      {spokes.map((deg) => (
        <rect
          key={deg}
          x="18.6"
          y="8"
          width="2.8"
          height="24"
          rx="1.4"
          fill={inkColor ?? 'var(--c-accent-ink, #14201B)'}
          transform={`rotate(${deg} 20 20)`}
        />
      ))}
    </svg>
  );
}

export function InstfyLockup({
  size = 24,
  inverted = false,
  label = 'Instfy',
}: {
  size?: number;
  inverted?: boolean;
  label?: string;
}) {
  return (
    <span className="inline-flex items-center gap-2 align-middle">
      <InstfyMark size={size} />
      <span
        style={{
          fontFamily: 'var(--f-display)',
          fontWeight: 600,
          fontSize: size * 0.82,
          letterSpacing: '-0.02em',
          color: inverted ? 'var(--c-chapter-ink)' : 'var(--c-ink)',
        }}
      >
        {label}
      </span>
    </span>
  );
}
