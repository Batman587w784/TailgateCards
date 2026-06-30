'use client';

import { useTransition } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { Plus } from 'lucide-react';
import { useForm } from 'react-hook-form';

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { toast } from '@kit/ui/sonner';
import { Spinner } from '@kit/ui/spinner';

import { CreateDistributorSchema } from '../_lib/schemas/entity.schema';
import { OrganizationOption } from '../_lib/server/entities-page.loader';
import { createDistributorAction } from '../_lib/server/entities-server-actions';

interface CreateDistributorFormProps {
  onSuccess: () => void;
  organizations: OrganizationOption[];
}

export function CreateDistributorForm({
  onSuccess,
  organizations,
}: CreateDistributorFormProps) {
  const [isPending, startTransition] = useTransition();

  const form = useForm({
    resolver: zodResolver(CreateDistributorSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      organizationId: '',
    },
  });

  return (
    <Form {...form}>
      <form
        className="flex flex-col gap-4"
        onSubmit={form.handleSubmit((data) => {
          startTransition(async () => {
            const result = await createDistributorAction(data);

            if (result.success) {
              toast.success(
                'Distributor created successfully. An email has been sent to set their password.',
              );
              form.reset();
              onSuccess();
            } else {
              toast.error(result.error ?? 'Failed to create distributor');
            }
          });
        })}
      >
        <FormField
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Distributor Name</FormLabel>
              <FormControl>
                <Input
                  placeholder="Enter distributor name"
                  data-test="distributor-name-input"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  placeholder="Enter email address"
                  autoComplete="email"
                  data-test="distributor-email-input"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Distributor Phone number</FormLabel>
              <FormControl>
                <Input
                  type="tel"
                  placeholder="Enter phone number"
                  data-test="distributor-phone-input"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          name="organizationId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Select an organization</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
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

        <Button
          type="submit"
          disabled={isPending}
          data-test="create-distributor-button"
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
              Add Distributor
            </>
          )}
        </Button>
      </form>
    </Form>
  );
}
