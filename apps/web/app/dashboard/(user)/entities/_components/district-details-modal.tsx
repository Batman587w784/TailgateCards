'use client';

import { useEffect, useState, useTransition } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { Save } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@kit/ui/button';
import { Checkbox } from '@kit/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from '@kit/ui/form';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { ScrollArea } from '@kit/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { Separator } from '@kit/ui/separator';
import { toast } from '@kit/ui/sonner';
import { Switch } from '@kit/ui/switch';

import {
  DistrictWithStats,
  OrganizationOption,
} from '../_lib/server/entities-page.loader';
import {
  assignChaptersAction,
  getDistrictChaptersAction,
  updateCampusAction,
} from '../_lib/server/districts-server-actions';
import { CityAutocomplete } from './city-autocomplete';
import { StateAutocomplete } from './state-autocomplete';

const FormSchema = z.object({
  name: z.string().min(1, 'Campus name is required'),
  districtType: z.enum(['campus', 'generic']),
  state: z.string().optional(),
  city: z.string().optional(),
  isActive: z.boolean(),
});

type FormValues = z.infer<typeof FormSchema>;

interface DistrictDetailsModalProps {
  district: DistrictWithStats;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizations: OrganizationOption[];
}

export function DistrictDetailsModal({
  district,
  open,
  onOpenChange,
  organizations,
}: DistrictDetailsModalProps) {
  const [pending, startTransition] = useTransition();
  const [chapterIds, setChapterIds] = useState<string[]>([]);

  const form = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      name: district.name,
      districtType: district.district_type,
      state: district.state ?? '',
      city: district.city ?? '',
      isActive: district.is_active,
    },
  });

  const selectedState = form.watch('state');

  // Load the district's current chapters when the modal opens.
  useEffect(() => {
    if (!open) return;

    let active = true;

    getDistrictChaptersAction({ districtId: district.id })
      .then((result) => {
        if (active && result.success) {
          setChapterIds(result.data);
        }
      })
      .catch(() => {
        if (active) setChapterIds([]);
      });

    return () => {
      active = false;
    };
  }, [open, district.id]);

  const toggleChapter = (orgId: string, checked: boolean) => {
    setChapterIds((prev) =>
      checked ? [...new Set([...prev, orgId])] : prev.filter((id) => id !== orgId),
    );
  };

  const onSave = (values: FormValues) => {
    startTransition(async () => {
      const updateResult = await updateCampusAction({
        districtId: district.id,
        name: values.name,
        districtType: values.districtType,
        state: values.state || undefined,
        city: values.city || undefined,
        isActive: values.isActive,
      });

      if (!updateResult.success) {
        toast.error(updateResult.error ?? 'Failed to update campus');
        return;
      }

      const assignResult = await assignChaptersAction({
        districtId: district.id,
        orgAccountIds: chapterIds,
      });

      if (!assignResult.success) {
        toast.error(assignResult.error ?? 'Failed to assign chapters');
        return;
      }

      toast.success('Campus updated.');
      onOpenChange(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{district.name}</DialogTitle>
          <DialogDescription>
            {district.chapter_count} chapters ·{' '}
            {new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: 'USD',
              maximumFractionDigits: 0,
            }).format(district.total_revenue / 100)}{' '}
            raised
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form className="flex flex-col gap-4" onSubmit={form.handleSubmit(onSave)}>
            <FormField
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Campus Name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              name="districtType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Type</FormLabel>
                  <FormControl>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="campus">Campus</SelectItem>
                        <SelectItem value="generic">Generic</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                name="state"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>State</FormLabel>
                    <FormControl>
                      <StateAutocomplete
                        value={field.value ?? ''}
                        onValueChange={(value) => {
                          field.onChange(value);
                          form.setValue('city', '');
                        }}
                        placeholder="Select state..."
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>City</FormLabel>
                    <FormControl>
                      <CityAutocomplete
                        value={field.value ?? ''}
                        onValueChange={field.onChange}
                        placeholder="Select city..."
                        state={selectedState}
                        disabled={!selectedState}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <FormField
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between">
                  <FormLabel>Active</FormLabel>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      className="data-[state=checked]:bg-green-500"
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <Separator />

            <div className="flex flex-col gap-2">
              <Label>Chapters in this campus</Label>
              <p className="text-muted-foreground text-xs">
                Assign organizations (chapters) to this campus. Only active
                organizations are listed.
              </p>
              <ScrollArea className="h-48 rounded-md border p-2">
                {organizations.length === 0 ? (
                  <p className="text-muted-foreground p-2 text-sm">
                    No organizations available.
                  </p>
                ) : (
                  <div className="flex flex-col gap-1">
                    {organizations.map((org) => (
                      <label
                        key={org.id}
                        className="hover:bg-muted flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm"
                      >
                        <Checkbox
                          checked={chapterIds.includes(org.id)}
                          onCheckedChange={(checked) =>
                            toggleChapter(org.id, checked === true)
                          }
                        />
                        <span className="truncate">{org.name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>

            <Button type="submit" disabled={pending}>
              <Save className="mr-2 h-4 w-4" />
              {pending ? 'Saving...' : 'Save changes'}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
