'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

const DEFAULT_DIVISIONS = [
  { name: 'Championship', match_length: 9, clock_required: true },
  { name: 'Intermediate', match_length: 7, clock_required: false },
  { name: 'Beginner', match_length: 5, clock_required: false },
];

interface FormData {
  name: string;
  location: string;
  start_date: string;
  end_date: string;
  sms_phone_number: string;
}

export function CreateTournamentForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    name: '',
    location: '',
    start_date: '',
    end_date: '',
    sms_phone_number: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error('Tournament name is required');
      return;
    }

    if (!formData.start_date) {
      toast.error('Start date is required');
      return;
    }

    // Validate dates
    const startDate = new Date(formData.start_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (startDate < today) {
      toast.error('Start date must be today or in the future');
      return;
    }

    if (formData.end_date) {
      const endDate = new Date(formData.end_date);
      if (endDate < startDate) {
        toast.error('End date must be after start date');
        return;
      }
    }

    setLoading(true);

    try {
      // Create tournament
      const { data: tournament, error: tournamentError } = await supabase
        .from('tournaments')
        .insert({
          name: formData.name.trim(),
          location: formData.location.trim() || null,
          start_date: formData.start_date,
          end_date: formData.end_date || null,
          sms_phone_number: formData.sms_phone_number.trim() || null,
          status: 'draft',
        })
        .select()
        .single();

      if (tournamentError) throw tournamentError;

      // Create default divisions
      const divisionsToCreate = DEFAULT_DIVISIONS.map((div) => ({
        tournament_id: tournament.id,
        name: div.name,
        match_length: div.match_length,
        clock_required: div.clock_required,
      }));

      const { error: divisionsError } = await supabase
        .from('divisions')
        .insert(divisionsToCreate);

      if (divisionsError) throw divisionsError;

      // Save as template if checked
      if (saveAsTemplate) {
        const templates = JSON.parse(localStorage.getItem('tournamentTemplates') || '[]');
        templates.push({
          id: Date.now(),
          name: formData.name,
          location: formData.location,
          divisions: DEFAULT_DIVISIONS,
        });
        localStorage.setItem('tournamentTemplates', JSON.stringify(templates));
      }

      toast.success('Tournament created successfully!');
      router.push(`/tournaments/${tournament.id}`);
    } catch (error) {
      console.error('Error creating tournament:', error);
      toast.error('Failed to create tournament. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadTemplate = (template: { name: string; location: string }) => {
    setFormData((prev) => ({
      ...prev,
      name: template.name,
      location: template.location,
    }));
    toast.success('Template loaded');
  };

  // Get saved templates from localStorage
  const [templates, setTemplates] = useState<Array<{ id: number; name: string; location: string }>>([]);

  // Load templates on mount
  useState(() => {
    if (typeof window !== 'undefined') {
      const saved = JSON.parse(localStorage.getItem('tournamentTemplates') || '[]');
      setTemplates(saved);
    }
  });

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {templates.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Load from Template</CardTitle>
            <CardDescription>Start from a previously saved tournament</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {templates.map((template) => (
                <Button
                  key={template.id}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => loadTemplate(template)}
                >
                  {template.name}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Tournament Details</CardTitle>
          <CardDescription>Basic information about your tournament</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Tournament Name *</Label>
            <Input
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="e.g., Spring Championship 2025"
              maxLength={100}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              name="location"
              value={formData.location}
              onChange={handleChange}
              placeholder="e.g., Community Center, 123 Main St"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start_date">Start Date *</Label>
              <Input
                id="start_date"
                name="start_date"
                type="datetime-local"
                value={formData.start_date}
                onChange={handleChange}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="end_date">End Date (Optional)</Label>
              <Input
                id="end_date"
                name="end_date"
                type="datetime-local"
                value={formData.end_date}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sms_phone_number">SMS Phone Number (Optional)</Label>
            <Input
              id="sms_phone_number"
              name="sms_phone_number"
              value={formData.sms_phone_number}
              onChange={handleChange}
              placeholder="e.g., +1-555-123-4567"
            />
            <p className="text-sm text-gray-500">
              For SMS score reporting (will be enabled in Phase 2)
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Divisions</CardTitle>
          <CardDescription>
            The following divisions will be created automatically
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {DEFAULT_DIVISIONS.map((div, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div>
                  <p className="font-medium">{div.name}</p>
                  <p className="text-sm text-gray-600">
                    {div.match_length}-point matches
                    {div.clock_required && ' • Clock required'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="saveAsTemplate"
              checked={saveAsTemplate}
              onCheckedChange={(checked) => setSaveAsTemplate(checked === true)}
            />
            <Label htmlFor="saveAsTemplate" className="cursor-pointer">
              Save as template for future tournaments
            </Label>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-4">
        <Button type="submit" disabled={loading} className="flex-1">
          {loading ? 'Creating...' : 'Create Tournament'}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={loading}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
