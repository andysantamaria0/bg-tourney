'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { PlayerList } from '@/components/players/PlayerList';
import { PlayerRegistrationForm } from '@/components/players/PlayerRegistrationForm';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import type { Tournament, Division, TournamentEntry, Player } from '@/lib/database.types';

interface TournamentEntryWithPlayer extends TournamentEntry {
  player: Player;
  division: Division;
}

interface DivisionWithCounts extends Division {
  total: number;
  checkedIn: number;
}

export default function TournamentPlayersPage() {
  const params = useParams();
  const tournamentId = params.id as string;

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [divisions, setDivisions] = useState<DivisionWithCounts[]>([]);
  const [entries, setEntries] = useState<TournamentEntryWithPlayer[]>([]);
  const [loading, setLoading] = useState(true);

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

      // Load entries with players and divisions
      const { data: entriesData, error: entriesError } = await supabase
        .from('tournament_entries')
        .select(`
          *,
          player:players (*),
          division:divisions (*)
        `)
        .eq('tournament_id', tournamentId);

      if (entriesError) throw entriesError;

      setEntries(entriesData as TournamentEntryWithPlayer[]);

      // Calculate counts per division
      const divisionCounts = divisionsData.map((div) => {
        const divEntries = entriesData.filter((e) => e.division_id === div.id);
        return {
          ...div,
          total: divEntries.length,
          checkedIn: divEntries.filter((e) => e.checked_in).length,
        };
      });

      setDivisions(divisionCounts);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load tournament data');
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
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Skeleton className="h-96 w-full" />
            </div>
            <Skeleton className="h-64 w-full" />
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

  const totalPlayers = entries.length;
  const totalCheckedIn = entries.filter((e) => e.checked_in).length;

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
              <span>Players</span>
            </div>
            <h1 className="text-3xl font-bold text-gray-900">Player Management</h1>
          </div>
          <Link href={`/tournaments/${tournamentId}`}>
            <Button variant="outline">Back to Tournament</Button>
          </Link>
        </div>

        {/* Division Summary */}
        <div className="grid sm:grid-cols-3 gap-4 mb-8">
          {divisions.map((div) => (
            <Card key={div.id}>
              <CardHeader className="pb-2">
                <CardDescription>{div.name}</CardDescription>
                <CardTitle className="text-2xl">
                  {div.total} players
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Badge variant={div.checkedIn >= 2 ? 'default' : 'secondary'}>
                    {div.checkedIn} checked in
                  </Badge>
                  <span className="text-sm text-gray-500">
                    ({div.match_length}pt matches)
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Total Summary */}
        <Card className="mb-8">
          <CardContent className="pt-6">
            <div className="flex flex-wrap items-center gap-6">
              <div>
                <p className="text-sm text-gray-500">Total Players</p>
                <p className="text-2xl font-bold">{totalPlayers}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Checked In</p>
                <p className="text-2xl font-bold">{totalCheckedIn}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Entry Fees Paid</p>
                <p className="text-2xl font-bold">
                  {entries.filter((e) => e.entry_fee_paid).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main Content */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Player List */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Registered Players</CardTitle>
                <CardDescription>
                  Manage player registrations and check-ins
                </CardDescription>
              </CardHeader>
              <CardContent>
                <PlayerList
                  entries={entries}
                  divisions={divisions}
                  tournamentId={tournamentId}
                  onUpdate={loadData}
                />
              </CardContent>
            </Card>
          </div>

          {/* Add Player Form */}
          <div>
            <PlayerRegistrationForm
              tournamentId={tournamentId}
              divisions={divisions}
              onSuccess={loadData}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
