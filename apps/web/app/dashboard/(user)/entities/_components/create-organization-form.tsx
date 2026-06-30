'use client';

import { useTransition } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { Plus } from 'lucide-react';
import { useForm } from 'react-hook-form';

import { Button } from '@kit/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@kit/ui/form';
import { Input } from '@kit/ui/input';
import { toast } from '@kit/ui/sonner';
import { Spinner } from '@kit/ui/spinner';

import { CreateOrganizationSchema } from '../_lib/schemas/entity.schema';
import { createOrganizationAction } from '../_lib/server/entities-server-actions';
import { CityAutocomplete } from './city-autocomplete';
import {
  MerchantMultiSelect,
  type MerchantOption,
} from './merchant-multi-select';
import { StateAutocomplete } from './state-autocomplete';

interface CreateOrganizationFormProps {
  onSuccess: () => void;
  merchants: MerchantOption[];
}

export function CreateOrganizationForm({
  onSuccess,
  merchants,
}: CreateOrganizationFormProps) {
  const [isPending, startTransition] = useTransition();

  const form = useForm({
    resolver: zodResolver(CreateOrganizationSchema),
    defaultValues: {
      organizationName: '',
      cardPrefix: '',
      sharePerCardCents: 1250,
      primaryContactName: '',
      primaryContactEmail: '',
      primaryContactPhone: '',
      address: '',
      state: '',
      city: '',
      merchantPartnerIds: [] as string[],
    },
  });

  const selectedState = form.watch('state');

  return (
    <Form {...form}>
      <form
        className="flex max-h-[70vh] flex-col"
        onSubmit={form.handleSubmit((data) => {
          startTransition(async () => {
            const result = await createOrganizationAction(data);

            if (result.success) {
              toast.success(
                'Organization created successfully. An email has been sent to set their password.',
              );
              form.reset();
              onSuccess();
            } else {
              toast.error(result.error ?? 'Failed to create organization');
            }
          });
        })}
      >
        <div className="flex-1 space-y-4 overflow-auto px-2">
          <FormField
            name="organizationName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Organization Name</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Enter organization name"
                    data-test="organization-name-input"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            name="cardPrefix"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Card Prefix</FormLabel>
                <FormControl>
                  <Input
                    placeholder="e.g., ACME, ORG1"
                    data-test="card-prefix-input"
                    maxLength={10}
                    {...field}
                    onChange={(e) =>
                      field.onChange(
                        e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''),
                      )
                    }
                  />
                </FormControl>
                <FormDescription>
                  2-10 uppercase letters/numbers. Used as the first part of card
                  codes (e.g., ACME-BATCH-001).
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            name="sharePerCardCents"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Share per Card Sale ($)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max="1000"
                    placeholder="12.50"
                    data-test="share-per-card-input"
                    value={field.value ? (field.value / 100).toFixed(2) : ''}
                    onChange={(e) => {
                      const dollars = parseFloat(e.target.value);
                      field.onChange(
                        isNaN(dollars) ? 0 : Math.round(dollars * 100),
                      );
                    }}
                  />
                </FormControl>
                <FormDescription>
                  The organization&apos;s revenue share per activated card sale.
                </FormDescription>
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

          <FormField
            name="primaryContactPhone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Primary Contact Phone number</FormLabel>
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

          <div className="grid grid-cols-2 gap-4">
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
                        form.setValue('city', '');
                      }}
                      placeholder="Select state..."
                    />
                  </FormControl>
                  <FormMessage />
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

          <FormField
            name="merchantPartnerIds"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Merchant Partners</FormLabel>
                <FormControl>
                  <MerchantMultiSelect
                    merchants={merchants}
                    value={field.value ?? []}
                    onValueChange={field.onChange}
                    placeholder="Choose merchant partners..."
                  />
                </FormControl>
                <FormDescription>
                  Select merchants this organization will partner with.
                  Cardholders will see discounts from these merchants.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <Button
          type="submit"
          disabled={isPending}
          data-test="create-organization-button"
          className="bg-brand-400 hover:bg-brand-400/90 mt-2 text-white"
        >
          {isPending ? (
            <>
              <Spinner className="mr-2 h-4 w-4" />
              Creating...
            </>
          ) : (
            <>
              <Plus className="mr-2 h-4 w-4" />
              Add Organization
            </>
          )}
        </Button>
      </form>
    </Form>
  );
}
