'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { isValidEmail } from '@/lib/utils';
import type { Player, Division } from '@/lib/database.types';

interface PlayerRegistrationFormProps {
  tournamentId: string;
  divisions: Division[];
  onSuccess: () => void;
}

export function PlayerRegistrationForm({
  tournamentId,
  divisions,
  onSuccess,
}: PlayerRegistrationFormProps) {
  const [mode, setMode] = useState<'existing' | 'new'>('existing');
  const [loading, setLoading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);

  // New player form
  const [newPlayer, setNewPlayer] = useState({
    name: '',
    email: '',
    phone: '',
  });

  // Common fields
  const [divisionId, setDivisionId] = useState<string>(divisions[0]?.id || '');
  const [entryFeePaid, setEntryFeePaid] = useState(false);

  useEffect(() => {
    loadPlayers();
  }, []);

  const loadPlayers = async () => {
    const { data, error } = await supabase
      .from('players')
      .select('*')
      .order('name');

    if (!error && data) {
      setPlayers(data);
    }
  };

  const filteredPlayers = players.filter(
    (player) =>
      player.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      player.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      player.phone?.includes(searchTerm)
  );

  const handleSelectPlayer = (player: Player) => {
    setSelectedPlayer(player);
    setSearchOpen(false);
  };

  const handleAddExistingPlayer = async () => {
    if (!selectedPlayer || !divisionId) {
      toast.error('Please select a player and division');
      return;
    }

    setLoading(true);
    try {
      // Check if player is already registered
      const { data: existing } = await supabase
        .from('tournament_entries')
        .select('id')
        .eq('tournament_id', tournamentId)
        .eq('player_id', selectedPlayer.id)
        .eq('division_id', divisionId)
        .single();

      if (existing) {
        toast.error('Player is already registered in this division');
        return;
      }

      const { error } = await supabase.from('tournament_entries').insert({
        tournament_id: tournamentId,
        player_id: selectedPlayer.id,
        division_id: divisionId,
        entry_fee_paid: entryFeePaid,
        checked_in: false,
      });

      if (error) throw error;

      toast.success(`${selectedPlayer.name} added to tournament`);
      setSelectedPlayer(null);
      setEntryFeePaid(false);
      onSuccess();
    } catch (error) {
      console.error('Error adding player:', error);
      toast.error('Failed to add player');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNewPlayer = async () => {
    if (!newPlayer.name.trim()) {
      toast.error('Player name is required');
      return;
    }

    if (newPlayer.email && !isValidEmail(newPlayer.email)) {
      toast.error('Please enter a valid email address');
      return;
    }

    if (!divisionId) {
      toast.error('Please select a division');
      return;
    }

    setLoading(true);
    try {
      // Create the player
      const { data: player, error: playerError } = await supabase
        .from('players')
        .insert({
          name: newPlayer.name.trim(),
          email: newPlayer.email.trim() || null,
          phone: newPlayer.phone.trim() || null,
        })
        .select()
        .single();

      if (playerError) throw playerError;

      // Add to tournament
      const { error: entryError } = await supabase.from('tournament_entries').insert({
        tournament_id: tournamentId,
        player_id: player.id,
        division_id: divisionId,
        entry_fee_paid: entryFeePaid,
        checked_in: false,
      });

      if (entryError) throw entryError;

      toast.success(`${player.name} created and added to tournament`);
      setNewPlayer({ name: '', email: '', phone: '' });
      setEntryFeePaid(false);
      loadPlayers(); // Refresh player list
      onSuccess();
    } catch (error: unknown) {
      console.error('Error creating player:', error);
      if (error && typeof error === 'object' && 'message' in error) {
        const errorMessage = (error as { message: string }).message;
        if (errorMessage.includes('duplicate')) {
          toast.error('A player with this email or phone already exists');
        } else {
          toast.error('Failed to create player');
        }
      } else {
        toast.error('Failed to create player');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add Player</CardTitle>
        <CardDescription>Add an existing player or create a new one</CardDescription>
      </CardHeader>
      <CardContent>
        {/* Mode Selector */}
        <div className="flex gap-2 mb-6">
          <Button
            type="button"
            variant={mode === 'existing' ? 'default' : 'outline'}
            onClick={() => setMode('existing')}
            className="flex-1"
          >
            Existing Player
          </Button>
          <Button
            type="button"
            variant={mode === 'new' ? 'default' : 'outline'}
            onClick={() => setMode('new')}
            className="flex-1"
          >
            New Player
          </Button>
        </div>

        {mode === 'existing' ? (
          <div className="space-y-4">
            {/* Player Search */}
            <div className="space-y-2">
              <Label>Search Player</Label>
              <Popover open={searchOpen} onOpenChange={setSearchOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="w-full justify-start"
                  >
                    {selectedPlayer ? selectedPlayer.name : 'Select a player...'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start">
                  <Command>
                    <CommandInput
                      placeholder="Search players..."
                      value={searchTerm}
                      onValueChange={setSearchTerm}
                    />
                    <CommandList>
                      <CommandEmpty>No players found</CommandEmpty>
                      <CommandGroup>
                        {filteredPlayers.slice(0, 10).map((player) => (
                          <CommandItem
                            key={player.id}
                            value={player.name}
                            onSelect={() => handleSelectPlayer(player)}
                          >
                            <div>
                              <p className="font-medium">{player.name}</p>
                              {player.email && (
                                <p className="text-sm text-gray-500">{player.email}</p>
                              )}
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Division */}
            <div className="space-y-2">
              <Label htmlFor="division">Division</Label>
              <Select value={divisionId} onValueChange={setDivisionId}>
                <SelectTrigger>
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

            {/* Entry Fee */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="entryFeePaid"
                checked={entryFeePaid}
                onCheckedChange={(checked) => setEntryFeePaid(checked === true)}
              />
              <Label htmlFor="entryFeePaid" className="cursor-pointer">
                Entry fee paid
              </Label>
            </div>

            <Button
              onClick={handleAddExistingPlayer}
              disabled={loading || !selectedPlayer}
              className="w-full"
            >
              {loading ? 'Adding...' : 'Add to Tournament'}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* New Player Form */}
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={newPlayer.name}
                onChange={(e) => setNewPlayer((p) => ({ ...p, name: e.target.value }))}
                placeholder="Full name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={newPlayer.email}
                onChange={(e) => setNewPlayer((p) => ({ ...p, email: e.target.value }))}
                placeholder="email@example.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={newPlayer.phone}
                onChange={(e) => setNewPlayer((p) => ({ ...p, phone: e.target.value }))}
                placeholder="+1-555-123-4567"
              />
            </div>

            {/* Division */}
            <div className="space-y-2">
              <Label htmlFor="newPlayerDivision">Division *</Label>
              <Select value={divisionId} onValueChange={setDivisionId}>
                <SelectTrigger>
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

            {/* Entry Fee */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="newEntryFeePaid"
                checked={entryFeePaid}
                onCheckedChange={(checked) => setEntryFeePaid(checked === true)}
              />
              <Label htmlFor="newEntryFeePaid" className="cursor-pointer">
                Entry fee paid
              </Label>
            </div>

            <Button
              onClick={handleCreateNewPlayer}
              disabled={loading || !newPlayer.name.trim()}
              className="w-full"
            >
              {loading ? 'Creating...' : 'Create & Add Player'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
