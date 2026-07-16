"use client";

import { useState } from "react";
import { Calculator, TrendingUp } from "lucide-react";

interface LiquidityPanelProps {
  yesAmount: number;
  noAmount: number;
  yesLabel?: string;
  noLabel?: string;
}

export default function LiquidityPanel({
  yesAmount,
  noAmount,
  yesLabel = "YES",
  noLabel = "NO",
}: LiquidityPanelProps) {
  const [stake, setStake] = useState<number>(50);

  const total = yesAmount + noAmount;
  const yesPct = total === 0 ? 50 : Math.round((yesAmount / total) * 100);
  const noPct = 100 - yesPct;
  
  const yesUsdc = yesAmount / 1_000_000;
  const noUsdc = noAmount / 1_000_000;
  
  const impliedYes = yesPct / 100;
  const impliedNo = noPct / 100;

  const yesOdds = impliedYes > 0 ? (1 / impliedYes) : 2.0;
  const noOdds = impliedNo > 0 ? (1 / impliedNo) : 2.0;

  // Calculate user share and estimated payout
  const userShareYes = stake > 0 ? ((stake / (yesUsdc + stake)) * 100).toFixed(1) : "0.0";
  const userShareNo = stake > 0 ? ((stake / (noUsdc + stake)) * 100).toFixed(1) : "0.0";

  const payoutYes = (stake * yesOdds).toFixed(2);
  const payoutNo = (stake * noOdds).toFixed(2);

  return (
    <div className="space-y-4 rounded-xl border border-white/[0.05] bg-white/[0.02] p-4">
      {/* Pool Header */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1">
          <TrendingUp className="w-3.5 h-3.5 text-purple-400" />
          Live Prediction Pool
        </span>
        <span className="text-[10px] font-mono text-gray-400 font-bold">
          {(total / 1_000_000).toLocaleString()} USDC Escrowed
        </span>
      </div>

      {/* Dynamic Ratio Bar */}
      <div className="relative h-3 overflow-hidden rounded-full bg-purple-950/40 border border-white/[0.04]">
        <div
          className="absolute left-0 top-0 h-full rounded-full bg-gradient-to-r from-[#00ff87] to-[#22d3ee] transition-all duration-700 shadow-[0_0_12px_rgba(0,255,135,0.3)]"
          style={{ width: `${yesPct}%` }}
        />
        <div className="absolute inset-0 flex items-center justify-between px-3 text-[9px] font-black text-black">
          <span>{yesPct}%</span>
          <span>{noPct}%</span>
        </div>
      </div>

      {/* Distribution metrics */}
      <div className="grid grid-cols-3 gap-2 text-center text-[10px] border-b border-white/[0.04] pb-3">
        <div className="text-left">
          <div className="font-bold text-green-400">{yesLabel}</div>
          <div className="font-mono text-gray-400">{yesUsdc.toLocaleString()} USDC</div>
        </div>
        <div>
          <div className="font-bold text-gray-500 uppercase tracking-widest text-[8px]">Probability</div>
          <div className="font-mono text-white font-bold">{yesPct}% vs {noPct}%</div>
        </div>
        <div className="text-right">
          <div className="font-bold text-purple-400">{noLabel}</div>
          <div className="font-mono text-gray-400">{noUsdc.toLocaleString()} USDC</div>
        </div>
      </div>

      {/* Interactive Payout Estimator */}
      <div className="space-y-2 bg-white/[0.015] border border-white/[0.04] rounded-lg p-2.5">
        <div className="flex items-center justify-between gap-2 text-[10px] text-gray-500 font-bold uppercase">
          <span className="flex items-center gap-1">
            <Calculator className="w-3.5 h-3.5 text-green-400" />
            Payout Estimator
          </span>
          <div className="flex items-center gap-1">
            <input
              type="number"
              value={stake}
              onChange={(e) => setStake(Math.max(0, Number(e.target.value)))}
              className="w-12 bg-black/60 border border-white/10 rounded px-1 text-center font-mono text-[10px] text-white focus:outline-none focus:border-green-400"
            />
            <span>USDC</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-[10px] pt-1">
          <div className="rounded border border-green-500/10 bg-green-500/[0.02] p-1.5 space-y-0.5">
            <div className="text-gray-500 font-bold">{yesLabel} Payout</div>
            <div className="font-mono font-black text-green-400 text-xs">{payoutYes} USDC</div>
            <div className="text-gray-600 text-[8px]">Share: {userShareYes}% ({yesOdds.toFixed(2)}x)</div>
          </div>
          <div className="rounded border border-purple-500/10 bg-purple-500/[0.02] p-1.5 space-y-0.5">
            <div className="text-gray-500 font-bold">{noLabel} Payout</div>
            <div className="font-mono font-black text-purple-400 text-xs">{payoutNo} USDC</div>
            <div className="text-gray-600 text-[8px]">Share: {userShareNo}% ({noOdds.toFixed(2)}x)</div>
          </div>
        </div>
      </div>
    </div>
  );
}
