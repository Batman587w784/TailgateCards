'use client';

import { useState, useTransition } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Alert, AlertDescription, AlertTitle } from '@kit/ui/alert';
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
import { Textarea } from '@kit/ui/textarea';

import { ContactFormSchema } from '~/(standalone)/contact/_lib/contact-email.schema';
import { sendContactEmail } from '~/(standalone)/contact/_lib/server/server-actions';
import { PhoneInputWithCountry } from '~/activate/_components/phone-input-with-country';

type ContactFormValues = z.infer<typeof ContactFormSchema>;

export function ContactForm() {
  const [pending, startTransition] = useTransition();

  const [state, setState] = useState({
    success: false,
    error: false,
  });

  const form = useForm<ContactFormValues>({
    resolver: zodResolver(ContactFormSchema),
    defaultValues: {
      role: undefined,
      fullName: '',
      email: '',
      phone: '',
      companyName: '',
      message: '',
    },
  });

  if (state.success) {
    return <SuccessAlert />;
  }

  if (state.error) {
    return <ErrorAlert />;
  }

  return (
    <Form {...form}>
      <form
        className={'flex flex-col space-y-4'}
        data-test="contact-form"
        onSubmit={form.handleSubmit((data) => {
          startTransition(async () => {
            try {
              await sendContactEmail(data);
              setState({ success: true, error: false });
            } catch {
              setState({ error: true, success: false });
            }
          });
        })}
      >
        <FormField
          control={form.control}
          name="role"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="font-normal">I&apos;m a...</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger data-test="contact-role-select">
                    <SelectValue placeholder="Select your role" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="organization">Organization</SelectItem>
                  <SelectItem value="merchant">Merchant</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="fullName"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="font-normal">Full Name</FormLabel>
              <FormControl>
                <Input
                  placeholder="Enter your full name"
                  maxLength={200}
                  data-test="contact-full-name"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="font-normal">Email</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  placeholder="Enter your email"
                  data-test="contact-email"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="font-normal">Phone Number</FormLabel>
              <FormControl>
                <PhoneInputWithCountry data-test="contact-phone" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="companyName"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="font-normal">Company Name</FormLabel>
              <FormControl>
                <Input
                  placeholder="Enter your company name"
                  maxLength={200}
                  data-test="contact-company"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="message"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="font-normal">
                Please tell us more about what you&apos;re looking for
              </FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Please tell us more about what you're looking for..."
                  rows={6}
                  maxLength={5000}
                  data-test="contact-message"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button
          disabled={pending}
          type="submit"
          className="bg-brand text-brand-foreground hover:bg-brand/90 w-full"
          data-test="contact-submit"
        >
          {pending ? 'Submitting...' : 'Submit'}
        </Button>
      </form>
    </Form>
  );
}

function SuccessAlert() {
  return (
    <Alert variant="success">
      <AlertTitle>Message sent!</AlertTitle>
      <AlertDescription>
        Thank you for reaching out. We&apos;ll get back to you shortly.
      </AlertDescription>
    </Alert>
  );
}

function ErrorAlert() {
  return (
    <Alert variant="destructive">
      <AlertTitle>Something went wrong</AlertTitle>
      <AlertDescription>
        We couldn&apos;t send your message. Please try again later.
      </AlertDescription>
    </Alert>
  );
}
