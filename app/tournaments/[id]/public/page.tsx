'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { DoubleEliminationBracket } from '@/components/brackets/DoubleEliminationBracket';
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

export default function PublicBracketPage() {
  const params = useParams();
  const tournamentId = params.id as string;

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [divisions, setDivisions] = useState<DivisionWithBrackets[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('');

  const loadData = useCallback(async () => {
    try {
      const { data: tournamentData, error: tournamentError } = await supabase
        .from('tournaments')
        .select('*')
        .eq('id', tournamentId)
        .single();

      if (tournamentError) throw tournamentError;
      setTournament(tournamentData);

      const { data: divisionsData, error: divisionsError } = await supabase
        .from('divisions')
        .select('*')
        .eq('tournament_id', tournamentId)
        .order('match_length', { ascending: false });

      if (divisionsError) throw divisionsError;

      const divisionsWithBrackets: DivisionWithBrackets[] = [];

      for (const division of divisionsData) {
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

      if (divisionsWithBrackets.length > 0 && !activeTab) {
        setActiveTab(divisionsWithBrackets[0].id);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }, [tournamentId, activeTab]);

  useEffect(() => {
    if (tournamentId) {
      loadData();
    }
  }, [tournamentId, loadData]);

  // Auto-refresh every 15 seconds
  useEffect(() => {
    const interval = setInterval(loadData, 15000);
    return () => clearInterval(interval);
  }, [loadData]);

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('public-matches')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'matches',
        },
        () => {
          loadData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadData]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <div className="container mx-auto px-4 py-8">
          <Skeleton className="h-12 w-96 mb-4" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Tournament Not Found</h1>
          <Link href="/tournaments" className="text-blue-600 hover:underline">
            View all tournaments
          </Link>
        </div>
      </div>
    );
  }

  const hasBrackets = divisions.some((d) => d.mainBracket || d.consolationBracket);

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b bg-gradient-to-r from-blue-600 to-blue-700 text-white">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">{tournament.name}</h1>
              <div className="flex flex-wrap items-center gap-2 mt-2 text-blue-100">
                {tournament.location && <span>{tournament.location}</span>}
                {tournament.location && <span>•</span>}
                <span>{formatDate(tournament.start_date)}</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge className={getTournamentStatusColor(tournament.status)}>
                {tournament.status.replace('_', ' ')}
              </Badge>
              <Link
                href={`/tournaments/${tournamentId}/display`}
                className="text-sm text-blue-100 hover:text-white"
              >
                TV Display Mode →
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {!hasBrackets ? (
          <div className="text-center py-16">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Tournament Brackets Coming Soon
            </h2>
            <p className="text-gray-600">
              Brackets will appear here once the tournament begins.
            </p>
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <div className="flex justify-center mb-6">
              <TabsList>
                {divisions.map((division) => (
                  <TabsTrigger key={division.id} value={division.id}>
                    {division.name}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            {divisions.map((division) => (
              <TabsContent key={division.id} value={division.id}>
                <DoubleEliminationBracket
                  division={division}
                  mainBracket={division.mainBracket}
                  consolationBracket={division.consolationBracket}
                />
              </TabsContent>
            ))}
          </Tabs>
        )}

        {/* Footer with SMS number (placeholder for Phase 2) */}
        {tournament.sms_phone_number && (
          <div className="mt-12 text-center p-6 bg-blue-50 rounded-lg">
            <p className="text-gray-600 mb-2">Report your scores via text:</p>
            <p className="text-2xl font-bold text-blue-600">{tournament.sms_phone_number}</p>
            <p className="text-sm text-gray-500 mt-2">
              Format: &quot;Winner Score Loser Score&quot; (e.g., &quot;John 9 Sarah 4&quot;)
            </p>
          </div>
        )}
      </main>

      {/* Auto-refresh indicator */}
      <div className="fixed bottom-4 right-4 text-xs text-gray-400">
        Auto-refreshes every 15 seconds
      </div>
    </div>
  );
}
