'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import type { TournamentEntry, Division, Player } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { formatPhoneNumber } from '@/lib/utils';

interface TournamentEntryWithPlayer extends TournamentEntry {
  player: Player;
  division: Division;
}

interface PlayerListProps {
  entries: TournamentEntryWithPlayer[];
  divisions: Division[];
  tournamentId: string;
  onUpdate: () => void;
}

export function PlayerList({ entries, divisions, tournamentId, onUpdate }: PlayerListProps) {
  const [search, setSearch] = useState('');
  const [divisionFilter, setDivisionFilter] = useState<string>('all');
  const [editingEntry, setEditingEntry] = useState<TournamentEntryWithPlayer | null>(null);
  const [deleteEntry, setDeleteEntry] = useState<TournamentEntryWithPlayer | null>(null);
  const [loading, setLoading] = useState(false);

  const filteredEntries = entries.filter((entry) => {
    const matchesSearch =
      entry.player.name.toLowerCase().includes(search.toLowerCase()) ||
      entry.player.email?.toLowerCase().includes(search.toLowerCase()) ||
      entry.player.phone?.includes(search);
    const matchesDivision = divisionFilter === 'all' || entry.division_id === divisionFilter;
    return matchesSearch && matchesDivision;
  });

  const handleCheckIn = async (entry: TournamentEntryWithPlayer, checked: boolean) => {
    try {
      const { error } = await supabase
        .from('tournament_entries')
        .update({ checked_in: checked })
        .eq('id', entry.id);

      if (error) throw error;
      toast.success(checked ? 'Player checked in' : 'Check-in removed');
      onUpdate();
    } catch (error) {
      console.error('Error updating check-in:', error);
      toast.error('Failed to update check-in status');
    }
  };

  const handleEntryFeePaid = async (entry: TournamentEntryWithPlayer, paid: boolean) => {
    try {
      const { error } = await supabase
        .from('tournament_entries')
        .update({ entry_fee_paid: paid })
        .eq('id', entry.id);

      if (error) throw error;
      toast.success(paid ? 'Entry fee marked as paid' : 'Entry fee marked as unpaid');
      onUpdate();
    } catch (error) {
      console.error('Error updating entry fee:', error);
      toast.error('Failed to update entry fee status');
    }
  };

  const handleUpdateDivision = async () => {
    if (!editingEntry) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('tournament_entries')
        .update({ division_id: editingEntry.division_id })
        .eq('id', editingEntry.id);

      if (error) throw error;
      toast.success('Division updated');
      setEditingEntry(null);
      onUpdate();
    } catch (error) {
      console.error('Error updating division:', error);
      toast.error('Failed to update division');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteEntry) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('tournament_entries')
        .delete()
        .eq('id', deleteEntry.id);

      if (error) throw error;
      toast.success('Player removed from tournament');
      setDeleteEntry(null);
      onUpdate();
    } catch (error) {
      console.error('Error removing player:', error);
      toast.error('Failed to remove player');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckInAll = async () => {
    setLoading(true);
    try {
      const idsToUpdate = filteredEntries
        .filter((e) => !e.checked_in)
        .map((e) => e.id);

      if (idsToUpdate.length === 0) {
        toast.info('All visible players are already checked in');
        return;
      }

      const { error } = await supabase
        .from('tournament_entries')
        .update({ checked_in: true })
        .in('id', idsToUpdate);

      if (error) throw error;
      toast.success(`${idsToUpdate.length} players checked in`);
      onUpdate();
    } catch (error) {
      console.error('Error bulk check-in:', error);
      toast.error('Failed to check in players');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <Input
            placeholder="Search players..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={divisionFilter} onValueChange={setDivisionFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by division" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Divisions</SelectItem>
            {divisions.map((div) => (
              <SelectItem key={div.id} value={div.id}>
                {div.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={handleCheckInAll} disabled={loading} variant="outline">
          Check In All
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">Check In</TableHead>
              <TableHead>Name</TableHead>
              <TableHead className="hidden md:table-cell">Email</TableHead>
              <TableHead className="hidden sm:table-cell">Phone</TableHead>
              <TableHead>Division</TableHead>
              <TableHead className="w-12">Paid</TableHead>
              <TableHead className="w-20">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredEntries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-gray-500 py-8">
                  No players found
                </TableCell>
              </TableRow>
            ) : (
              filteredEntries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell>
                    <Checkbox
                      checked={entry.checked_in}
                      onCheckedChange={(checked) => handleCheckIn(entry, checked === true)}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{entry.player.name}</TableCell>
                  <TableCell className="hidden md:table-cell text-gray-600">
                    {entry.player.email || '-'}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-gray-600">
                    {entry.player.phone ? formatPhoneNumber(entry.player.phone) : '-'}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{entry.division.name}</Badge>
                  </TableCell>
                  <TableCell>
                    <Checkbox
                      checked={entry.entry_fee_paid}
                      onCheckedChange={(checked) => handleEntryFeePaid(entry, checked === true)}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingEntry(entry)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:text-red-700"
                        onClick={() => setDeleteEntry(entry)}
                      >
                        Remove
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Summary */}
      <div className="text-sm text-gray-600">
        Showing {filteredEntries.length} of {entries.length} players
        {' • '}
        {filteredEntries.filter((e) => e.checked_in).length} checked in
      </div>

      {/* Edit Division Dialog */}
      <Dialog open={!!editingEntry} onOpenChange={() => setEditingEntry(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Player Registration</DialogTitle>
            <DialogDescription>
              Update division for {editingEntry?.player.name}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="division">Division</Label>
            <Select
              value={editingEntry?.division_id}
              onValueChange={(value) =>
                setEditingEntry((prev) => (prev ? { ...prev, division_id: value } : null))
              }
            >
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Select division" />
              </SelectTrigger>
              <SelectContent>
                {divisions.map((div) => (
                  <SelectItem key={div.id} value={div.id}>
                    {div.name} ({div.match_length}pt)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingEntry(null)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateDivision} disabled={loading}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteEntry} onOpenChange={() => setDeleteEntry(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Player</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove {deleteEntry?.player.name} from this tournament?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteEntry(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={loading}>
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
