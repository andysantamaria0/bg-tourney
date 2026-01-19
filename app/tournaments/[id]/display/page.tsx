'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MatchCard } from '@/components/brackets/MatchCard';
import { supabase } from '@/lib/supabase';
import { formatDate, getTournamentStatusColor } from '@/lib/utils';
import type { Tournament, Division, Bracket, Match, Player } from '@/lib/database.types';

interface MatchWithPlayers extends Match {
  player1?: Player;
  player2?: Player;
}

interface BracketWithMatches extends Bracket {
  matches: MatchWithPlayers[];
}

interface DivisionWithBrackets extends Division {
  mainBracket?: BracketWithMatches;
  consolationBracket?: BracketWithMatches;
}

export default function TVDisplayPage() {
  const params = useParams();
  const tournamentId = params.id as string;

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [divisions, setDivisions] = useState<DivisionWithBrackets[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const { data: tournamentData } = await supabase
        .from('tournaments')
        .select('*')
        .eq('id', tournamentId)
        .single();

      setTournament(tournamentData);

      const { data: divisionsData } = await supabase
        .from('divisions')
        .select('*')
        .eq('tournament_id', tournamentId)
        .order('match_length', { ascending: false });

      const divisionsWithBrackets: DivisionWithBrackets[] = [];

      for (const division of divisionsData || []) {
        const { data: brackets } = await supabase
          .from('brackets')
          .select('*')
          .eq('division_id', division.id);

        const divisionData: DivisionWithBrackets = { ...division };

        for (const bracket of brackets || []) {
          const { data: matches } = await supabase
            .from('matches')
            .select(`
              *,
              player1:players!matches_player1_id_fkey (*),
              player2:players!matches_player2_id_fkey (*)
            `)
            .eq('bracket_id', bracket.id)
            .order('round_number')
            .order('match_number');

          const bracketWithMatches: BracketWithMatches = {
            ...bracket,
            matches: (matches || []) as MatchWithPlayers[],
          };

          if (bracket.bracket_type === 'main') {
            divisionData.mainBracket = bracketWithMatches;
          } else if (bracket.bracket_type === 'consolation') {
            divisionData.consolationBracket = bracketWithMatches;
          }
        }

        divisionsWithBrackets.push(divisionData);
      }

      setDivisions(divisionsWithBrackets);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }, [tournamentId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Auto-refresh every 10 seconds
  useEffect(() => {
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, [loadData]);

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('display-matches')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'matches' },
        () => loadData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadData]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'f' || e.key === 'F') {
        toggleFullscreen();
      }
      if (e.key === 'r' || e.key === 'R') {
        loadData();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [loadData]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const getCurrentRoundMatches = (division: DivisionWithBrackets) => {
    const currentRound = division.mainBracket?.current_round || 1;
    const mainMatches = division.mainBracket?.matches.filter(
      (m) => m.round_number === currentRound
    ) || [];
    const consolationMatches = division.consolationBracket?.matches.filter(
      (m) => m.round_number === currentRound
    ) || [];
    return [...mainMatches, ...consolationMatches];
  };

  if (loading || !tournament) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-2xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      {/* Header */}
      <header className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold">{tournament.name}</h1>
          <div className="flex items-center gap-4 mt-2 text-gray-400">
            {tournament.location && <span>{tournament.location}</span>}
            <span>{formatDate(tournament.start_date)}</span>
            <Badge className={getTournamentStatusColor(tournament.status)}>
              {tournament.status.replace('_', ' ')}
            </Badge>
          </div>
        </div>

        {/* SMS Number */}
        {tournament.sms_phone_number && (
          <div className="text-right">
            <p className="text-gray-400 text-sm">Text scores to:</p>
            <p className="text-3xl font-bold text-blue-400">{tournament.sms_phone_number}</p>
          </div>
        )}
      </header>

      {/* Divisions Grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {divisions.map((division) => {
          const currentMatches = getCurrentRoundMatches(division);
          const inProgressCount = currentMatches.filter((m) => m.status === 'in_progress').length;
          const pendingCount = currentMatches.filter((m) => m.status === 'pending').length;
          const completedCount = currentMatches.filter(
            (m) => m.status === 'completed' || m.status === 'bye'
          ).length;

          return (
            <Card key={division.id} className="bg-gray-800 border-gray-700">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-2xl text-white">{division.name}</CardTitle>
                  <Badge variant="outline" className="text-gray-300 border-gray-600">
                    Round {division.mainBracket?.current_round || 1}
                  </Badge>
                </div>
                <p className="text-gray-400">{division.match_length}-point matches</p>
                <div className="flex gap-2 mt-2">
                  {inProgressCount > 0 && (
                    <Badge className="bg-yellow-600">{inProgressCount} playing</Badge>
                  )}
                  {pendingCount > 0 && (
                    <Badge variant="outline" className="border-gray-600">
                      {pendingCount} waiting
                    </Badge>
                  )}
                  {completedCount > 0 && (
                    <Badge className="bg-green-600">{completedCount} done</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {currentMatches.length === 0 ? (
                    <p className="text-gray-500 text-center py-4">No active matches</p>
                  ) : (
                    currentMatches.slice(0, 6).map((match) => (
                      <div key={match.id} className="bg-gray-700 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          {match.table_number && (
                            <span className="text-xs text-gray-400">Table {match.table_number}</span>
                          )}
                          <Badge
                            className={
                              match.status === 'in_progress'
                                ? 'bg-yellow-600'
                                : match.status === 'completed'
                                ? 'bg-green-600'
                                : match.status === 'bye'
                                ? 'bg-blue-600'
                                : 'bg-gray-600'
                            }
                          >
                            {match.status.replace('_', ' ')}
                          </Badge>
                        </div>
                        <div className="space-y-1 text-lg">
                          <div
                            className={`flex justify-between ${
                              match.winner_id === match.player1_id ? 'font-bold text-green-400' : ''
                            }`}
                          >
                            <span>{match.player1?.name || 'TBD'}</span>
                            {match.status === 'completed' && (
                              <span className="font-mono">{match.player1_score}</span>
                            )}
                          </div>
                          <div
                            className={`flex justify-between ${
                              match.winner_id === match.player2_id ? 'font-bold text-green-400' : ''
                            }`}
                          >
                            <span>
                              {match.player2?.name || (match.status === 'bye' ? 'BYE' : 'TBD')}
                            </span>
                            {match.status === 'completed' && match.player2_id && (
                              <span className="font-mono">{match.player2_score}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                  {currentMatches.length > 6 && (
                    <p className="text-gray-500 text-center text-sm">
                      +{currentMatches.length - 6} more matches
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* QR Code Placeholder & Controls */}
      <footer className="fixed bottom-4 left-4 right-4 flex items-center justify-between">
        <div className="text-gray-500 text-sm">
          Press <kbd className="bg-gray-700 px-2 py-1 rounded">F</kbd> for fullscreen
          {' • '}
          <kbd className="bg-gray-700 px-2 py-1 rounded">R</kbd> to refresh
        </div>

        <div className="flex items-center gap-4">
          <div className="text-gray-500 text-sm">Auto-refreshes every 10s</div>

          {/* QR Code placeholder */}
          <div className="bg-white p-2 rounded">
            <div className="w-20 h-20 bg-gray-200 flex items-center justify-center text-gray-500 text-xs text-center">
              QR Code
              <br />
              (Phase 2)
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
