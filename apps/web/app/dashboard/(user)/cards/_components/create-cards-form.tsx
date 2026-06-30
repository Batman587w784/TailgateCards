'use client';

import { useTransition } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { Plus } from 'lucide-react';
import { useForm, useWatch } from 'react-hook-form';

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { toast } from '@kit/ui/sonner';
import { Spinner } from '@kit/ui/spinner';

import {
  CreateCardsSchema,
  CreateCardsSchemaType,
} from '../../entities/_lib/schemas/entity.schema';
import { OrganizationOption } from '../../entities/_lib/server/entities-page.loader';
import { createCardsAction } from '../../entities/_lib/server/entities-server-actions';

interface CreateCardsFormProps {
  organizations: OrganizationOption[];
  onSuccess: () => void;
}

export function CreateCardsForm({
  organizations,
  onSuccess,
}: CreateCardsFormProps) {
  const [isPending, startTransition] = useTransition();

  const form = useForm<CreateCardsSchemaType>({
    resolver: zodResolver(CreateCardsSchema),
    defaultValues: {
      organizationId: '',
      batchName: '',
      batchPrefix: '',
      quantity: 10,
    },
    mode: 'onSubmit',
  });

  const onSubmit = (data: CreateCardsSchemaType) => {
    startTransition(async () => {
      try {
        const result = await createCardsAction(data);

        if (result.success && result.data) {
          toast.success(`Cards created successfully`);
          form.reset();
          onSuccess();
        } else if (!result.success && 'error' in result) {
          toast.error(result.error as string);
        }
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Failed to create cards',
        );
      }
    });
  };

  const watchedOrgId = useWatch({
    control: form.control,
    name: 'organizationId',
  });
  const watchedQuantity = useWatch({ control: form.control, name: 'quantity' });
  const watchedBatchName = useWatch({
    control: form.control,
    name: 'batchName',
  });
  const watchedBatchPrefix = useWatch({
    control: form.control,
    name: 'batchPrefix',
  });

  // Get selected organization's card prefix for preview
  const selectedOrg = organizations.find((o) => o.id === watchedOrgId);

  return (
    <Form {...form}>
      <form
        className="flex flex-col gap-4"
        onSubmit={form.handleSubmit(onSubmit)}
      >
        <FormField
          name="organizationId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Organization</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger data-test="organization-select">
                    <SelectValue placeholder="Select an organization" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {organizations.map((org) => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          name="batchName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Batch Name</FormLabel>
              <FormControl>
                <Input
                  placeholder="e.g., Spring 2025 Campaign"
                  data-test="batch-name-input"
                  {...field}
                />
              </FormControl>
              <FormDescription>
                Enter a name for this batch of cards. If a batch with this name
                already exists for the organization, cards will be added to it.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          name="batchPrefix"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Batch Prefix</FormLabel>
              <FormControl>
                <Input
                  placeholder="e.g., SPR25, SUMMER"
                  data-test="batch-prefix-input"
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
                2-10 uppercase letters/numbers. Combined with org prefix for
                card codes.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          name="quantity"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Quantity</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min={1}
                  max={5000}
                  placeholder="Number of cards to create"
                  data-test="quantity-input"
                  {...field}
                  onChange={(e) =>
                    field.onChange(parseInt(e.target.value) || 0)
                  }
                />
              </FormControl>
              <FormDescription>
                Create between 1 and 5000 cards at a time.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {watchedOrgId &&
          watchedBatchName &&
          watchedBatchPrefix &&
          watchedQuantity > 0 && (
            <div className="bg-muted/50 rounded-lg border p-4">
              <p className="mb-2 text-sm font-medium">Summary:</p>
              <p className="text-muted-foreground text-sm">
                Creating <strong>{watchedQuantity}</strong> cards in batch{' '}
                <strong>&quot;{watchedBatchName}&quot;</strong>
              </p>
              {selectedOrg?.cardPrefix && (
                <p className="text-muted-foreground mt-1 text-xs">
                  Card codes: {selectedOrg.cardPrefix}-{watchedBatchPrefix}-001,{' '}
                  {selectedOrg.cardPrefix}-{watchedBatchPrefix}-002, ...
                </p>
              )}
            </div>
          )}

        <Button
          type="submit"
          disabled={
            isPending ||
            !watchedOrgId ||
            !watchedBatchName ||
            !watchedBatchPrefix
          }
          data-test="create-cards-button"
          className="bg-brand-400 text-brand-foreground hover:bg-brand-400/90 mt-2"
        >
          {isPending ? (
            <>
              <Spinner className="mr-2 h-4 w-4" />
              Creating Cards...
            </>
          ) : (
            <>
              <Plus className="mr-2 h-4 w-4" />
              Create {watchedQuantity || 0} Cards
            </>
          )}
        </Button>
      </form>
    </Form>
  );
}
