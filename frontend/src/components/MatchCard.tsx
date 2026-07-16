"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export interface Fixture {
  fixtureId: number;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  gamePhase: "LIVE" | "HT" | "FT" | "NS";
  kickoff: string;
}

const TEAM_CODES: Record<string, string> = {
  Argentina: "ar", Brazil: "br", France: "fr", Germany: "de",
  England: "gb-eng", Spain: "es", Italy: "it", Portugal: "pt",
  Netherlands: "nl", Belgium: "be", Croatia: "hr", Uruguay: "uy",
  USA: "us", Mexico: "mx", Canada: "ca", Morocco: "ma",
  Japan: "jp", "South Korea": "kr", Senegal: "sn", Switzerland: "ch",
  Australia: "au", Ghana: "gh", Ecuador: "ec", Cameroon: "cm",
  "Saudi Arabia": "sa", Iran: "ir", Qatar: "qa", Wales: "gb-wls",
  Denmark: "dk", Serbia: "rs", Poland: "pl", Tunisia: "tn",
  Costa: "cr",
};

export function TeamLogo({ team, className = "w-8 h-8" }: { team: string, className?: string }) {
  const code = TEAM_CODES[team];
  if (!code) return <span className="text-3xl">⚽</span>;
  return (
    <img 
      src={`https://flagcdn.com/w80/${code}.png`} 
      alt={team} 
      className={`object-contain rounded-sm shadow-sm ${className}`} 
    />
  );
}

function PhaseBadge({ phase }: { phase: string }) {
  if (phase === "LIVE") {
    return (
      <div className="flex items-center gap-1.5 bg-red-500/10 border border-red-500/25 text-red-400 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider">
        <span className="w-1.5 h-1.5 bg-red-400 rounded-full animate-ping" />
        LIVE
      </div>
    );
  }
  if (phase === "HT") {
    return (
      <div className="bg-amber-500/10 border border-amber-500/25 text-amber-400 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider">
        HALF TIME
      </div>
    );
  }
  if (phase === "FT") {
    return (
      <div className="bg-gray-500/10 border border-gray-500/20 text-gray-500 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider">
        FULL TIME
      </div>
    );
  }
  return (
    <div className="bg-blue-500/10 border border-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider">
      UPCOMING
    </div>
  );
}

interface MatchCardProps {
  fixture: Fixture;
  index?: number;
}

export default function MatchCard({ fixture, index = 0 }: MatchCardProps) {
  const [scoreFlash, setScoreFlash] = useState(false);
  const prevScore = useRef({ home: fixture.homeScore, away: fixture.awayScore });

  // Flash animation when score changes via SSE
  useEffect(() => {
    const changed =
      prevScore.current.home !== fixture.homeScore ||
      prevScore.current.away !== fixture.awayScore;
    if (changed) {
      setScoreFlash(true);
      const t = setTimeout(() => setScoreFlash(false), 900);
      prevScore.current = { home: fixture.homeScore, away: fixture.awayScore };
      return () => clearTimeout(t);
    }
  }, [fixture.homeScore, fixture.awayScore]);

  const kickoffStr = () => {
    try {
      const d = new Date(fixture.kickoff);
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch {
      return fixture.kickoff;
    }
  };

  const delayClass = `stagger-${Math.min((index % 5) + 1, 5)}`;

  return (
    <Link href={`/match/${fixture.fixtureId}`}>
      <div
        className={`glass glass-hover rounded-2xl p-5 h-[190px] flex flex-col justify-between cursor-pointer relative overflow-hidden group animate-fade-in-up ${delayClass} border border-white/[0.05]`}
      >
        {/* Background glow on hover */}
        <div className="absolute inset-0 bg-gradient-to-br from-green-500/0 to-purple-500/0 group-hover:from-green-500/5 group-hover:to-purple-500/5 transition-all duration-500 pointer-events-none" />

        {/* LIVE glow pulse */}
        {fixture.gamePhase === "LIVE" && (
          <div className="absolute inset-0 border border-red-500/20 rounded-2xl pointer-events-none animate-pulse" />
        )}

        {/* Header */}
        <div className="flex justify-between items-center relative z-10">
          <span className="text-[10px] text-gray-600 uppercase tracking-widest font-bold">
            #{fixture.fixtureId}
          </span>
          <PhaseBadge phase={fixture.gamePhase} />
        </div>

        {/* Teams + Score */}
        <div className="grid grid-cols-7 items-center my-1 relative z-10">
          {/* Home */}
          <div className="col-span-3 flex flex-col items-center gap-1 text-center">
            <TeamLogo team={fixture.homeTeam} className="w-10 h-7" />
            <span className="text-xs font-bold text-gray-200 leading-tight line-clamp-1 max-w-[80px]">
              {fixture.homeTeam}
            </span>
          </div>

          {/* Score */}
          <div className="col-span-1 flex items-center justify-center">
            {fixture.gamePhase === "NS" ? (
              <span className="text-gray-600 font-black text-xs">VS</span>
            ) : (
              <span
                className={`font-extrabold text-xl tracking-tight tabular-nums ${
                  scoreFlash ? "score-flash text-green-400" : "text-white"
                } transition-colors duration-200`}
              >
                {fixture.homeScore}–{fixture.awayScore}
              </span>
            )}
          </div>

          {/* Away */}
          <div className="col-span-3 flex flex-col items-center gap-1 text-center">
            <TeamLogo team={fixture.awayTeam} className="w-10 h-7" />
            <span className="text-xs font-bold text-gray-200 leading-tight line-clamp-1 max-w-[80px]">
              {fixture.awayTeam}
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between relative z-10 border-t border-white/[0.04] pt-3">
          <span className="text-[10px] text-gray-600">
            {fixture.gamePhase === "NS" ? `⏰ ${kickoffStr()}` : "Match in progress"}
          </span>
          <span className="text-[10px] text-green-400 font-bold opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center gap-1">
            Bet Now →
          </span>
        </div>
      </div>
    </Link>
  );
}
