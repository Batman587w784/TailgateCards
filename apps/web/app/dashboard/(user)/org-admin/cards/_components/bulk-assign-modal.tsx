'use client';

import { useState, useTransition } from 'react';

import { isRedirectError } from 'next/dist/client/components/redirect-error';

import { zodResolver } from '@hookform/resolvers/zod';
import { CreditCard, LibraryBig, WalletCards, X } from 'lucide-react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@kit/ui/alert-dialog';
import { Button } from '@kit/ui/button';
import { Card, CardContent } from '@kit/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
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
import { Separator } from '@kit/ui/separator';
import { toast } from '@kit/ui/sonner';
import { Spinner } from '@kit/ui/spinner';

import type { DistributorOption } from '../_lib/server/cards-page.loader';
import { bulkAssignCardsByCountAction } from '../_lib/server/cards-server-actions';

const AssignmentSchema = z.object({
  amount: z.coerce
    .number()
    .int('Amount must be a whole number')
    .positive('Amount must be at least 1'),
  distributorId: z.string().min(1, 'Please select a distributor'),
});

const BulkAssignFormSchema = z.object({
  assignments: z.array(AssignmentSchema).min(1),
});

type BulkAssignFormValues = z.infer<typeof BulkAssignFormSchema>;

interface BulkAssignModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  distributors: DistributorOption[];
  unassignedCardCount: number;
}

