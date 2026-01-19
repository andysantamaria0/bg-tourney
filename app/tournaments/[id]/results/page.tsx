'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
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

interface DivisionResults extends Division {
  mainBracket?: BracketWithMatches;
  consolationBracket?: BracketWithMatches;
  winner?: Player;
  runnerUp?: Player;
  consolationWinner?: Player;
}

export default function ResultsPage() {
  const params = useParams();
  const tournamentId = params.id as string;

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [divisions, setDivisions] = useState<DivisionResults[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (tournamentId) {
      loadData();
    }
  }, [tournamentId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: tournamentData, error: tournamentError } = await supabase
        .from('tournaments')
        .select('*')
        .eq('id', tournamentId)
        .single();

      if (tournamentError) throw tournamentError;
      setTournament(tournamentData);

      const { data: divisionsData } = await supabase
        .from('divisions')
        .select('*')
        .eq('tournament_id', tournamentId)
        .order('match_length', { ascending: false });

      const divisionsWithResults: DivisionResults[] = [];

      for (const division of divisionsData || []) {
        const { data: brackets } = await supabase
          .from('brackets')
          .select('*')
          .eq('division_id', division.id);

        const divisionData: DivisionResults = { ...division };

        for (const bracket of brackets || []) {
          const { data: matches } = await supabase
            .from('matches')
            .select(`
              *,
              player1:players!matches_player1_id_fkey (*),
              player2:players!matches_player2_id_fkey (*)
            `)
            .eq('bracket_id', bracket.id)
            .order('round_number', { ascending: false })
            .order('match_number');

          const bracketWithMatches: BracketWithMatches = {
            ...bracket,
            matches: (matches || []) as MatchWithPlayers[],
          };

          if (bracket.bracket_type === 'main') {
            divisionData.mainBracket = bracketWithMatches;

            // Get winner and runner-up from final match
            const finalMatch = matches?.find(
              (m) => m.round_number === Math.max(...matches.map((mm) => mm.round_number))
            );

            if (finalMatch?.winner_id) {
              divisionData.winner =
                finalMatch.winner_id === finalMatch.player1_id
                  ? finalMatch.player1
                  : finalMatch.player2;
              divisionData.runnerUp =
                finalMatch.winner_id === finalMatch.player1_id
                  ? finalMatch.player2
                  : finalMatch.player1;
            }
          } else if (bracket.bracket_type === 'consolation') {
            divisionData.consolationBracket = bracketWithMatches;

            // Get consolation winner
            const finalMatch = matches?.find(
              (m) => m.round_number === Math.max(...(matches?.map((mm) => mm.round_number) || [0]))
            );

            if (finalMatch?.winner_id) {
              divisionData.consolationWinner =
                finalMatch.winner_id === finalMatch.player1_id
                  ? finalMatch.player1
                  : finalMatch.player2;
            }
          }
        }

        divisionsWithResults.push(divisionData);
      }

      setDivisions(divisionsWithResults);
    } catch (error) {
      console.error('Error loading results:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="border-b bg-white">
          <div className="container mx-auto px-4 py-4">
            <Skeleton className="h-8 w-64" />
          </div>
        </header>
        <main className="container mx-auto px-4 py-8">
          <Skeleton className="h-12 w-96 mb-4" />
          <div className="grid md:grid-cols-3 gap-6">
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
          </div>
        </main>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Tournament Not Found</h1>
          <Link href="/tournaments">
            <Button>Back to Tournaments</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b bg-white sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-gray-900">
            Destiny 2&apos;s Backgammon Smackdown
          </Link>
          <nav className="flex gap-4">
            <Link href="/tournaments">
              <Button variant="ghost">Tournaments</Button>
            </Link>
            <Link href="/players">
              <Button variant="ghost">Players</Button>
            </Link>
          </nav>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Tournament Info */}
        <div className="text-center mb-12">
          <Badge className={getTournamentStatusColor(tournament.status)}>
            {tournament.status.replace('_', ' ')}
          </Badge>
          <h1 className="text-4xl font-bold text-gray-900 mt-4">{tournament.name}</h1>
          <p className="text-gray-600 mt-2">
            {tournament.location && `${tournament.location} • `}
            {formatDate(tournament.start_date)}
          </p>
          <h2 className="text-2xl font-semibold text-gray-700 mt-6">Final Results</h2>
        </div>

        {/* Results by Division */}
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {divisions.map((division) => (
            <Card key={division.id} className="relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-600" />
              <CardHeader>
                <CardTitle>{division.name}</CardTitle>
                <CardDescription>{division.match_length}-point matches</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Winner - 1st Place */}
                {division.winner ? (
                  <div className="text-center p-4 bg-gradient-to-b from-yellow-50 to-yellow-100 rounded-lg border border-yellow-200">
                    <div className="text-4xl mb-2">🏆</div>
                    <p className="text-sm text-yellow-700 font-medium">Champion</p>
                    <p className="text-xl font-bold text-gray-900">{division.winner.name}</p>
                  </div>
                ) : (
                  <div className="text-center p-4 bg-gray-50 rounded-lg border">
                    <p className="text-gray-500">Winner TBD</p>
                  </div>
                )}

                {/* Runner-up - 2nd Place */}
                {division.runnerUp && (
                  <div className="text-center p-3 bg-gray-100 rounded-lg">
                    <div className="text-2xl mb-1">🥈</div>
                    <p className="text-xs text-gray-600">Runner-up</p>
                    <p className="font-semibold text-gray-900">{division.runnerUp.name}</p>
                  </div>
                )}

                {/* Consolation Winner - 3rd Place */}
                {division.consolationWinner && (
                  <div className="text-center p-3 bg-orange-50 rounded-lg border border-orange-200">
                    <div className="text-2xl mb-1">🥉</div>
                    <p className="text-xs text-orange-700">Consolation Winner</p>
                    <p className="font-semibold text-gray-900">
                      {division.consolationWinner.name}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Actions */}
        <div className="flex justify-center gap-4 mt-12">
          <Link href={`/tournaments/${tournamentId}/brackets`}>
            <Button variant="outline">View Final Brackets</Button>
          </Link>
          <Link href={`/tournaments/${tournamentId}`}>
            <Button variant="outline">Tournament Details</Button>
          </Link>
        </div>
      </main>
    </div>
  );
}
