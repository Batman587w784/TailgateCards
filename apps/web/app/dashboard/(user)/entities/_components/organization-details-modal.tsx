'use client';

import { useEffect, useState, useTransition } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { CalendarDays, Mail, Pencil, Save, TicketPercent } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { useSupabase } from '@kit/supabase/hooks/use-supabase';
import { Button } from '@kit/ui/button';
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
import { Separator } from '@kit/ui/separator';
import { toast } from '@kit/ui/sonner';
import { Switch } from '@kit/ui/switch';

import {
  MerchantOption,
  OrganizationWithAccount,
} from '../_lib/server/entities-page.loader';
import {
  resendEntityInviteAction,
  updateOrganizationAction,
} from '../_lib/server/entities-server-actions';
import { uploadMerchantLogo } from '../_lib/utils/upload-merchant-logo';
import { BusinessLogoUpload } from './business-logo-upload';
import { CityAutocomplete } from './city-autocomplete';
import { MerchantMultiSelect } from './merchant-multi-select';
import { StateAutocomplete } from './state-autocomplete';

const UpdateOrganizationFormSchema = z.object({
  organizationName: z.string().min(1, 'Organization name is required'),
  sharePerCardCents: z.number().int().min(0).max(100000).optional(),
  primaryContactEmail: z.string().email().optional().or(z.literal('')),
  contactPhone: z.string().optional(),
  address: z.string().optional(),
  state: z.string().optional(),
  city: z.string().optional(),
  isActive: z.boolean(),
  merchantPartnerIds: z.array(z.string().uuid()).optional(),
});

type FormValues = z.infer<typeof UpdateOrganizationFormSchema>;

interface OrganizationDetailsModalProps {
  organization: OrganizationWithAccount;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  merchants: MerchantOption[];
  currentPartnerIds: string[];
}

