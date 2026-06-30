'use client';

import { useState } from 'react';

import { Plus } from 'lucide-react';

import { Button } from '@kit/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@kit/ui/dialog';
import { cn } from '@kit/ui/utils';

interface EntityFormModalProps {
  title: string;
  description?: React.ReactNode;
  triggerLabel: string;
  children: (props: { onSuccess: () => void }) => React.ReactNode;
  className?: string;
}

export function EntityFormModal({
  title,
  description,
  triggerLabel,
  children,
  className,
}: EntityFormModalProps) {
  const [open, setOpen] = useState(false);

  const handleSuccess = () => {
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          data-test="add-entity-button"
          className={cn(
            'bg-brand-400 text-brand-foreground hover:bg-brand-400/90 w-full sm:w-auto',
            className,
          )}
        >
          <Plus className="mr-2 h-4 w-4" />
          {triggerLabel}
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {children({ onSuccess: handleSuccess })}
      </DialogContent>
    </Dialog>
  );
}
