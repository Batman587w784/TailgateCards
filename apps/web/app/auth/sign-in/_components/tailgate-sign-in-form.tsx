'use client';

import { useCallback, useState, useTransition } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff } from 'lucide-react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';

import { PasswordSignInSchema } from '@kit/auth/sign-in';
import { useSignInWithEmailPassword } from '@kit/supabase/hooks/use-sign-in-with-email-password';
import { Button } from '@kit/ui/button';
import { Checkbox } from '@kit/ui/checkbox';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@kit/ui/form';
import { If } from '@kit/ui/if';
import { Input } from '@kit/ui/input';
import { Spinner } from '@kit/ui/spinner';

import pathsConfig from '~/config/paths.config';

export function TailgateSignInForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const signInMutation = useSignInWithEmailPassword();

  const form = useForm<z.infer<typeof PasswordSignInSchema>>({
    resolver: zodResolver(PasswordSignInSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = useCallback(
    (credentials: z.infer<typeof PasswordSignInSchema>) => {
      startTransition(async () => {
        try {
          await signInMutation.mutateAsync(credentials);
          router.push(pathsConfig.app.home);
        } catch {
          // Error handled by mutation
        }
      });
    },
    [signInMutation, router],
  );

  const isLoading = signInMutation.isPending || isPending;

  return (
    <Form {...form}>
      <form
        className="flex w-full flex-col gap-y-4"
        onSubmit={form.handleSubmit(onSubmit)}
      >
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input
                  data-test="email-input"
                  type="email"
                  placeholder="Enter your email"
                  autoComplete="email"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-center justify-between">
                <FormLabel>Password</FormLabel>
                <Link
                  href={pathsConfig.auth.passwordReset}
                  className="text-muted-foreground hover:text-primary text-sm hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <FormControl>
                <div className="relative">
                  <Input
                    data-test="password-input"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    className="pr-10"
                    {...field}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute top-0 right-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    <If
                      condition={showPassword}
                      fallback={<Eye className="h-4 w-4" />}
                    >
                      <EyeOff className="h-4 w-4" />
                    </If>
                  </Button>
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex items-center space-x-2">
          <Checkbox id="keep-signed-in" />
          <label
            htmlFor="keep-signed-in"
            className="text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            Keep me signed in
          </label>
        </div>

        <If condition={signInMutation.error}>
          <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
            Invalid email or password. Please try again.
          </div>
        </If>

        <Button
          data-test="auth-submit-button"
          type="submit"
          className="bg-brand text-brand-foreground hover:bg-brand-400 w-full"
          disabled={isLoading}
        >
          <If condition={isLoading} fallback="Sign In">
            <Spinner className="mr-2 h-4 w-4" />
            Signing in...
          </If>
        </Button>
      </form>
    </Form>
  );
}
