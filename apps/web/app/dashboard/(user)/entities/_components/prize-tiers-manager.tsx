'use client';

import { useState, useTransition } from 'react';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Trash2, Trophy } from 'lucide-react';

import { useSupabase } from '@kit/supabase/hooks/use-supabase';
import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Separator } from '@kit/ui/separator';
import { toast } from '@kit/ui/sonner';
import { Switch } from '@kit/ui/switch';

import {
  createPrizeTierAction,
  deletePrizeTierAction,
  toggleDistrictFundraiserAction,
} from '../_lib/server/districts-server-actions';

interface PrizeTiersManagerProps {
  districtId: string;
  fundraiserEnabled: boolean;
}

const EMPTY_FORM = {
  name: '',
  description: '',
  imageUrl: '',
  thresholdCards: '',
};

export function PrizeTiersManager({
  districtId,
  fundraiserEnabled,
}: PrizeTiersManagerProps) {
  const supabase = useSupabase();
  const queryClient = useQueryClient();
  const [enabled, setEnabled] = useState(fundraiserEnabled);
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState(EMPTY_FORM);

  const { data: tiers } = useQuery({
    queryKey: ['prize-tiers', districtId],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('prize_tiers')
        .select('id, name, description, image_url, threshold_cards, is_active')
        .eq('district_id', districtId)
        .order('threshold_cards', { ascending: true });

      if (error) throw error;
      return data ?? [];
    },
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['prize-tiers', districtId] });

  const toggleEnabled = (value: boolean) => {
    setEnabled(value);
    startTransition(async () => {
      const res = await toggleDistrictFundraiserAction({
        districtId,
        enabled: value,
      });
      if (!res.success) {
        setEnabled(!value);
        toast.error('Could not update the fundraiser setting');
      }
    });
  };

  const createTier = () => {
    const cards = Number.parseInt(form.thresholdCards, 10);

    if (!form.name.trim() || !Number.isFinite(cards) || cards < 0) {
      toast.error('Enter a tier name and a cards-to-activate number');
      return;
    }

    startTransition(async () => {
      const res = await createPrizeTierAction({
        districtId,
        name: form.name.trim(),
        description: form.description.trim(),
        imageUrl: form.imageUrl.trim(),
        thresholdCards: cards,
      });

      if (res.success) {
        toast.success('Prize tier added');
        setForm(EMPTY_FORM);
        invalidate();
      } else {
        toast.error(res.error ?? 'Could not add the tier');
      }
    });
  };

  const deleteTier = (id: string) => {
    startTransition(async () => {
      const res = await deletePrizeTierAction({ tierId: id });
      if (res.success) {
        invalidate();
      } else {
        toast.error('Could not delete the tier');
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="bg-muted/50 flex items-center justify-between rounded-lg px-4 py-3">
        <div className="flex items-center gap-2">
          <Trophy className="text-muted-foreground h-4 w-4" />
          <span className="text-sm font-medium">
            Enable district-wide fundraiser
          </span>
        </div>
        <Switch
          checked={enabled}
          onCheckedChange={toggleEnabled}
          disabled={pending}
          data-test="fundraiser-enabled-toggle"
        />
      </div>

      {enabled && (
        <div className="space-y-4 rounded-lg border p-4">
          {/* Existing tiers (ascending threshold). */}
          {tiers && tiers.length > 0 ? (
            <ul className="divide-y">
              {tiers.map((tier) => (
                <li
                  key={tier.id}
                  className="flex items-center justify-between gap-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {tier.threshold_cards.toLocaleString()} cards — {tier.name}
                    </p>
                    {tier.description ? (
                      <p className="text-muted-foreground truncate text-xs">
                        {tier.description}
                      </p>
                    ) : null}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive shrink-0"
                    disabled={pending}
                    aria-label="Delete tier"
                    onClick={() => deleteTier(tier.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground text-sm">
              No prize tiers yet. Add the first unlock below.
            </p>
          )}

          <Separator />

          {/* Create form. Thresholds are CARD COUNTS (M2.5 §0.3). */}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Input
              placeholder="Tier name (e.g. Beach trip)"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              data-test="tier-name-input"
            />
            <Input
              type="number"
              min={0}
              placeholder="Cards to activate"
              value={form.thresholdCards}
              onChange={(e) =>
                setForm({ ...form, thresholdCards: e.target.value })
              }
              data-test="tier-threshold-input"
            />
            <Input
              placeholder="Description (optional)"
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              className="sm:col-span-2"
            />
            {/* // REVIEW: image is a URL for now — could reuse the logo uploader
                to accept a file and store it in the account_image bucket. */}
            <Input
              placeholder="Image URL (optional)"
              value={form.imageUrl}
              onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
              className="sm:col-span-2"
            />
          </div>

          <Button
            type="button"
            onClick={createTier}
            disabled={pending}
            className="w-full sm:w-auto"
          >
            Add prize tier
          </Button>
        </div>
      )}
    </div>
  );
}
