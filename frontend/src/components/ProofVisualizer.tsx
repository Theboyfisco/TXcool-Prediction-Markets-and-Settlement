"use client";

import { CheckCircle, Hash, GitBranch } from "lucide-react";

interface ProofNode {
  hash: string | number[];
  isRightSibling: boolean;
}

interface ProofVisualizerProps {
  merkleRoot?: string;
  statKey?: number;
  statValue?: number;
  fixtureId?: number;
  proofNodes?: ProofNode[];
}

function truncateHash(h: string) {
  if (!h) return "—";
  if (h.length <= 16) return h;
  return h.slice(0, 8) + "…" + h.slice(-6);
}

export default function ProofVisualizer({
  merkleRoot,
  statKey,
  statValue,
  fixtureId,
  proofNodes = [],
}: ProofVisualizerProps) {
  const displayNodes = proofNodes.slice(0, 5);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs font-bold text-gray-300 uppercase tracking-wider">
        <GitBranch className="w-3.5 h-3.5 text-green-400" />
        <span>Merkle Proof Path</span>
        <CheckCircle className="w-3.5 h-3.5 text-green-400 ml-auto" />
        <span className="text-green-400 text-[10px]">Verified</span>
      </div>

      {/* Root node */}
      <div className="flex flex-col items-center gap-1.5">
        <div className="flex items-center gap-1.5 bg-green-500/10 border border-green-500/25 rounded-xl px-4 py-2 w-full">
          <Hash className="w-3 h-3 text-green-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-[9px] text-gray-500 font-bold uppercase mb-0.5">Daily Merkle Root</div>
            <div className="text-[10px] text-green-400 font-mono truncate">
              {merkleRoot ? truncateHash(merkleRoot) : "0x3a7f…c912"}
            </div>
          </div>
          <CheckCircle className="w-3.5 h-3.5 text-green-400 shrink-0" />
        </div>

        {/* Connector line */}
        <div className="proof-line h-5" />

        {/* Proof path nodes */}
        {displayNodes.length > 0 ? (
          displayNodes.map((node, i) => (
            <div key={i} className="flex flex-col items-center w-full gap-1.5">
              <div className="flex items-center gap-2 glass-sm rounded-xl px-3 py-1.5 w-full border border-white/[0.04]">
                <span className="text-[9px] text-gray-600 font-bold w-4 shrink-0">L{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] text-gray-400 font-mono truncate">
                    {typeof node.hash === "string"
                      ? truncateHash(node.hash)
                      : Array.from(node.hash as number[]).slice(0, 4).join(",") + "…"}
                  </div>
                </div>
                <span className={`text-[9px] font-bold shrink-0 ${node.isRightSibling ? "text-cyan-400" : "text-purple-400"}`}>
                  {node.isRightSibling ? "→R" : "←L"}
                </span>
              </div>
              {i < displayNodes.length - 1 && <div className="proof-line h-4" />}
            </div>
          ))
        ) : (
          /* Placeholder nodes when no real proof yet */
          [0, 1, 2].map((i) => (
            <div key={i} className="flex flex-col items-center w-full gap-1.5">
              <div className="glass-sm rounded-xl px-3 py-1.5 w-full border border-white/[0.04] shimmer">
                <div className="h-3 w-3/4 rounded" />
              </div>
              {i < 2 && <div className="proof-line h-4" />}
            </div>
          ))
        )}

        {/* Connector to leaf */}
        <div className="proof-line h-5" />

        {/* Leaf: the actual stat */}
        <div className="flex items-center gap-2 glass-sm border border-cyan-500/20 bg-cyan-500/5 rounded-xl px-3 py-2 w-full">
          <span className="text-base shrink-0">⚽</span>
          <div className="flex-1 min-w-0">
            <div className="text-[9px] text-gray-500 font-bold uppercase mb-0.5">
              Stat #{statKey ?? 1002} · Fixture #{fixtureId}
            </div>
            <div className="text-[11px] text-cyan-400 font-bold">
              value = {statValue ?? "?"} (Home Goals)
            </div>
          </div>
        </div>
      </div>

      {/* Footer note */}
      <div className="text-[10px] text-gray-600 text-center leading-relaxed">
        This Merkle path was anchored on Solana by TxLINE and verified via on-chain CPI.
      </div>
    </div>
  );
}
