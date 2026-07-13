'use client';

import { useState } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';

import { useSignInWithOtp } from '@kit/supabase/hooks/use-sign-in-with-otp';
import { useSupabase } from '@kit/supabase/hooks/use-supabase';
import { useVerifyOtp } from '@kit/supabase/hooks/use-verify-otp';
import { Alert, AlertDescription } from '@kit/ui/alert';
import { Button } from '@kit/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@kit/ui/card';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@kit/ui/form';
import { If } from '@kit/ui/if';
import { Input } from '@kit/ui/input';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@kit/ui/input-otp';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { Spinner } from '@kit/ui/spinner';

import pathsConfig from '~/config/paths.config';
import {
  DEFAULT_NAMING_PRESET,
  getHierarchyLabels,
  type NamingPreset,
} from '~/lib/naming';

import {
  JoinContactSchema,
  type JoinContactFormData,
  JoinGeneralSchema,
  type JoinGeneralFormData,
  normalizePhoneE164,
} from '../_lib/join-start.schema';

type Step =
  | 'campus-question'
  | 'pick-campus'
  | 'pick-chapter'
  | 'contact'
  | 'general-contact'
  | 'verify'
  | 'done';

type Flow = 'campus' | 'general';

interface Selection {
  districtId: string;
  districtName: string;
  namingPreset: NamingPreset;
  orgId: string;
  orgName: string;
  name: string;
  phone: string;
  email: string;
}

const EMPTY: Selection = {
  districtId: '',
  districtName: '',
  namingPreset: DEFAULT_NAMING_PRESET,
  orgId: '',
  orgName: '',
  name: '',
  phone: '',
  email: '',
};

function codeError(err: unknown): string {
  return typeof err === 'string'
    ? err
    : 'Could not send your code. Check the number and try again.';
}

