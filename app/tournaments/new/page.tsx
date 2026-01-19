'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { CreateTournamentForm } from '@/components/tournaments/CreateTournamentForm';

export default function NewTournamentPage() {
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

      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Create Tournament</h1>
          <p className="text-gray-600 mt-1">Set up a new backgammon tournament</p>
        </div>

        <CreateTournamentForm />
      </main>
    </div>
  );
}
