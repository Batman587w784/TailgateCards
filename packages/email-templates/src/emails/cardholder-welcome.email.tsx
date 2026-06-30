import {
  Body,
  Head,
  Html,
  Preview,
  Section,
  Tailwind,
  Text,
  render,
} from '@react-email/components';

import { BodyStyle } from '../components/body-style';
import { EmailContent } from '../components/content';
import { CtaButton } from '../components/cta-button';
import { EmailFooter } from '../components/footer';
import { EmailHeader } from '../components/header';
import { EmailHeading } from '../components/heading';
import { EmailWrapper } from '../components/wrapper';

interface Props {
  email: string;
  cardCode: string;
  siteUrl: string;
  productName?: string;
  temporaryPassword?: string;
}

export async function renderCardholderWelcomeEmail(props: Props) {
  const productName = props.productName ?? 'Tailgate';
  const previewText = props.temporaryPassword
    ? `Welcome to ${productName}! Your card ${props.cardCode} is activated.`
    : `Welcome to ${productName}! Your account is ready.`;
  const subject = props.temporaryPassword
    ? `Your ${productName} card is activated`
    : `Welcome to ${productName}!`;
  const signInUrl = new URL('/auth/sign-in', props.siteUrl).toString();

  const html = await render(
    <Html>
      <Head>
        <BodyStyle />
      </Head>

      <Preview>{previewText}</Preview>

      <Tailwind>
        <Body>
          <EmailWrapper>
            <EmailHeader siteUrl={props.siteUrl} productName={productName} />

            <EmailHeading>Welcome to {productName}!</EmailHeading>

            <EmailContent>
              <Text className="text-[16px] leading-[24px] text-[#242424]">
                Hi there,
              </Text>

              <Text className="text-[16px] leading-[24px] text-[#242424]">
                Your {productName} card <strong>{props.cardCode}</strong> is
                activated. We&apos;re excited to have you on board.
              </Text>

              {props.temporaryPassword ? (
                <>
                  <Text className="text-[16px] leading-[24px] text-[#242424]">
                    Use this temporary password to sign in for the first time —
                    you&apos;ll be prompted to change it once inside:
                  </Text>

                  <Section className="mt-[8px] mb-[16px] rounded-[6px] bg-[#f5f5f5] p-[16px] text-center">
                    <Text className="m-0 font-mono text-[18px] leading-[24px] tracking-[1px] text-[#1e3a5f]">
                      {props.temporaryPassword}
                    </Text>
                  </Section>

                  <Text className="text-[14px] leading-[20px] text-[#666]">
                    Email: {props.email}
                  </Text>
                </>
              ) : (
                <Text className="text-[16px] leading-[24px] text-[#242424]">
                  Click the button below to sign in and explore everything we
                  have to offer.
                </Text>
              )}

              <Text className="text-[16px] leading-[24px] text-[#242424]">
                If you have any questions, our support team is here to help.
              </Text>

              <Section className="mt-[24px] mb-[24px]">
                <CtaButton href={signInUrl}>Sign in</CtaButton>
              </Section>
            </EmailContent>

            <EmailFooter
              reasonText={`You're receiving this email because you created an account on ${productName}.`}
              siteUrl={props.siteUrl}
              productName={productName}
            />
          </EmailWrapper>
        </Body>
      </Tailwind>
    </Html>,
  );

  return {
    html,
    subject,
  };
}
