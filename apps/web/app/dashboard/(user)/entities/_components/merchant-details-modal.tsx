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

import { MerchantWithAccount } from '../_lib/server/entities-page.loader';
import {
  resendEntityInviteAction,
  updateMerchantAction,
} from '../_lib/server/entities-server-actions';
import { uploadMerchantLogo } from '../_lib/utils/upload-merchant-logo';
import { BusinessLogoUpload } from './business-logo-upload';
import { CityAutocomplete } from './city-autocomplete';
import { StateAutocomplete } from './state-autocomplete';

const UpdateMerchantFormSchema = z.object({
  businessName: z.string().min(1, 'Business name is required'),
  primaryContactName: z.string().optional(),
  primaryContactEmail: z.string().email().optional().or(z.literal('')),
  contactPhone: z.string().optional(),
  address: z.string().optional(),
  state: z.string().optional(),
  city: z.string().optional(),
  isActive: z.boolean(),
});

type FormValues = z.infer<typeof UpdateMerchantFormSchema>;

interface MerchantDetailsModalProps {
  merchant: MerchantWithAccount;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialEditMode?: boolean;
}

export function MerchantDetailsModal({
  merchant,
  open,
  onOpenChange,
  initialEditMode = false,
}: MerchantDetailsModalProps) {
  const [pending, startTransition] = useTransition();
  const [resendPending, startResendTransition] = useTransition();
  const [isEditing, setIsEditing] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const client = useSupabase();

  useEffect(() => {
    if (open && initialEditMode) {
      setIsEditing(true);
    }
  }, [open, initialEditMode]);

  const form = useForm<FormValues>({
    resolver: zodResolver(UpdateMerchantFormSchema),
    defaultValues: {
      businessName: merchant.business_name ?? '',
      primaryContactName: merchant.primary_contact_name ?? '',
      primaryContactEmail: merchant.primary_contact_email ?? '',
      contactPhone: merchant.contact_phone ?? '',
      address: merchant.address ?? '',
      state: merchant.state ?? '',
      city: merchant.city ?? '',
      isActive: merchant.is_active,
    },
  });

  const selectedState = form.watch('state');

  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      setIsEditing(initialEditMode);
    } else {
      setIsEditing(false);
      setLogoFile(null);
      form.reset({
        businessName: merchant.business_name ?? '',
        primaryContactName: merchant.primary_contact_name ?? '',
        primaryContactEmail: merchant.primary_contact_email ?? '',
        contactPhone: merchant.contact_phone ?? '',
        address: merchant.address ?? '',
        state: merchant.state ?? '',
        city: merchant.city ?? '',
        isActive: merchant.is_active,
      });
    }
    onOpenChange(newOpen);
  };

  const onSubmit = (data: FormValues) => {
    startTransition(async () => {
      try {
        const result = await updateMerchantAction({
          accountId: merchant.account_id,
          businessName: data.businessName,
          primaryContactName: data.primaryContactName,
          primaryContactEmail: data.primaryContactEmail,
          contactPhone: data.contactPhone,
          address: data.address,
          state: data.state,
          city: data.city,
          isActive: data.isActive,
        });

        if (result.success) {
          if (logoFile) {
            try {
              await uploadMerchantLogo(client, logoFile, merchant.account_id);
            } catch (uploadError) {
              console.error('Logo upload failed:', uploadError);
              toast.error(
                `Merchant updated but logo upload failed: ${uploadError instanceof Error ? uploadError.message : 'Unknown error'}`,
              );
            }
          }

          toast.success('Merchant updated successfully');
          setLogoFile(null);
          setIsEditing(false);
        }
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Failed to update merchant',
        );
      }
    });
  };

  const formatDate = (date: string | null) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[70vh] overflow-y-auto sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Merchant Details</DialogTitle>
          <DialogDescription>
            See the full info for this merchant.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <div className="space-y-4 rounded-lg border p-4">
              {/* Header Row with Edit/Delete Buttons */}
              <div className="flex items-center justify-between">
                <FormField
                  control={form.control}
                  name="businessName"
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormControl>
                        {isEditing ? (
                          <Input
                            {...field}
                            placeholder="Business name"
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
                              accountId: merchant.account_id,
                              entityType: 'merchant',
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

              {/* Logo Section */}
              {isEditing ? (
                <BusinessLogoUpload
                  onFileSelect={setLogoFile}
                  initialPreview={merchant.account.picture_url}
                />
              ) : (
                merchant.account.picture_url && (
                  <div className="flex items-center gap-4">
                    <div className="bg-muted h-14 w-14 overflow-hidden rounded-xl">
                      <img
                        src={merchant.account.picture_url}
                        alt={`${merchant.business_name ?? 'Merchant'} logo`}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  </div>
                )
              )}

              {/* Metrics Row */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="text-muted-foreground flex items-center gap-2 text-sm">
                  <TicketPercent className="h-4 w-4" />
                  <span>
                    Total Redemptions:{' '}
                    {merchant.total_redemptions.toLocaleString()}
                  </span>
                </div>
                <div className="text-muted-foreground flex items-center gap-2 text-sm">
                  <CalendarDays className="h-4 w-4" />
                  <span>Created at {formatDate(merchant.created_at)}</span>
                </div>
              </div>

              <Separator />

              {/* Contact Fields */}
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="primaryContactName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Primary Contact Name</FormLabel>
                      <FormControl>
                        {isEditing ? (
                          <Input placeholder="Contact name" {...field} />
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
                  name="primaryContactEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        {isEditing ? (
                          <Input
                            type="email"
                            placeholder="contact@example.com"
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
                          <Input placeholder="(555) 123-4567" {...field} />
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
                              value={field.value}
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
                              value={field.value}
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
              </div>

              <Separator />

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