export function OrganizationDetailsModal({
  organization,
  open,
  onOpenChange,
  merchants,
  currentPartnerIds,
}: OrganizationDetailsModalProps) {
  const client = useSupabase();
  const [pending, startTransition] = useTransition();
  const [resendPending, startResendTransition] = useTransition();
  const [isEditing, setIsEditing] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(UpdateOrganizationFormSchema),
    defaultValues: {
      organizationName: organization.organization_name ?? '',
      sharePerCardCents: organization.share_per_card_cents ?? 1250,
      primaryContactEmail: organization.primary_contact_email ?? '',
      contactPhone: organization.contact_phone ?? '',
      address: organization.address ?? '',
      state: organization.state ?? '',
      city: organization.city ?? '',
      isActive: organization.is_active,
      merchantPartnerIds: currentPartnerIds,
    },
  });

  const selectedState = form.watch('state');

  // Sync form with currentPartnerIds when it changes (async fetch completes)
  useEffect(() => {
    form.setValue('merchantPartnerIds', currentPartnerIds);
  }, [currentPartnerIds, form]);

  const onSubmit = (data: FormValues) => {
    startTransition(async () => {
      try {
        const result = await updateOrganizationAction({
          accountId: organization.account_id,
          organizationName: data.organizationName,
          sharePerCardCents: data.sharePerCardCents,
          primaryContactEmail: data.primaryContactEmail,
          contactPhone: data.contactPhone,
          address: data.address,
          state: data.state,
          city: data.city,
          isActive: data.isActive,
          merchantPartnerIds: data.merchantPartnerIds,
        });

        if (result.success) {
          if (logoFile) {
            try {
              await uploadMerchantLogo(client, logoFile, organization.account_id);
            } catch {
              toast.error('Organization saved, but the logo upload failed.');
              setIsEditing(false);
              onOpenChange(false);
              return;
            }
          }

          toast.success('Organization updated successfully');
          setIsEditing(false);
          onOpenChange(false);
        } else {
          toast.error(result.error);
        }
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : 'Failed to update organization',
        );
      }
    });
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(cents / 100);
  };

  const formatDate = (date: string | null) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
    });
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setIsEditing(false);
      form.reset({
        organizationName: organization.organization_name ?? '',
        sharePerCardCents: organization.share_per_card_cents ?? 1250,
        primaryContactEmail: organization.primary_contact_email ?? '',
        contactPhone: organization.contact_phone ?? '',
        address: organization.address ?? '',
        state: organization.state ?? '',
        city: organization.city ?? '',
        isActive: organization.is_active,
        merchantPartnerIds: currentPartnerIds,
      });
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[70vh] overflow-y-auto sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Organization Details</DialogTitle>
          <DialogDescription>
            See the full info for this organization.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <div className="space-y-4 rounded-lg border p-4">
              {/* Header Row */}
              <div className="flex items-center justify-between">
                <FormField
                  control={form.control}
                  name="organizationName"
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormControl>
                        {isEditing ? (
                          <Input
                            {...field}
                            placeholder="Organization name"
                            className="text-brand-600 text-xl font-semibold"
                          />
                        ) : (
                          <h3 className="text-brand-600 text-xl font-semibold">
                            {field.value}
                          </h3>
                        )}
                      </FormControl>
                    </FormItem>
                  )}
                />
                {!isEditing && (
                  <div className="ml-4 flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={resendPending}
                      onClick={() => {
                        startResendTransition(async () => {
                          try {
                            const result = await resendEntityInviteAction({
                              accountId: organization.account_id,
                              entityType: 'organization',
                            });

                            if (result.success) {
                              toast.success('Invite email resent successfully');
                            } else {
                              toast.error(
                                'error' in result
                                  ? result.error
                                  : 'Failed to resend invite',
                              );
                            }
                          } catch {
                            toast.error('Failed to resend invite');
                          }
                        });
                      }}
                    >
                      <Mail className="mr-2 h-4 w-4" />
                      {resendPending ? 'Sending...' : 'Resend Invite'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setIsEditing(true)}
                    >
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit
                    </Button>
                  </div>
                )}
              </div>

              {/* Metrics Row */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="text-muted-foreground flex items-center gap-2 text-sm">
                  <TicketPercent className="h-4 w-4" />
                  <span>
                    Total Revenue: {formatCurrency(organization.total_revenue)}
                  </span>
                </div>
                <div className="text-muted-foreground flex items-center gap-2 text-sm">
                  <CalendarDays className="h-4 w-4" />
                  <span>Created at {formatDate(organization.created_at)}</span>
                </div>
              </div>

              {/* Share per Card Field */}
              <FormField
                control={form.control}
                name="sharePerCardCents"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Share per Card Sale</FormLabel>
                    <FormControl>
                      {isEditing ? (
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          max="1000"
                          placeholder="12.50"
                          value={
                            field.value ? (field.value / 100).toFixed(2) : ''
                          }
                          onChange={(e) => {
                            const dollars = parseFloat(e.target.value);
                            field.onChange(
                              isNaN(dollars) ? 0 : Math.round(dollars * 100),
                            );
                          }}
                        />
                      ) : (
                        <span className="text-muted-foreground text-sm">
                          {field.value ? formatCurrency(field.value) : '-'}
                        </span>
                      )}
                    </FormControl>
                  </FormItem>
                )}
              />

              <Separator />

              {/* Contact Fields */}
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="primaryContactEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        {isEditing ? (
                          <Input
                            type="email"
                            placeholder="email@example.com"
                            {...field}
                          />
                        ) : (
                          <span className="text-muted-foreground text-sm">
                            {field.value || '-'}
                          </span>
                        )}
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="contactPhone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Primary Contact Phone number</FormLabel>
                      <FormControl>
                        {isEditing ? (
                          <Input
                            type="tel"
                            placeholder="(555) 123-4567"
                            {...field}
                          />
                        ) : (
                          <span className="text-muted-foreground text-sm">
                            {field.value || '-'}
                          </span>
                        )}
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address</FormLabel>
                      <FormControl>
                        {isEditing ? (
                          <Input placeholder="123 Main St" {...field} />
                        ) : (
                          <span className="text-muted-foreground text-sm">
                            {field.value || '-'}
                          </span>
                        )}
                      </FormControl>
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="state"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>State</FormLabel>
                        <FormControl>
                          {isEditing ? (
                            <StateAutocomplete
                              value={field.value ?? ''}
                              onValueChange={(value) => {
                                field.onChange(value);
                                form.setValue('city', '');
                              }}
                              placeholder="Select state..."
                            />
                          ) : (
                            <span className="text-muted-foreground text-sm">
                              {field.value || '-'}
                            </span>
                          )}
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>City</FormLabel>
                        <FormControl>
                          {isEditing ? (
                            <CityAutocomplete
                              value={field.value ?? ''}
                              onValueChange={field.onChange}
                              placeholder="Select city..."
                              state={selectedState}
                              disabled={!selectedState}
                            />
                          ) : (
                            <span className="text-muted-foreground text-sm">
                              {field.value || '-'}
                            </span>
                          )}
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="merchantPartnerIds"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Merchant Partners</FormLabel>
                      <FormControl>
                        {isEditing ? (
                          <MerchantMultiSelect
                            merchants={merchants}
                            value={field.value ?? []}
                            onValueChange={field.onChange}
                            placeholder="Select merchant partners..."
                          />
                        ) : (
                          <div className="text-muted-foreground text-sm">
                            {field.value && field.value.length > 0
                              ? merchants
                                  .filter((m) => field.value?.includes(m.id))
                                  .map((m) => m.name)
                                  .join(', ')
                              : '-'}
                          </div>
                        )}
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <Separator />

              {/* Org logo (edit mode) — M3 / P0-3 */}
              {isEditing && (
                <BusinessLogoUpload
                  onFileSelect={setLogoFile}
                  initialPreview={organization.account?.picture_url ?? null}
                />
              )}

              {/* Status Row */}
              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <div className="bg-muted/50 flex items-center justify-between rounded-lg px-4 py-3">
                    <span className="text-muted-foreground text-sm">
                      Status:
                    </span>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={!isEditing}
                      className="data-[state=checked]:bg-green-500"
                    />
                  </div>
                )}
              />
            </div>

            {/* Save Button - only visible in edit mode */}
            {isEditing && (
              <div className="mt-4 flex justify-end">
                <Button
                  type="submit"
                  disabled={pending}
                  className="bg-brand-400 hover:bg-brand-400/90 text-white"
                >
                  <Save className="mr-2 h-4 w-4" />
                  {pending ? 'Saving...' : 'Save'}
                </Button>
              </div>
            )}
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
