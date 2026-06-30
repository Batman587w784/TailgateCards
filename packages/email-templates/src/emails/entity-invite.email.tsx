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

type EntityType = 'organization' | 'merchant' | 'distributor';

interface Props {
  email: string;
  entityType: EntityType;
  entityName: string;
  inviteLink: string;
  siteUrl: string;
  productName?: string;
}

interface EntityContent {
  subject: (entityName: string, productName: string) => string;
  heading: string;
  bodyPrefix: (productName: string) => string;
  bodySuffix: (productName: string) => string;
  showEntityName: boolean;
  cta: string;
  footerReason: string;
}

const ENTITY_CONTENT: Record<EntityType, EntityContent> = {
  organization: {
    subject: (entityName, productName) =>
      `You're invited to manage ${entityName} on ${productName}`,
    heading: 'Welcome, Organization Admin!',
    bodyPrefix: () => 'You have been invited to manage',
    bodySuffix: (productName) =>
      `as an Organization Admin on ${productName}. Accept the invitation below to set up your password and access your dashboard.`,
    showEntityName: true,
    cta: 'Accept Invitation',
    footerReason:
      "You're receiving this because you were invited as an organization admin.",
  },
  merchant: {
    subject: (entityName, productName) =>
      `Set up your ${entityName} merchant account on ${productName}`,
    heading: 'Welcome, Merchant Partner!',
    bodyPrefix: () => 'Your merchant account for',
    bodySuffix: (productName) =>
      `is ready on ${productName}. Accept the invitation below to set up your password and start managing your business profile and offers.`,
    showEntityName: true,
    cta: 'Set Up My Account',
    footerReason:
      "You're receiving this because a merchant account was created for your business.",
  },
  distributor: {
    subject: (_entityName, productName) =>
      `You're invited as a distributor on ${productName}`,
    heading: "You're Invited!",
    bodyPrefix: (productName) =>
      `You have been invited to join ${productName} as a card distributor. Accept the invitation below to set up your password and get started.`,
    bodySuffix: () => '',
    showEntityName: false,
    cta: 'Accept Invitation',
    footerReason:
      "You're receiving this because you were invited as a card distributor.",
  },
};

export async function renderEntityInviteEmail(props: Props) {
  const productName = props.productName ?? 'Tailgate';
  const content = ENTITY_CONTENT[props.entityType];

  const subject = content.subject(props.entityName, productName);
  const previewText = subject;

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

            <EmailHeading>{content.heading}</EmailHeading>

            <EmailContent>
              <Text className="text-[16px] leading-[24px] text-[#242424]">
                Hi there,
              </Text>

              <Text className="text-[16px] leading-[24px] text-[#242424]">
                {content.bodyPrefix(productName)}
                {content.showEntityName && (
                  <>
                    {' '}
                    <strong>{props.entityName}</strong>{' '}
                  </>
                )}
                {content.bodySuffix(productName)}
              </Text>

              <Text className="text-[14px] leading-[20px] text-[#6b7280]">
                This invitation will expire in 7 days.
              </Text>

              <Section className="mt-[32px] mb-[32px]">
                <CtaButton href={props.inviteLink}>{content.cta}</CtaButton>
              </Section>

              <Text className="text-[16px] leading-[24px] text-[#242424]">
                Or copy and paste this link into your browser:{' '}
                <Link
                  href={props.inviteLink}
                  className="text-blue-600 no-underline"
                >
                  {props.inviteLink}
                </Link>
              </Text>

              <Hr className="mx-0 my-[26px] w-full border border-solid border-[#eaeaea]" />

              <Text className="text-[12px] leading-[24px] text-[#666666]">
                This email was sent to {props.email}. If you did not expect this
                invitation, you can safely ignore this email.
              </Text>
            </EmailContent>

            <EmailFooter
              reasonText={content.footerReason}
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
