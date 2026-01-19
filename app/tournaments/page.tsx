'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { TournamentCard } from '@/components/tournaments/TournamentCard';
import { supabase } from '@/lib/supabase';
import type { Tournament, Division, TournamentStatus } from '@/lib/database.types';

interface TournamentWithDivisions extends Tournament {
  divisions: Division[];
}

export default function TournamentsPage() {
  const [tournaments, setTournaments] = useState<TournamentWithDivisions[]>([]);
  const [playerCounts, setPlayerCounts] = useState<Record<string, Record<string, number>>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<TournamentStatus | 'all'>('all');

  useEffect(() => {
    loadTournaments();
  }, []);

  const loadTournaments = async () => {
    setLoading(true);
    try {
      // Fetch tournaments with divisions
      const { data: tournamentsData, error } = await supabase
        .from('tournaments')
        .select(`
          *,
          divisions (*)
        `)
        .order('start_date', { ascending: false });

      if (error) throw error;

      setTournaments(tournamentsData || []);

      // Fetch player counts for each division
      if (tournamentsData && tournamentsData.length > 0) {
        const counts: Record<string, Record<string, number>> = {};

        for (const tournament of tournamentsData) {
          counts[tournament.id] = {};

          if (tournament.divisions) {
            for (const division of tournament.divisions) {
              const { count } = await supabase
                .from('tournament_entries')
                .select('*', { count: 'exact', head: true })
                .eq('division_id', division.id);

              counts[tournament.id][division.id] = count || 0;
            }
          }
        }

        setPlayerCounts(counts);
      }
    } catch (error) {
      console.error('Error loading tournaments:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredTournaments = tournaments.filter((tournament) => {
    const matchesSearch = tournament.name.toLowerCase().includes(search.toLowerCase()) ||
      tournament.location?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || tournament.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

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
              <Button variant="ghost" className="font-semibold">Tournaments</Button>
            </Link>
            <Link href="/players">
              <Button variant="ghost">Players</Button>
            </Link>
          </nav>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Tournaments</h1>
            <p className="text-gray-600 mt-1">Manage and view all tournaments</p>
          </div>
          <Link href="/tournaments/new">
            <Button size="lg">Create Tournament</Button>
          </Link>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1">
            <Input
              placeholder="Search tournaments..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-md"
            />
          </div>
          <Select
            value={statusFilter}
            onValueChange={(value) => setStatusFilter(value as TournamentStatus | 'all')}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Tournament Grid */}
        {loading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="h-[200px] w-full rounded-lg" />
              </div>
            ))}
          </div>
        ) : filteredTournaments.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-500 text-lg mb-4">
              {search || statusFilter !== 'all'
                ? 'No tournaments match your filters'
                : 'No tournaments yet'}
            </p>
            {!search && statusFilter === 'all' && (
              <Link href="/tournaments/new">
                <Button>Create Your First Tournament</Button>
              </Link>
            )}
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTournaments.map((tournament) => (
              <TournamentCard
                key={tournament.id}
                tournament={tournament}
                playerCounts={playerCounts[tournament.id] || {}}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
