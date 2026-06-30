'use client';

import { useCallback, useState, useTransition } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

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
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from '@kit/ui/input-otp';
import { Spinner } from '@kit/ui/spinner';

import pathsConfig from '~/config/paths.config';

import {
  requestPasswordResetAction,
  resetPasswordWithOtpAction,
} from '../_lib/server/password-reset-actions';

type Step = 'email' | 'verify' | 'new-password' | 'success';

const EmailSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

const OtpSchema = z.object({
  otp: z.string().length(6, 'Please enter the 6-digit code'),
});

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

export function TailgatePasswordResetFlow() {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const router = useRouter();

  // Step 1: Email form
  const emailForm = useForm<z.infer<typeof EmailSchema>>({
    resolver: zodResolver(EmailSchema),
    defaultValues: { email: '' },
  });

  // Step 2: OTP form
  const otpForm = useForm<z.infer<typeof OtpSchema>>({
    resolver: zodResolver(OtpSchema),
    defaultValues: { otp: '' },
  });

  // Step 3: New password form
  const passwordForm = useForm<z.infer<typeof NewPasswordSchema>>({
    resolver: zodResolver(NewPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Handle email submission - request OTP via custom action
  const handleEmailSubmit = useCallback((data: z.infer<typeof EmailSchema>) => {
    setError(null);
    startTransition(async () => {
      try {
        const result = await requestPasswordResetAction(data);

        if (!result.success) {
          setError('An unexpected error occurred. Please try again.');
          return;
        }

        setEmail(data.email);
        setStep('verify');
      } catch {
        setError('An unexpected error occurred. Please try again.');
      }
    });
  }, []);

  // Handle OTP entry - store OTP and move to password step
  const handleOtpSubmit = useCallback((data: z.infer<typeof OtpSchema>) => {
    setError(null);
    setOtp(data.otp);
    setStep('new-password');
  }, []);

  // Handle resend OTP
  const handleResend = useCallback(() => {
    setError(null);
    setResendMessage(null);
    startTransition(async () => {
      try {
        const result = await requestPasswordResetAction({ email });

        if (!result.success) {
          setError('Failed to resend code. Please try again.');
          return;
        }

        setResendMessage('Verification code resent!');
        otpForm.reset();
      } catch {
        setError('Failed to resend code. Please try again.');
      }
    });
  }, [email, otpForm]);

  // Handle password update - verify OTP and update password together
  const handlePasswordSubmit = useCallback(
    (data: z.infer<typeof NewPasswordSchema>) => {
      setError(null);
      startTransition(async () => {
        try {
          const result = await resetPasswordWithOtpAction({
            email,
            otp,
            newPassword: data.password,
          });

          if (!result.success) {
            // If OTP verification failed, go back to OTP step
            if (
              result.error?.includes('Invalid') ||
              result.error?.includes('expired')
            ) {
              setError(result.error);
              setStep('verify');
              return;
            }
            setError(result.error ?? 'Failed to update password');
            return;
          }

          setStep('success');
        } catch {
          setError('Failed to update password. Please try again.');
        }
      });
    },
    [email, otp],
  );

  // Handle sign in redirect
  const handleSignIn = useCallback(() => {
    router.push(pathsConfig.auth.signIn);
  }, [router]);

  return (
    <div className="flex w-full flex-col gap-6">
      {/* Step 1: Email Entry */}
      <If condition={step === 'email'}>
        <div className="flex flex-col items-center gap-2">
          <Heading level={4} className="tracking-tight">
            Reset Password
          </Heading>
          <p className="text-muted-foreground text-center text-sm">
            Please enter the email address associated with your account. We will
            send you a reset code.
          </p>
        </div>

        <Form {...emailForm}>
          <form
            className="flex flex-col gap-4"
            onSubmit={emailForm.handleSubmit(handleEmailSubmit)}
          >
            <If condition={Boolean(error)}>
              <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
                {error}
              </div>
            </If>

            <FormField
              control={emailForm.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
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

            <Button
              type="submit"
              className="bg-brand text-brand-foreground hover:bg-brand-400 w-full"
              disabled={isPending}
            >
              <If condition={isPending} fallback="Continue">
                <Spinner className="mr-2 h-4 w-4" />
                Sending...
              </If>
            </Button>
          </form>
        </Form>

        <div className="text-center text-sm">
          <span className="text-muted-foreground">
            Already know your password?{' '}
          </span>
          <Link
            href={pathsConfig.auth.signIn}
            className="text-primary hover:underline"
          >
            Sign in
          </Link>
        </div>
      </If>

      {/* Step 2: OTP Verification */}
      <If condition={step === 'verify'}>
        <div className="flex flex-col items-center gap-2">
          <Heading level={4} className="tracking-tight">
            Reset password request sent.
          </Heading>
          <p className="text-muted-foreground text-center text-sm">
            Please check your email and enter the code to verify.
            <If condition={Boolean(resendMessage)}>
              <span className="text-primary mt-1 block font-medium">
                {resendMessage}
              </span>
            </If>
          </p>
        </div>

        <Form {...otpForm}>
          <form
            className="flex flex-col items-center gap-6"
            onSubmit={otpForm.handleSubmit(handleOtpSubmit)}
          >
            <If condition={Boolean(error)}>
              <div className="bg-destructive/10 text-destructive w-full rounded-md p-3 text-sm">
                {error}
              </div>
            </If>

            <FormField
              control={otpForm.control}
              name="otp"
              render={({ field }) => (
                <FormItem className="flex flex-col items-center">
                  <FormControl>
                    <InputOTP maxLength={6} {...field} disabled={isPending}>
                      <InputOTPGroup>
                        <InputOTPSlot index={0} />
                        <InputOTPSlot index={1} />
                      </InputOTPGroup>
                      <InputOTPSeparator />
                      <InputOTPGroup>
                        <InputOTPSlot index={2} />
                        <InputOTPSlot index={3} />
                      </InputOTPGroup>
                      <InputOTPSeparator />
                      <InputOTPGroup>
                        <InputOTPSlot index={4} />
                        <InputOTPSlot index={5} />
                      </InputOTPGroup>
                    </InputOTP>
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
              Continue
            </Button>
          </form>
        </Form>

        <div className="text-center text-sm">
          <span className="text-muted-foreground">
            Didn&apos;t receive the code?{' '}
          </span>
          <button
            type="button"
            onClick={handleResend}
            disabled={isPending}
            className="text-primary hover:underline disabled:opacity-50"
          >
            Resend
          </button>
        </div>
      </If>

      {/* Step 3: New Password */}
      <If condition={step === 'new-password'}>
        <div className="flex flex-col items-center gap-2">
          <Heading level={4} className="tracking-tight">
            Create a new password
          </Heading>
        </div>

        <Form {...passwordForm}>
          <form
            className="flex flex-col gap-4"
            onSubmit={passwordForm.handleSubmit(handlePasswordSubmit)}
          >
            <If condition={Boolean(error)}>
              <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
                {error}
              </div>
            </If>

            <FormField
              control={passwordForm.control}
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
              control={passwordForm.control}
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
      </If>

      {/* Step 4: Success */}
      <If condition={step === 'success'}>
        <div className="flex flex-col items-center gap-2">
          <Heading level={4} className="tracking-tight">
            Successfully reset password
          </Heading>
          <p className="text-muted-foreground text-center text-sm">
            Your password has been updated. You can now log in with your new
            password.
          </p>
        </div>

        <Button
          onClick={handleSignIn}
          className="bg-brand text-brand-foreground hover:bg-brand-400 w-full"
        >
          Sign In
        </Button>
      </If>
    </div>
  );
}
