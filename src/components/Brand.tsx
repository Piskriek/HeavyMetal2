interface Props { compact?: boolean; onClick?: () => void }

export default function Brand({ compact = false, onClick }: Props) {
  const contents = <>
    <svg className="brand-symbol" viewBox="0 0 43 35" fill="none" aria-hidden="true">
      <path d="M2 30 13 5h10L12 30H2Z" fill="currentColor" />
      <path d="M18 30 29 5h10L28 30H18Z" fill="currentColor" opacity=".58" />
      <circle cx="33" cy="27" r="6" fill="currentColor" />
    </svg>
    <span className="brand-wordmark">MARBLE<span>RUMBLE</span></span>
  </>;
  return onClick
    ? <button className={`brand ${compact ? 'brand-compact' : ''}`} onClick={onClick} aria-label="Marble Rumble garage">{contents}</button>
    : <div className={`brand ${compact ? 'brand-compact' : ''}`}>{contents}</div>;
}