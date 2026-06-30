'use client';

import { useTransition } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import { CalendarIcon, CircleAlert, Plus } from 'lucide-react';
import { useForm, useWatch } from 'react-hook-form';

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { toast } from '@kit/ui/sonner';
import { Spinner } from '@kit/ui/spinner';
import { cn } from '@kit/ui/utils';

import { CreateDiscountSchema } from '../_lib/schemas/discount.schema';
import { MerchantOption } from '../_lib/server/discounts-page.loader';
import { createDiscountAction } from '../_lib/server/discounts-server-actions';

interface CreateDiscountFormProps {
  onSuccess: () => void;
  merchants: MerchantOption[];
}

export function CreateDiscountForm({
  onSuccess,
  merchants,
}: CreateDiscountFormProps) {
  const [isPending, startTransition] = useTransition();

  const form = useForm({
    resolver: zodResolver(CreateDiscountSchema),
    defaultValues: {
      title: '',
      merchantId: '',
      validFrom: undefined as Date | undefined,
    },
  });

  // Watch merchant selection for validation
  const selectedMerchantId = useWatch({
    control: form.control,
    name: 'merchantId',
  });

  const selectedMerchant = merchants.find((m) => m.id === selectedMerchantId);
  const merchantHasDiscount = selectedMerchant?.hasDiscount ?? false;

  return (
    <Form {...form}>
      <form
        className="flex flex-col gap-4"
        onSubmit={form.handleSubmit((data) => {
          if (merchantHasDiscount) {
            toast.error('This merchant already has a discount');
            return;
          }
          startTransition(async () => {
            try {
              const result = await createDiscountAction(data);

              if (result.success) {
                toast.success('Discount created successfully');
                form.reset();
                onSuccess();
              }
            } catch (error) {
              toast.error(
                error instanceof Error
                  ? error.message
                  : 'Failed to create discount',
              );
            }
          });
        })}
      >
        {/* Row 1: Discount Name (full width) */}
        <FormField
          name="title"
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

        {/* Row 2: Merchant Select (1/2) + Start Date (1/2) */}
        <div className="grid grid-cols-2 gap-4">
          <FormField
            name="merchantId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Merchant</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger
                      data-test="merchant-select"
                      className={cn(
                        merchantHasDiscount &&
                          'border-destructive focus:ring-destructive',
                      )}
                    >
                      <SelectValue placeholder="Select a merchant" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {merchants.map((merchant) => (
                      <SelectItem key={merchant.id} value={merchant.id}>
                        {merchant.name}
                        {merchant.city && (
                          <span className="text-muted-foreground ml-2">
                            ({merchant.city})
                          </span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            name="validFrom"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Start Date</FormLabel>
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
                          <span>Optional</span>
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
        </div>

        {/* Error Message - Merchant already has discount */}
        {merchantHasDiscount && <MerchantHasDiscountWarning />}

        {/* Row 3: Create Button (full width) */}
        <Button
          type="submit"
          disabled={isPending || merchantHasDiscount}
          data-test="create-discount-button"
          className="bg-brand-400 text-brand-foreground hover:bg-brand/90 mt-2 w-full"
        >
          {isPending ? (
            <>
              <Spinner className="mr-2 h-4 w-4" />
              Creating...
            </>
          ) : (
            <>
              <Plus className="mr-2 h-4 w-4" />
              Create Discount
            </>
          )}
        </Button>
      </form>
    </Form>
  );
}

function MerchantHasDiscountWarning() {
  return (
    <div className="border-destructive/50 rounded-lg border px-4 py-3">
      <div className="text-destructive flex items-center gap-2">
        <CircleAlert className="h-4 w-4" />
        <span className="font-medium">Warning</span>
      </div>
      <p className="text-destructive mt-1 text-sm">
        A merchant can only have one active discount at a time.
      </p>
    </div>
  );
}
