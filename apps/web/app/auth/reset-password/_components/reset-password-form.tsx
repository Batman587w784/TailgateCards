'use client';

import { useCallback, useState, useTransition } from 'react';

import { useRouter, useSearchParams } from 'next/navigation';

import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@kit/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@kit/ui/form';
import { Heading } from '@kit/ui/heading';
import { If } from '@kit/ui/if';
import { Input } from '@kit/ui/input';
import { Spinner } from '@kit/ui/spinner';

import pathsConfig from '~/config/paths.config';

import { resetPasswordWithTokenAction } from '../../password-reset/_lib/server/password-reset-actions';

const NewPasswordSchema = z
  .object({
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z
      .string()
      .min(8, 'Password must be at least 8 characters'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const router = useRouter();

  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const form = useForm<z.infer<typeof NewPasswordSchema>>({
    resolver: zodResolver(NewPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  const handleSubmit = useCallback(
    (data: z.infer<typeof NewPasswordSchema>) => {
      if (!token) {
        setError('Invalid reset link. Please request a new password reset.');
        return;
      }

      setError(null);
      startTransition(async () => {
        try {
          const result = await resetPasswordWithTokenAction({
            token,
            newPassword: data.password,
          });

          if (!result.success) {
            setError(result.error ?? 'Failed to reset password');
            return;
          }

          setSuccess(true);
        } catch {
          setError('An unexpected error occurred. Please try again.');
        }
      });
    },
    [token],
  );

  const handleSignIn = useCallback(() => {
    router.push(pathsConfig.auth.signIn);
  }, [router]);

  // No token provided
  if (!token) {
    return (
      <div className="flex w-full flex-col gap-6">
        <div className="flex flex-col items-center gap-2">
          <Heading level={4} className="tracking-tight">
            Invalid Reset Link
          </Heading>
          <p className="text-muted-foreground text-center text-sm">
            This password reset link is invalid or has expired. Please request a
            new password reset.
          </p>
        </div>

        <Button
          onClick={() => router.push(pathsConfig.auth.passwordReset)}
          className="bg-brand text-brand-foreground hover:bg-brand-400 w-full"
        >
          Request Password Reset
        </Button>
      </div>
    );
  }

  // Success state
  if (success) {
    return (
      <div className="flex w-full flex-col gap-6">
        <div className="flex flex-col items-center gap-2">
          <Heading level={4} className="tracking-tight">
            Password Reset Successfully
          </Heading>
          <p className="text-muted-foreground text-center text-sm">
            Your password has been updated. You can now sign in with your new
            password.
          </p>
        </div>

        <Button
          onClick={handleSignIn}
          className="bg-brand text-brand-foreground hover:bg-brand-400 w-full"
        >
          Sign In
        </Button>
      </div>
    );
  }

  // Password form
  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex flex-col items-center gap-2">
        <Heading level={4} className="tracking-tight">
          Create a New Password
        </Heading>
        <p className="text-muted-foreground text-center text-sm">
          Enter your new password below.
        </p>
      </div>

      <Form {...form}>
        <form
          className="flex flex-col gap-4"
          onSubmit={form.handleSubmit(handleSubmit)}
        >
          <If condition={Boolean(error)}>
            <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
              {error}
            </div>
          </If>

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter your new password"
                      autoComplete="new-password"
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
                <p className="text-muted-foreground text-xs">
                  Must be at least 8 characters
                </p>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Confirm Password</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder="Confirm your new password"
                      autoComplete="new-password"
                      className="pr-10"
                      {...field}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute top-0 right-0 h-full px-3 hover:bg-transparent"
                      onClick={() =>
                        setShowConfirmPassword(!showConfirmPassword)
                      }
                    >
                      <If
                        condition={showConfirmPassword}
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

          <Button
            type="submit"
            className="bg-brand text-brand-foreground hover:bg-brand-400 w-full"
            disabled={isPending}
          >
            <If condition={isPending} fallback="Reset Password">
              <Spinner className="mr-2 h-4 w-4" />
              Resetting...
            </If>
          </Button>
        </form>
      </Form>
    </div>
  );
}
