'use client';

import { useTransition } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import { CalendarIcon, Save } from 'lucide-react';
import { useForm } from 'react-hook-form';

import { Button } from '@kit/ui/button';
import { Calendar } from '@kit/ui/calendar';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@kit/ui/form';
import { Input } from '@kit/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@kit/ui/popover';
import { toast } from '@kit/ui/sonner';
import { Spinner } from '@kit/ui/spinner';
import { cn } from '@kit/ui/utils';

import { UpdateDiscountSchema } from '../_lib/schemas/discount.schema';
import { DiscountWithMerchant } from '../_lib/server/discounts-page.loader';
import { updateDiscountAction } from '../_lib/server/discounts-server-actions';

interface EditDiscountFormProps {
  discount: DiscountWithMerchant;
  onSuccess: () => void;
}

export function EditDiscountForm({
  discount,
  onSuccess,
}: EditDiscountFormProps) {
  const [isPending, startTransition] = useTransition();

  const form = useForm({
    resolver: zodResolver(UpdateDiscountSchema),
    defaultValues: {
      discountId: discount.id,
      title: discount.title,
      validFrom: new Date(discount.valid_from),
      validUntil: discount.valid_until ? new Date(discount.valid_until) : null,
    },
  });

  return (
    <Form {...form}>
      <form
        className="flex flex-col gap-4"
        onSubmit={form.handleSubmit((data) => {
          startTransition(async () => {
            try {
              const result = await updateDiscountAction(data);

              if (result.success) {
                toast.success('Discount updated successfully');
                onSuccess();
              }
            } catch (error) {
              toast.error(
                error instanceof Error
                  ? error.message
                  : 'Failed to update discount',
              );
            }
          });
        })}
      >
        <FormField
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Discount Name</FormLabel>
              <FormControl>
                <Input
                  placeholder="Enter discount name"
                  data-test="discount-name-input"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Merchant is read-only for edit */}
        <div className="space-y-2">
          <FormLabel>Merchant</FormLabel>
          <Input
            value={discount.merchant.business_name ?? 'Unknown Merchant'}
            disabled
            className="bg-muted"
          />
          <p className="text-muted-foreground text-xs">
            Merchant cannot be changed after creation
          </p>
        </div>

        <div className="space-y-2">
          <FormLabel>Validity</FormLabel>
          <div className="grid grid-cols-2 gap-4">
            <FormField
              name="validFrom"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn(
                            'w-full justify-start text-left font-normal',
                            !field.value && 'text-muted-foreground',
                          )}
                          data-test="valid-from-date"
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {field.value ? (
                            format(field.value, 'PPP')
                          ) : (
                            <span>Start date</span>
                          )}
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              name="validUntil"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn(
                            'w-full justify-start text-left font-normal',
                            !field.value && 'text-muted-foreground',
                          )}
                          data-test="valid-until-date"
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {field.value ? (
                            format(field.value, 'PPP')
                          ) : (
                            <span>End date</span>
                          )}
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value ?? undefined}
                        onSelect={field.onChange}
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        <Button
          type="submit"
          disabled={isPending}
          data-test="update-discount-button"
          className="mt-2"
        >
          {isPending ? (
            <>
              <Spinner className="mr-2 h-4 w-4" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save Changes
            </>
          )}
        </Button>
      </form>
    </Form>
  );
}