export function JoinStartFlow() {
  const supabase = useSupabase();
  const router = useRouter();

  const [step, setStep] = useState<Step>('campus-question');
  const [flow, setFlow] = useState<Flow>('campus');
  const [selection, setSelection] = useState<Selection>(EMPTY);
  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);

  const signInWithOtp = useSignInWithOtp();
  const verifyOtp = useVerifyOtp();

  const labels = getHierarchyLabels(selection.namingPreset);

  // --- Data: active campuses (districts) ---
  const districtsQuery = useQuery({
    queryKey: ['join-districts'],
    enabled: step === 'pick-campus',
    queryFn: async () => {
      const { data, error: rpcError } = await supabase.rpc(
        'list_active_districts',
      );

      if (rpcError) throw rpcError;

      return data ?? [];
    },
  });

  // --- Data: active chapters (orgs) in the selected campus ---
  const orgsQuery = useQuery({
    queryKey: ['join-orgs', selection.districtId],
    enabled: step === 'pick-chapter' && Boolean(selection.districtId),
    queryFn: async () => {
      const { data, error: rpcError } = await supabase.rpc(
        'list_active_district_orgs',
        { p_district_id: selection.districtId },
      );

      if (rpcError) throw rpcError;

      return data ?? [];
    },
  });

  const contactForm = useForm<JoinContactFormData>({
    resolver: zodResolver(JoinContactSchema),
    defaultValues: { phone: '', email: '' },
  });

  const generalForm = useForm<JoinGeneralFormData>({
    resolver: zodResolver(JoinGeneralSchema),
    defaultValues: { name: '', phone: '', email: '' },
  });

  const sendCode = async (phone: string) => {
    await signInWithOtp.mutateAsync({ phone });
    setStep('verify');
  };

  // --- Step: campus contact -> send OTP ---
  const onContactSubmit = async (values: JoinContactFormData) => {
    setError(null);
    const phone = normalizePhoneE164(values.phone);

    try {
      setSelection((prev) => ({ ...prev, phone, email: values.email ?? '' }));
      await sendCode(phone);
    } catch (err) {
      setError(codeError(err));
    }
  };

  // --- Step: general (no campus) contact -> send OTP ---
  const onGeneralSubmit = async (values: JoinGeneralFormData) => {
    setError(null);
    const phone = normalizePhoneE164(values.phone);

    try {
      setSelection((prev) => ({
        ...prev,
        phone,
        name: values.name,
        email: values.email ?? '',
      }));
      await sendCode(phone);
    } catch (err) {
      setError(codeError(err));
    }
  };

  // --- Step: verify OTP -> register (member or general) ---
  const onVerify = async () => {
    setError(null);

    try {
      await verifyOtp.mutateAsync({
        phone: selection.phone,
        token: otp,
        type: 'sms',
      });

      const { error: registerError } =
        flow === 'general'
          ? await supabase.rpc('register_general_signup', {
              p_name: selection.name,
              p_email: selection.email || undefined,
            })
          : await supabase.rpc('register_member', {
              p_org_account_id: selection.orgId,
              p_phone: selection.phone,
            });

      if (registerError) throw registerError;

      setStep('done');
      router.push(pathsConfig.app.home);
    } catch (err) {
      setError(
        typeof err === 'string'
          ? err
          : 'That code did not work. Please try again.',
      );
    }
  };

  const isSending = signInWithOtp.isPending;
  const isVerifying = verifyOtp.isPending;

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Get Started</CardTitle>
        <CardDescription>
          <If
            condition={step === 'pick-chapter' || step === 'contact'}
            fallback="Join your team and start selling in minutes."
          >
            Joining {selection.districtName}
          </If>
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <If condition={error}>
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </If>

        {/* Step 1 — Are you on a campus? */}
        <If condition={step === 'campus-question'}>
          <div className="flex flex-col gap-3">
            <p className="text-sm font-medium">Are you on a campus?</p>
            <div className="flex gap-3">
              <Button
                className="flex-1"
                onClick={() => {
                  setFlow('campus');
                  setStep('pick-campus');
                }}
                data-test="join-campus-yes"
              >
                Yes
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setFlow('general');
                  setStep('general-contact');
                }}
                data-test="join-campus-no"
              >
                No
              </Button>
            </div>
            <p className="text-muted-foreground text-xs">
              Choose your campus and chapter next. If you were sent an invite
              link, use that instead.
            </p>
          </div>
        </If>

        {/* Step 2 — Pick campus */}
        <If condition={step === 'pick-campus'}>
          <div className="flex flex-col gap-3">
            <label className="text-sm font-medium">Select your campus</label>
            <If
              condition={districtsQuery.isLoading}
              fallback={
                <Select
                  value={selection.districtId}
                  onValueChange={(value) => {
                    const d = (districtsQuery.data ?? []).find(
                      (x) => x.id === value,
                    );
                    setSelection((prev) => ({
                      ...prev,
                      districtId: value,
                      districtName: d?.name ?? '',
                      namingPreset:
                        (d?.naming_preset as NamingPreset) ??
                        DEFAULT_NAMING_PRESET,
                      orgId: '',
                      orgName: '',
                    }));
                  }}
                >
                  <SelectTrigger data-test="join-campus-select">
                    <SelectValue placeholder="Choose a campus" />
                  </SelectTrigger>
                  <SelectContent>
                    {(districtsQuery.data ?? []).map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              }
            >
              <Spinner className="h-5 w-5" />
            </If>

            <Button
              disabled={!selection.districtId}
              onClick={() => setStep('pick-chapter')}
            >
              Continue
            </Button>
          </div>
        </If>

        {/* Step 3 — Pick chapter */}
        <If condition={step === 'pick-chapter'}>
          <div className="flex flex-col gap-3">
            <label className="text-sm font-medium">
              Select your {labels.organization.singular.toLowerCase()}
            </label>
            <If
              condition={orgsQuery.isLoading}
              fallback={
                <Select
                  value={selection.orgId}
                  onValueChange={(value) => {
                    const o = (orgsQuery.data ?? []).find(
                      (x) => x.org_account_id === value,
                    );
                    setSelection((prev) => ({
                      ...prev,
                      orgId: value,
                      orgName: o?.organization_name ?? '',
                    }));
                  }}
                >
                  <SelectTrigger data-test="join-chapter-select">
                    <SelectValue
                      placeholder={`Choose a ${labels.organization.singular.toLowerCase()}`}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {(orgsQuery.data ?? []).map((o) => (
                      <SelectItem
                        key={o.org_account_id}
                        value={o.org_account_id}
                      >
                        {o.organization_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              }
            >
              <Spinner className="h-5 w-5" />
            </If>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setStep('pick-campus')}
              >
                Back
              </Button>
              <Button
                className="flex-1"
                disabled={!selection.orgId}
                onClick={() => setStep('contact')}
              >
                Continue
              </Button>
            </div>
          </div>
        </If>

        {/* Step 4 — Contact (phone + optional email) */}
        <If condition={step === 'contact'}>
          <Form {...contactForm}>
            <form
              className="flex flex-col gap-4"
              onSubmit={contactForm.handleSubmit(onContactSubmit)}
            >
              <FormField
                control={contactForm.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone number</FormLabel>
                    <FormControl>
                      <Input
                        type="tel"
                        autoComplete="tel"
                        placeholder="+1 555 555 0100"
                        data-test="join-phone-input"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      We&apos;ll text you a code to confirm it&apos;s you.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={contactForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email (optional)</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        autoComplete="email"
                        placeholder="you@example.com"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep('pick-chapter')}
                >
                  Back
                </Button>
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={isSending}
                  data-test="join-send-code"
                >
                  <If condition={isSending} fallback="Send code">
                    <Spinner className="mr-2 h-4 w-4" />
                    Sending…
                  </If>
                </Button>
              </div>
            </form>
          </Form>
        </If>

        {/* Step 4b — General signup (no campus): name + phone + email */}
        <If condition={step === 'general-contact'}>
          <Form {...generalForm}>
            <form
              className="flex flex-col gap-4"
              onSubmit={generalForm.handleSubmit(onGeneralSubmit)}
            >
              <p className="text-muted-foreground text-sm">
                No problem — sign up and we&apos;ll get you set up.
              </p>

              <FormField
                control={generalForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Your name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Jane Doe"
                        autoComplete="name"
                        data-test="join-general-name"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={generalForm.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone number</FormLabel>
                    <FormControl>
                      <Input
                        type="tel"
                        autoComplete="tel"
                        placeholder="+1 555 555 0100"
                        data-test="join-general-phone"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      We&apos;ll text you a code to confirm it&apos;s you.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={generalForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email (optional)</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        autoComplete="email"
                        placeholder="you@example.com"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep('campus-question')}
                >
                  Back
                </Button>
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={isSending}
                  data-test="join-general-send-code"
                >
                  <If condition={isSending} fallback="Send code">
                    <Spinner className="mr-2 h-4 w-4" />
                    Sending…
                  </If>
                </Button>
              </div>
            </form>
          </Form>
        </If>

        {/* Step 5 — Verify OTP */}
        <If condition={step === 'verify'}>
          <div className="flex flex-col items-center gap-4">
            <p className="text-muted-foreground text-center text-sm">
              Enter the 6-digit code sent to {selection.phone}.
            </p>
            <InputOTP maxLength={6} value={otp} onChange={setOtp}>
              <InputOTPGroup>
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <InputOTPSlot key={i} index={i} />
                ))}
              </InputOTPGroup>
            </InputOTP>

            <Button
              className="w-full"
              disabled={otp.length < 6 || isVerifying}
              onClick={onVerify}
              data-test="join-verify"
            >
              <If
                condition={isVerifying}
                fallback={
                  flow === 'general'
                    ? 'Verify & finish'
                    : `Verify & join ${selection.orgName}`
                }
              >
                <Spinner className="mr-2 h-4 w-4" />
                Verifying…
              </If>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                setStep(flow === 'general' ? 'general-contact' : 'contact')
              }
            >
              Use a different number
            </Button>
          </div>
        </If>

        {/* Step 6 — Done */}
        <If condition={step === 'done'}>
          <div className="flex flex-col items-center gap-3 text-center">
            <p className="text-sm font-medium">
              {flow === 'general'
                ? "You're all set — welcome to Tailgate!"
                : `You're in — welcome to ${selection.orgName}!`}
            </p>
            <Button asChild>
              <Link href={pathsConfig.app.home}>Go to your dashboard</Link>
            </Button>
          </div>
        </If>
      </CardContent>
    </Card>
  );
}
