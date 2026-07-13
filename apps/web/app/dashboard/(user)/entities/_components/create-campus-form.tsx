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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { toast } from '@kit/ui/sonner';
import { Spinner } from '@kit/ui/spinner';

import { CreateCampusSchema } from '../_lib/schemas/entity.schema';
import { createCampusAction } from '../_lib/server/districts-server-actions';
import { CityAutocomplete } from './city-autocomplete';
import { StateAutocomplete } from './state-autocomplete';

export function CreateCampusForm({ onSuccess }: { onSuccess: () => void }) {
  const [isPending, startTransition] = useTransition();

  const form = useForm({
    resolver: zodResolver(CreateCampusSchema),
    defaultValues: {
      name: '',
      districtType: 'campus' as const,
      state: '',
      city: '',
      isActive: true,
    },
  });

  const selectedState = form.watch('state');

  return (
    <Form {...form}>
      <form
        className="flex max-h-[70vh] flex-col"
        onSubmit={form.handleSubmit((data) => {
          startTransition(async () => {
            const result = await createCampusAction(data);

            if (result.success) {
              toast.success('Campus created successfully.');
              form.reset();
              onSuccess();
            } else {
              toast.error(result.error ?? 'Failed to create campus');
            }
          });
        })}
      >
        <div className="flex-1 space-y-4 overflow-auto px-2">
          <FormField
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Campus Name</FormLabel>
                <FormControl>
                  <Input
                    placeholder="e.g., West Virginia University"
                    data-test="campus-name-input"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
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
                    <SelectTrigger data-test="campus-type-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="campus">
                        Campus (Campus / Chapter / Member)
                      </SelectItem>
                      <SelectItem value="generic">
                        Generic (District / Organization / Member)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormDescription>
                  Controls the naming shown to members and supporters.
                </FormDescription>
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
        </div>

        <Button
          type="submit"
          disabled={isPending}
          data-test="create-campus-button"
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
              Add Campus
            </>
          )}
        </Button>
      </form>
    </Form>
  );
}
