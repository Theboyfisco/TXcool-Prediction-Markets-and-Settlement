"use client";

interface OddsBarProps {
  yesAmount: number;
  noAmount: number;
  yesLabel?: string;
  noLabel?: string;
}

export default function OddsBar({
  yesAmount,
  noAmount,
  yesLabel = "YES",
  noLabel = "NO",
}: OddsBarProps) {
  const total = yesAmount + noAmount;
  const yesPct = total === 0 ? 50 : Math.round((yesAmount / total) * 100);
  const noPct = 100 - yesPct;

  return (
    <div className="space-y-1.5">
      {/* Bar */}
      <div className="relative h-2 rounded-full overflow-hidden bg-white/5">
        <div
          className="absolute left-0 top-0 h-full bg-gradient-to-r from-[#00ff87] to-[#22d3ee] rounded-full transition-all duration-700 ease-out"
          style={{ width: `${yesPct}%` }}
        />
      </div>
      {/* Labels */}
      <div className="flex justify-between items-center text-[10px] font-bold">
        <span className="text-green-400 font-mono">
          {yesLabel} {yesPct}%
        </span>
        <span className="text-gray-500 text-[9px]">
          {total === 0 ? "No bets yet" : `${(total / 1_000_000).toFixed(0)} USDC total`}
        </span>
        <span className="text-purple-400 font-mono">
          {noPct}% {noLabel}
        </span>
      </div>
    </div>
  );
}
