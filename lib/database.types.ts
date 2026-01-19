// Status types
export type TournamentStatus = 'draft' | 'in_progress' | 'completed' | 'cancelled';
export type BracketType = 'main' | 'consolation' | 'last_chance';
export type BracketStatus = 'pending' | 'in_progress' | 'completed';
export type MatchStatus = 'pending' | 'in_progress' | 'completed' | 'bye';
export type ScoreReportStatus = 'pending' | 'approved' | 'rejected' | 'needs_clarification';

// Core entities
export interface Player {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  created_at: string;
  updated_at: string;
}

export interface Tournament {
  id: string;
  name: string;
  location: string | null;
  start_date: string;
  end_date: string | null;
  status: TournamentStatus;
  sms_phone_number: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Division {
  id: string;
  tournament_id: string;
  name: string;
  match_length: number; // Points to win (9, 7, or 5)
  clock_required: boolean;
  clock_settings: Record<string, unknown> | null;
  created_at: string;
}

export interface TournamentEntry {
  id: string;
  tournament_id: string;
  player_id: string;
  division_id: string;
  entry_fee_paid: boolean;
  checked_in: boolean;
  created_at: string;
  // Joined relations
  player?: Player;
  division?: Division;
}

export interface Bracket {
  id: string;
  division_id: string;
  bracket_type: BracketType;
  current_round: number;
  status: BracketStatus;
  created_at: string;
}

export interface Match {
  id: string;
  bracket_id: string;
  round_number: number;
  match_number: number;
  player1_id: string | null;
  player2_id: string | null;
  winner_id: string | null;
  player1_score: number;
  player2_score: number;
  table_number: number | null;
  status: MatchStatus;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  // Joined relations
  player1?: Player;
  player2?: Player;
  winner?: Player;
}

export interface ScoreReport {
  id: string;
  match_id: string;
  reported_by_phone: string;
  reported_by_player_id: string | null;
  raw_text: string;
  parsed_winner_id: string | null;
  parsed_player1_score: number | null;
  parsed_player2_score: number | null;
  confidence_score: number | null;
  status: ScoreReportStatus;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
}

// Extended types with relations
export interface DivisionWithEntries extends Division {
  tournament_entries: TournamentEntry[];
}

export interface TournamentWithDivisions extends Tournament {
  divisions: DivisionWithEntries[];
}

export interface BracketWithMatches extends Bracket {
  matches: Match[];
  division?: Division;
}

// Database type for Supabase client - simplified for better type inference
export interface Database {
  public: {
    Tables: {
      players: {
        Row: Player;
        Insert: Partial<Player> & { name: string };
        Update: Partial<Player>;
      };
      tournaments: {
        Row: Tournament;
        Insert: Partial<Tournament> & { name: string; start_date: string };
        Update: Partial<Tournament>;
      };
      divisions: {
        Row: Division;
        Insert: Partial<Division> & { tournament_id: string; name: string; match_length: number };
        Update: Partial<Division>;
      };
      tournament_entries: {
        Row: TournamentEntry;
        Insert: Partial<TournamentEntry> & { tournament_id: string; player_id: string; division_id: string };
        Update: Partial<TournamentEntry>;
      };
      brackets: {
        Row: Bracket;
        Insert: Partial<Bracket> & { division_id: string; bracket_type: BracketType };
        Update: Partial<Bracket>;
      };
      matches: {
        Row: Match;
        Insert: Partial<Match> & { bracket_id: string; round_number: number; match_number: number };
        Update: Partial<Match>;
      };
      score_reports: {
        Row: ScoreReport;
        Insert: Partial<ScoreReport> & { match_id: string; reported_by_phone: string; raw_text: string };
        Update: Partial<ScoreReport>;
      };
    };
  };
}
