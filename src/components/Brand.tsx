type BrandVariant = 'hero' | 'compact' | 'emblem';

interface BrandProps {
  variant?: BrandVariant;
  className?: string;
  /** Decorative brands are hidden from assistive technology. */
  decorative?: boolean;
}

/** Heavy Metal GP 2 identity. Art is always contained at its native aspect ratio. */
export default function Brand({ variant = 'compact', className = '', decorative = false }: BrandProps) {
  const emblem = variant === 'emblem';
  return (
    <span
      className={`brand brand-${variant} ${className}`.trim()}
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : 'Heavy Metal GP 2'}
      aria-hidden={decorative || undefined}
    >
      <img
        src={emblem ? '/art/ui/emblem-heavy-metal-2.png' : '/art/ui/logo-heavymetal2.png'}
        alt=""
        draggable={false}
      />
      {variant === 'hero' && <small>THE SCRAPDOME CHAMPIONSHIP</small>}
    </span>
  );
}
