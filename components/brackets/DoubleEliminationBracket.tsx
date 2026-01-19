'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BracketDisplay } from './BracketDisplay';
import type { Match, Player, Bracket, Division } from '@/lib/database.types';

interface MatchWithPlayers extends Match {
  player1?: Player;
  player2?: Player;
}

interface BracketWithMatches extends Bracket {
  matches: MatchWithPlayers[];
}

interface DoubleEliminationBracketProps {
  division: Division;
  mainBracket?: BracketWithMatches;
  consolationBracket?: BracketWithMatches;
  onMatchClick?: (match: MatchWithPlayers) => void;
  compact?: boolean;
}

export function DoubleEliminationBracket({
  division,
  mainBracket,
  consolationBracket,
  onMatchClick,
  compact = false,
}: DoubleEliminationBracketProps) {
  const mainMatches = mainBracket?.matches || [];
  const consolationMatches = consolationBracket?.matches || [];

  const totalMatches = mainMatches.length + consolationMatches.length;
  const completedMatches = [...mainMatches, ...consolationMatches].filter(
    (m) => m.status === 'completed' || m.status === 'bye'
  ).length;
  const inProgressMatches = [...mainMatches, ...consolationMatches].filter(
    (m) => m.status === 'in_progress'
  ).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{division.name}</CardTitle>
            <p className="text-sm text-gray-500 mt-1">
              {division.match_length}-point matches
              {division.clock_required && ' • Clock required'}
            </p>
          </div>
          <div className="flex gap-2">
            <Badge variant="outline">
              {completedMatches}/{totalMatches} completed
            </Badge>
            {inProgressMatches > 0 && (
              <Badge className="bg-yellow-100 text-yellow-800">
                {inProgressMatches} in progress
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-8">
        {/* Main Bracket */}
        {mainBracket && (
          <div>
            <BracketDisplay
              bracket={mainBracket}
              matches={mainMatches}
              matchLength={division.match_length}
              onMatchClick={onMatchClick}
              compact={compact}
            />
          </div>
        )}

        {/* Consolation Bracket */}
        {consolationBracket && consolationMatches.length > 0 && (
          <div className="border-t pt-6">
            <BracketDisplay
              bracket={consolationBracket}
              matches={consolationMatches}
              matchLength={division.match_length}
              onMatchClick={onMatchClick}
              compact={compact}
            />
          </div>
        )}

        {/* Empty State */}
        {!mainBracket && !consolationBracket && (
          <div className="text-center py-8 text-gray-500">
            Brackets have not been generated yet
          </div>
        )}
      </CardContent>
    </Card>
  );
}
