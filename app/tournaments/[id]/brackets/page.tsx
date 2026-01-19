'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { DoubleEliminationBracket } from '@/components/brackets/DoubleEliminationBracket';
import { ManualScoreEntry } from '@/components/director/ManualScoreEntry';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
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

export default function BracketsPage() {
  const params = useParams();
  const tournamentId = params.id as string;

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [divisions, setDivisions] = useState<DivisionWithBrackets[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('');
  const [selectedMatch, setSelectedMatch] = useState<MatchWithPlayers | null>(null);
  const [selectedMatchLength, setSelectedMatchLength] = useState<number>(9);

  useEffect(() => {
    if (tournamentId) {
      loadData();
    }
  }, [tournamentId]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load tournament
      const { data: tournamentData, error: tournamentError } = await supabase
        .from('tournaments')
        .select('*')
        .eq('id', tournamentId)
        .single();

      if (tournamentError) throw tournamentError;
      setTournament(tournamentData);

      // Load divisions
      const { data: divisionsData, error: divisionsError } = await supabase
        .from('divisions')
        .select('*')
        .eq('tournament_id', tournamentId)
        .order('match_length', { ascending: false });

      if (divisionsError) throw divisionsError;

      // Load brackets with matches for each division
      const divisionsWithBrackets: DivisionWithBrackets[] = [];

      for (const division of divisionsData) {
        // Get brackets for this division
        const { data: brackets, error: bracketsError } = await supabase
          .from('brackets')
          .select('*')
          .eq('division_id', division.id);

        if (bracketsError) throw bracketsError;

        const divisionData: DivisionWithBrackets = { ...division };

        // Get matches for each bracket
        for (const bracket of brackets || []) {
          const { data: matches, error: matchesError } = await supabase
            .from('matches')
            .select(`
              *,
              player1:players!matches_player1_id_fkey (*),
              player2:players!matches_player2_id_fkey (*)
            `)
            .eq('bracket_id', bracket.id)
            .order('round_number')
            .order('match_number');

          if (matchesError) throw matchesError;

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

      // Set active tab to first division
      if (divisionsWithBrackets.length > 0 && !activeTab) {
        setActiveTab(divisionsWithBrackets[0].id);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load brackets');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="border-b bg-white sticky top-0 z-50">
          <div className="container mx-auto px-4 py-4">
            <Skeleton className="h-8 w-64" />
          </div>
        </header>
        <main className="container mx-auto px-4 py-8">
          <Skeleton className="h-12 w-96 mb-4" />
          <Skeleton className="h-96 w-full" />
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

  const hasBrackets = divisions.some((d) => d.mainBracket || d.consolationBracket);

  const handleMatchClick = (match: MatchWithPlayers, matchLength: number) => {
    // Only allow editing pending or in_progress matches
    if (match.status === 'completed' || match.status === 'bye') {
      return;
    }
    // Only allow if both players are assigned
    if (!match.player1_id || !match.player2_id) {
      toast.info('Cannot enter score - waiting for players');
      return;
    }
    setSelectedMatch(match);
    setSelectedMatchLength(matchLength);
  };

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
        {/* Page Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
              <Link href={`/tournaments/${tournamentId}`} className="hover:text-gray-700">
                {tournament.name}
              </Link>
              <span>/</span>
              <span>Brackets</span>
            </div>
            <h1 className="text-3xl font-bold text-gray-900">Tournament Brackets</h1>
          </div>
          <div className="flex gap-2">
            <Link href={`/tournaments/${tournamentId}/public`}>
              <Button variant="outline">Public View</Button>
            </Link>
            <Link href={`/tournaments/${tournamentId}/director`}>
              <Button>Director Dashboard</Button>
            </Link>
          </div>
        </div>

        {/* Brackets */}
        {!hasBrackets ? (
          <div className="text-center py-16 bg-white rounded-lg border">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              No Brackets Generated Yet
            </h2>
            <p className="text-gray-600 mb-4">
              Generate brackets from the tournament details page once all players are checked in.
            </p>
            <Link href={`/tournaments/${tournamentId}`}>
              <Button>Go to Tournament Details</Button>
            </Link>
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-6">
              {divisions.map((division) => (
                <TabsTrigger key={division.id} value={division.id}>
                  {division.name}
                </TabsTrigger>
              ))}
            </TabsList>

            {divisions.map((division) => (
              <TabsContent key={division.id} value={division.id}>
                <DoubleEliminationBracket
                  division={division}
                  mainBracket={division.mainBracket}
                  consolationBracket={division.consolationBracket}
                  onMatchClick={(match) => handleMatchClick(match, division.match_length)}
                />
              </TabsContent>
            ))}
          </Tabs>
        )}

        {/* Score Entry Modal */}
        <ManualScoreEntry
          match={selectedMatch}
          matchLength={selectedMatchLength}
          open={!!selectedMatch}
          onClose={() => setSelectedMatch(null)}
          onSuccess={loadData}
        />
      </main>
    </div>
  );
}