export function BulkAssignModal({
  open,
  onOpenChange,
  distributors,
  unassignedCardCount,
}: BulkAssignModalProps) {
  const [isPending, startTransition] = useTransition();
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [pendingAssignments, setPendingAssignments] =
    useState<BulkAssignFormValues | null>(null);

  const form = useForm<BulkAssignFormValues>({
    resolver: zodResolver(BulkAssignFormSchema),
    defaultValues: {
      assignments: [{ amount: 1, distributorId: '' }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'assignments',
  });

  const watchedAssignments = useWatch({
    control: form.control,
    name: 'assignments',
  });

  const totalAssignedAmount = (watchedAssignments ?? []).reduce(
    (sum, assignment) => sum + (Number(assignment?.amount) || 0),
    0,
  );

  const cardsAfterAssignment = Math.max(
    0,
    unassignedCardCount - totalAssignedAmount,
  );

  const onSubmit = (values: BulkAssignFormValues) => {
    if (totalAssignedAmount > unassignedCardCount) {
      toast.error(
        `Total amount (${totalAssignedAmount}) exceeds available cards (${unassignedCardCount})`,
      );
      return;
    }

    setPendingAssignments(values);
    setShowConfirmation(true);
  };

  const handleConfirmedSubmit = () => {
    if (!pendingAssignments) return;

    startTransition(async () => {
      try {
        let totalAssigned = 0;

        for (const assignment of pendingAssignments.assignments) {
          const result = await bulkAssignCardsByCountAction({
            distributorId: assignment.distributorId,
            count: assignment.amount,
          });

          if (result.success) {
            totalAssigned += result.assignedCount;
          }
        }

        toast.success(
          `${totalAssigned} card${totalAssigned === 1 ? '' : 's'} assigned successfully`,
        );
        form.reset();
        setShowConfirmation(false);
        setPendingAssignments(null);
        onOpenChange(false);
      } catch (error) {
        if (isRedirectError(error)) {
          throw error;
        }
        toast.error(
          error instanceof Error ? error.message : 'Failed to assign cards',
        );
      }
    });
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      form.reset();
      setShowConfirmation(false);
      setPendingAssignments(null);
    }
    onOpenChange(newOpen);
  };

  const handleAddAssignment = () => {
    append({ amount: 1, distributorId: '' });
  };

  const isFormValid =
    form.formState.isValid &&
    totalAssignedAmount > 0 &&
    totalAssignedAmount <= unassignedCardCount;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">
            Bulk Assign Cards
          </DialogTitle>
          <DialogDescription>
            Quickly assign inactive cards to distributors in bulk.
          </DialogDescription>
        </DialogHeader>

        <Card className="mt-4">
          <CardContent className="pt-6">
            {/* Stats Row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <CreditCard className="text-muted-foreground h-4 w-4" />
                <span className="text-muted-foreground text-xs">
                  Inactive cards available: {unassignedCardCount}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <WalletCards className="text-muted-foreground h-4 w-4" />
                <span className="text-muted-foreground text-xs">
                  Inactive cards after the assignment: {cardsAfterAssignment}
                </span>
              </div>
            </div>

            <Separator className="my-4" />

            {/* Form Section */}
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-4"
              >
                {fields.map((field, index) => (
                  <div
                    key={field.id}
                    className="grid grid-cols-2 items-start gap-4"
                  >
                    <FormField
                      control={form.control}
                      name={`assignments.${index}.amount`}
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input
                              type="number"
                              min={1}
                              max={unassignedCardCount}
                              placeholder="Enter amount"
                              {...field}
                              data-test={`bulk-assign-amount-input-${index}`}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex items-start gap-2">
                      <FormField
                        control={form.control}
                        name={`assignments.${index}.distributorId`}
                        render={({ field }) => (
                          <FormItem className="flex-1">
                            <Select
                              onValueChange={field.onChange}
                              value={field.value}
                            >
                              <FormControl>
                                <SelectTrigger
                                  data-test={`bulk-assign-distributor-select-${index}`}
                                >
                                  <SelectValue placeholder="Select distributor" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {distributors.length === 0 ? (
                                  <SelectItem value="none" disabled>
                                    No distributors available
                                  </SelectItem>
                                ) : (
                                  distributors.map((distributor) => (
                                    <SelectItem
                                      key={distributor.id}
                                      value={distributor.id}
                                    >
                                      {distributor.name}
                                    </SelectItem>
                                  ))
                                )}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {fields.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-destructive h-10 w-10 shrink-0"
                          onClick={() => remove(index)}
                          data-test={`bulk-assign-remove-row-${index}`}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}

                <Separator />

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                  onClick={handleAddAssignment}
                  data-test="bulk-assign-add-row-button"
                >
                  <LibraryBig className="mr-2 h-4 w-4" />
                  Make another assignment
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        <DialogFooter className="mt-6">
          <Button
            type="button"
            className="bg-brand-400 hover:bg-brand-500 w-full"
            size="lg"
            disabled={!isFormValid || isPending || distributors.length === 0}
            onClick={form.handleSubmit(onSubmit)}
            data-test="bulk-assign-confirm-button"
          >
            {isPending ? (
              <Spinner className="mr-2 h-4 w-4" />
            ) : (
              <LibraryBig className="mr-2 h-4 w-4" />
            )}
            Confirm Assignment
          </Button>
        </DialogFooter>

        <AlertDialog open={showConfirmation} onOpenChange={setShowConfirmation}>
          <AlertDialogContent data-test="bulk-assign-confirm-dialog">
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Card Assignment</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-2">
                  <p>
                    You are about to assign{' '}
                    <strong>
                      {totalAssignedAmount} card
                      {totalAssignedAmount === 1 ? '' : 's'}
                    </strong>
                    :
                  </p>
                  <ul className="list-disc space-y-1 pl-4">
                    {pendingAssignments?.assignments.map((assignment, idx) => {
                      const distributor = distributors.find(
                        (d) => d.id === assignment.distributorId,
                      );
                      return (
                        <li key={idx}>
                          <strong>{assignment.amount}</strong> card
                          {assignment.amount === 1 ? '' : 's'} to{' '}
                          <strong>{distributor?.name}</strong>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmedSubmit}
                disabled={isPending}
                className="bg-brand-400 hover:bg-brand-500"
                data-test="bulk-assign-confirm-dialog-action"
              >
                {isPending ? (
                  <>
                    <Spinner className="mr-2 h-4 w-4" />
                    Assigning...
                  </>
                ) : (
                  'Confirm'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}
