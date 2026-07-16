"use client";

import { CheckCircle, Circle, Loader2, Lock, Radio, ShieldCheck, Trophy } from "lucide-react";

interface MarketLifecycleTimelineProps {
  gamePhase: string;
  hasBet?: boolean;
  isSettled?: boolean;
  isClaimed?: boolean;
}

const STEPS = [
  { key: "created", label: "Market Created", detail: "PDA market and vault are ready", icon: Radio },
  { key: "locked", label: "Bets Locked", detail: "USDC escrow closes at kickoff", icon: Lock },
  { key: "proof", label: "TxLINE Proof", detail: "Final stat proof is fetched", icon: ShieldCheck },
  { key: "settled", label: "CPI Verified", detail: "validate_stat resolves outcome", icon: CheckCircle },
  { key: "claim", label: "Winnings Claimable", detail: "Vault releases proportional payouts", icon: Trophy },
] as const;

export default function MarketLifecycleTimeline({
  gamePhase,
  hasBet = false,
  isSettled = false,
  isClaimed = false,
}: MarketLifecycleTimelineProps) {
  const matchStarted = gamePhase !== "NS";
  const finished = gamePhase === "FT";

  const states = {
    created: true,
    locked: matchStarted || hasBet,
    proof: finished,
    settled: isSettled,
    claim: isClaimed || isSettled,
  };

  return (
    <div className="glass rounded-2xl border border-white/[0.06] p-4">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-sm font-black text-white">Market Lifecycle</h3>
          <p className="text-[11px] text-gray-600">A judge-readable path from kickoff to payout.</p>
        </div>
        <span className="text-[10px] font-bold uppercase tracking-wider text-green-400 bg-green-500/10 border border-green-500/20 rounded-full px-2 py-1">
          Devnet Trace
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
        {STEPS.map((step, index) => {
          const done = states[step.key as keyof typeof states];
          const active =
            (!done && step.key === "proof" && matchStarted) ||
            (!done && step.key === "settled" && finished);
          const Icon = step.icon;

          return (
            <div key={step.key} className="relative glass-sm rounded-xl p-3 min-h-[104px] border border-white/[0.04]">
              {index < STEPS.length - 1 && (
                <div className="hidden sm:block absolute top-6 left-[calc(100%-4px)] w-4 h-px bg-white/10" />
              )}
              <div className="flex items-center gap-2 mb-2">
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center border ${
                    done
                      ? "bg-green-500/15 border-green-500/30 text-green-400"
                      : active
                      ? "bg-amber-500/15 border-amber-500/30 text-amber-400"
                      : "bg-white/5 border-white/10 text-gray-600"
                  }`}
                >
                  {active ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : done ? <Icon className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5" />}
                </div>
                <span className="text-[10px] text-gray-600 font-mono">0{index + 1}</span>
              </div>
              <div className={`text-xs font-bold ${done ? "text-white" : active ? "text-amber-300" : "text-gray-500"}`}>
                {step.label}
              </div>
              <p className="text-[10px] text-gray-600 leading-snug mt-1">{step.detail}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
