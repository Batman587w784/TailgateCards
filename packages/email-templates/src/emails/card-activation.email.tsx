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
import { EmailFooter } from '../components/footer';
import { EmailHeader } from '../components/header';
import { EmailHeading } from '../components/heading';
import { EmailWrapper } from '../components/wrapper';

interface Props {
  email: string;
  cardCode: string;
  activationLink: string;
  siteUrl: string;
  productName?: string;
}

export async function renderCardActivationEmail(props: Props) {
  const productName = props.productName ?? 'Tailgate';
  const previewText = `Complete your ${productName} card activation`;
  const subject = `Activate Your ${productName} Card`;

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

            <EmailHeading>Your Card is Ready!</EmailHeading>

            <EmailContent>
              <Text className="text-[16px] leading-[24px] text-[#242424]">
                Hi there,
              </Text>

              <Text className="text-[16px] leading-[24px] text-[#242424]">
                Thank you for purchasing your {productName} card! Your payment
                has been received and your card is ready to be activated.
              </Text>

              <Text className="text-[16px] leading-[24px] text-[#242424]">
                Your card code is:{' '}
                <strong className="font-mono">{props.cardCode}</strong>
              </Text>

              <Text className="text-[16px] leading-[24px] text-[#242424]">
                Click the button below to create your account and start enjoying
                exclusive discounts at local businesses.
              </Text>

              <Section className="mt-[32px] mb-[32px]">
                <CtaButton href={props.activationLink}>
                  Activate My Card
                </CtaButton>
              </Section>

              <Text className="text-[16px] leading-[24px] text-[#242424]">
                Or copy and paste this link into your browser:{' '}
                <Link
                  href={props.activationLink}
                  className="text-blue-600 no-underline"
                >
                  {props.activationLink}
                </Link>
              </Text>

              <Hr className="mx-0 my-[26px] w-full border border-solid border-[#eaeaea]" />

              <Text className="text-[12px] leading-[24px] text-[#666666]">
                This email was sent to {props.email}. If you did not purchase a{' '}
                {productName} card, you can safely ignore this email.
              </Text>
            </EmailContent>

            <EmailFooter
              reasonText="You're receiving this because you purchased a card."
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
