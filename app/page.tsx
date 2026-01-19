'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">
            Destiny 2&apos;s Backgammon Smackdown
          </h1>
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

      {/* Hero Section */}
      <main className="container mx-auto px-4 py-16">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
            Tournament Management Made Simple
          </h2>
          <p className="text-lg text-gray-600 mb-8">
            Run professional backgammon tournaments with double elimination brackets,
            real-time score tracking, and SMS reporting.
          </p>
          <div className="flex gap-4 justify-center">
            <Link href="/tournaments/new">
              <Button size="lg" className="text-lg px-8">
                Create Tournament
              </Button>
            </Link>
            <Link href="/tournaments">
              <Button size="lg" variant="outline" className="text-lg px-8">
                View Tournaments
              </Button>
            </Link>
          </div>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="text-2xl">🏆</span>
                Multi-Division
              </CardTitle>
              <CardDescription>
                Championship, Intermediate, and Beginner divisions with customizable match lengths
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-gray-600 space-y-2">
                <li>• 9-point Championship matches</li>
                <li>• 7-point Intermediate matches</li>
                <li>• 5-point Beginner matches</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="text-2xl">📊</span>
                Double Elimination
              </CardTitle>
              <CardDescription>
                Fair tournament structure with Main and Consolation brackets
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-gray-600 space-y-2">
                <li>• Automatic bracket generation</li>
                <li>• Real-time bracket updates</li>
                <li>• Mobile-friendly viewing</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="text-2xl">📱</span>
                SMS Reporting
              </CardTitle>
              <CardDescription>
                Players text scores directly, directors approve with one click
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-gray-600 space-y-2">
                <li>• Text-based score submission</li>
                <li>• Batch approval queue</li>
                <li>• Instant bracket updates</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t bg-white mt-16">
        <div className="container mx-auto px-4 py-8 text-center text-gray-600">
          <p>Destiny 2&apos;s Backgammon Smackdown © {new Date().getFullYear()}</p>
        </div>
      </footer>
    </div>
  );
}
