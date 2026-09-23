import { Coins, ShoppingBag } from 'lucide-react';

export default function WalletButton({ credits, onClick }: { credits: number; onClick: () => void }) {
  return <button className="wallet-button" onClick={onClick} aria-label={`Open pit shop, ${credits} credits`}>
    <ShoppingBag size={15} /><span>Pit shop</span><i /><Coins size={14} /><strong>{credits.toLocaleString()}</strong><small>CR</small>
  </button>;
}