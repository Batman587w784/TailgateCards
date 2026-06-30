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
import { toast } from '@kit/ui/sonner';
import { Spinner } from '@kit/ui/spinner';

import { InviteDistributorSchema } from '../_lib/schemas/distributor.schema';
import { inviteDistributorAction } from '../_lib/server/distributors-server-actions';

interface AddDistributorFormProps {
  onSuccess: () => void;
}

export function AddDistributorForm({ onSuccess }: AddDistributorFormProps) {
  const [isPending, startTransition] = useTransition();

  const form = useForm({
    resolver: zodResolver(InviteDistributorSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
    },
  });

  return (
    <Form {...form}>
      <form
        className="flex flex-col gap-4"
        onSubmit={form.handleSubmit((data) => {
          startTransition(async () => {
            try {
              const result = await inviteDistributorAction(data);

              if (result.success) {
                toast.success('Invitation sent successfully');
                form.reset();
                onSuccess();
              }
            } catch (error) {
              toast.error(
                error instanceof Error
                  ? error.message
                  : 'Failed to invite distributor',
              );
            }
          });
        })}
      >
        <FormField
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
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
              <FormLabel>Phone (Optional)</FormLabel>
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

        <Button
          type="submit"
          disabled={isPending}
          data-test="invite-distributor-button"
          className="mt-2"
        >
          {isPending ? (
            <>
              <Spinner className="mr-2 h-4 w-4" />
              Sending Invitation...
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
