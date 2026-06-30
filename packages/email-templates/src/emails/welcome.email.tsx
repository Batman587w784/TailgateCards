import {
  Body,
  Head,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Tailwind,
  Text,
  render,
} from '@react-email/components';

import { BodyStyle } from '../components/body-style';
import { EmailContent } from '../components/content';
import { CtaButton } from '../components/cta-button';
import { EmailHeader } from '../components/header';
import { EmailHeading } from '../components/heading';
import { EmailWrapper } from '../components/wrapper';

interface Props {
  email: string;
  siteUrl: string;
  loginLink: string;
  productName?: string;
}

export async function renderWelcomeEmail(props: Props) {
  const productName = props.productName ?? 'Tailgate';
  const previewText = `Welcome to ${productName}! Your account is ready.`;
  const subject = `Welcome to ${productName}!`;

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
                Your {productName} account has been created and you&apos;re
                ready to get started. Explore everything we have to offer and
                make the most of your experience.
              </Text>

              <Text className="text-[16px] leading-[24px] text-[#242424]">
                If you ever need help, our support team is here for you.
              </Text>

              <Section className="mt-[24px] mb-[24px]">
                <CtaButton href={props.loginLink}>Get Started</CtaButton>
              </Section>

              <Hr className="mx-0 my-[26px] w-full border border-solid border-[#eaeaea]" />
              <Text className="text-center text-[12px] leading-[20px] text-[#9ca3af]">
                You&apos;re receiving this because you created an account.
                Don&apos;t want to receive these emails?{' '}
                <Link
                  href={`${props.siteUrl}/unsubscribe`}
                  className="text-[#9ca3af] underline"
                >
                  Unsubscribe
                </Link>
              </Text>
            </EmailContent>
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
