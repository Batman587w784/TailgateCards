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
import { initializeEmailI18n } from '../lib/i18n';

interface Props {
  teamName: string;
  teamLogo?: string;
  inviter: string | undefined;
  invitedUserEmail: string;
  link: string;
  productName: string;
  siteUrl: string;
  language?: string;
}

export async function renderInviteEmail(props: Props) {
  const namespace = 'invite-email';

  const { t } = await initializeEmailI18n({
    language: props.language,
    namespace,
  });

  const subject = t(`${namespace}:subject`);
  const previewText = t(`${namespace}:previewText`);

  const html = await render(
    <Html>
      <Head>
        <BodyStyle />
      </Head>

      <Preview>{previewText}</Preview>

      <Tailwind>
        <Body>
          <EmailWrapper>
            <EmailHeader
              siteUrl={props.siteUrl}
              productName={props.productName}
            />
            <EmailHeading>{t(`${namespace}:heading`)}</EmailHeading>

            <EmailContent>
              <Text className="text-[16px] leading-[24px] text-[#242424]">
                {t(`${namespace}:greeting`)}
              </Text>

              <Text
                className="text-[16px] leading-[24px] text-[#242424]"
                dangerouslySetInnerHTML={{
                  __html: t(`${namespace}:mainText`, {
                    inviter: props.inviter,
                    teamName: props.teamName,
                    productName: props.productName,
                  }),
                }}
              />

              <Text className="text-[14px] leading-[20px] text-[#6b7280]">
                {t(`${namespace}:expiry`)}
              </Text>

              <Section className="mt-[24px] mb-[24px]">
                <CtaButton href={props.link}>{t(`${namespace}:cta`)}</CtaButton>
              </Section>

              <Hr className="mx-0 my-[26px] w-full border border-solid border-[#eaeaea]" />
              <Text className="text-center text-[12px] leading-[20px] text-[#9ca3af]">
                {t(`${namespace}:footerReason`)} Don&apos;t want to receive
                these emails?{' '}
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
