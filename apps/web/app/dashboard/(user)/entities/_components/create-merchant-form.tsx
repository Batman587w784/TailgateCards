'use client';

import { useState, useTransition } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { Plus } from 'lucide-react';
import { useForm } from 'react-hook-form';

import { useSupabase } from '@kit/supabase/hooks/use-supabase';
import { Button } from '@kit/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@kit/ui/form';
import { Input } from '@kit/ui/input';
import { toast } from '@kit/ui/sonner';
import { Spinner } from '@kit/ui/spinner';

import { CreateMerchantSchema } from '../_lib/schemas/entity.schema';
import { createMerchantAction } from '../_lib/server/entities-server-actions';
import { uploadMerchantLogo } from '../_lib/utils/upload-merchant-logo';
import { BusinessLogoUpload } from './business-logo-upload';
import { CityAutocomplete } from './city-autocomplete';
import { StateAutocomplete } from './state-autocomplete';

interface CreateMerchantFormProps {
  onSuccess: () => void;
}

export function CreateMerchantForm({ onSuccess }: CreateMerchantFormProps) {
  const [isPending, startTransition] = useTransition();
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const client = useSupabase();

  const form = useForm({
    resolver: zodResolver(CreateMerchantSchema),
    defaultValues: {
      merchantName: '',
      discountName: '',
      primaryContactName: '',
      primaryContactEmail: '',
      primaryContactPhone: '',
      address: '',
      state: '',
      city: '',
      website: '',
    },
  });

  const selectedState = form.watch('state');

  return (
    <Form {...form}>
      <form
        className="flex max-h-[70vh] flex-col"
        onSubmit={form.handleSubmit((data) => {
          startTransition(async () => {
            const result = await createMerchantAction(data);

            if (result.success && result.data) {
              if (logoFile) {
                try {
                  await uploadMerchantLogo(client, logoFile, result.data.id);
                } catch (uploadError) {
                  console.error('Logo upload failed:', uploadError);
                  toast.error(
                    `Merchant created but logo upload failed: ${uploadError instanceof Error ? uploadError.message : 'Unknown error'}`,
                  );
                }
              }

              toast.success(
                'Merchant created successfully. An email has been sent to set their password.',
              );
              form.reset();
              setLogoFile(null);
              onSuccess();
            } else if (!result.success) {
              toast.error(result.error ?? 'Failed to create merchant');
            }
          });
        })}
      >
        <div className="flex-1 space-y-4 overflow-auto px-2">
          <FormField
            name="merchantName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Merchant Name</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Enter merchant name"
                    data-test="merchant-name-input"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            name="discountName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Discount Name</FormLabel>
                <FormControl>
                  <Input
                    placeholder="xx% off"
                    data-test="discount-name-input"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            name="address"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Address</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Enter address"
                    data-test="address-input"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex gap-4">
            <div className="w-1/2">
              <FormField
                name="state"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>State</FormLabel>
                    <FormControl>
                      <StateAutocomplete
                        value={field.value}
                        onValueChange={(value) => {
                          field.onChange(value);
                          // Reset city when state changes
                          form.setValue('city', '');
                        }}
                        placeholder="Select state..."
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="w-1/2">
              <FormField
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>City</FormLabel>
                    <FormControl>
                      <CityAutocomplete
                        value={field.value}
                        onValueChange={field.onChange}
                        placeholder="Select city..."
                        state={selectedState}
                        disabled={!selectedState}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          <FormField
            name="website"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Website or Social Link</FormLabel>
                <FormControl>
                  <Input
                    type="text"
                    placeholder="Enter website, domain, or @handle"
                    data-test="website-input"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            name="primaryContactName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Primary Contact Name</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Enter primary contact name"
                    data-test="primary-contact-name-input"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            name="primaryContactPhone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Primary Contact Phone Number</FormLabel>
                <FormControl>
                  <Input
                    type="tel"
                    placeholder="Enter phone number"
                    data-test="primary-contact-phone-input"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            name="primaryContactEmail"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Primary Contact Email</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    placeholder="Enter primary contact email address"
                    data-test="primary-contact-email-input"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <BusinessLogoUpload onFileSelect={setLogoFile} />
        </div>

        <div className="border-t pt-4">
          <Button
            type="submit"
            disabled={isPending}
            data-test="create-merchant-button"
            className="bg-brand-400 text-brand-foreground hover:bg-brand/90 w-full"
          >
            {isPending ? (
              <>
                <Spinner className="mr-2 h-4 w-4" />
                Creating...
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                Add Merchant
              </>
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}
