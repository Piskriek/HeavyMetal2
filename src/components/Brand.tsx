import logo from '../assets/ui/logo.webp';

interface Props { compact?: boolean; onClick?: () => void }

export default function Brand({ compact = false, onClick }: Props) {
  const contents = <img className="brand-logo" src={logo} alt="Heavy metal GP" draggable={false} />;
  return onClick
    ? <button className={`brand ${compact ? 'brand-compact' : ''}`} onClick={onClick} aria-label="Heavy metal GP garage">{contents}</button>
    : <div className={`brand ${compact ? 'brand-compact' : ''}`}>{contents}</div>;
}