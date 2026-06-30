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
  otp: string;
  resetLink: string;
  productName?: string;
  siteUrl?: string;
  expiresInMinutes?: number;
}

export async function renderPasswordResetEmail(props: Props) {
  const productName = props.productName ?? 'Tailgate';
  const siteUrl = props.siteUrl ?? '';
  const expiresInMinutes = props.expiresInMinutes ?? 60;
  const previewText = `Reset your ${productName} password`;
  const subject = `Reset Your ${productName} Password`;

  const html = await render(
    <Html>
      <Head>
        <BodyStyle />
      </Head>

      <Preview>{previewText}</Preview>

      <Tailwind>
        <Body>
          <EmailWrapper>
            <EmailHeader siteUrl={siteUrl} productName={productName} />
            <EmailHeading>Reset Your Password</EmailHeading>

            <EmailContent>
              <Text className="text-[16px] leading-[24px] text-[#242424]">
                Hi there,
              </Text>

              <Text className="text-[16px] leading-[24px] text-[#242424]">
                We received a request to reset your {productName} password. Use
                one of the options below to set a new password. If you
                didn&apos;t request this, you can safely ignore this email.
              </Text>

              {/* OTP Code Section */}
              <Section className="my-[24px] rounded-lg bg-[#f3f4f6] p-[24px] text-center">
                <Text className="m-0 text-[14px] font-medium text-[#6b7280]">
                  Enter this code in the app:
                </Text>
                <Text className="m-0 mt-[12px] font-mono text-[32px] font-semibold tracking-[4px] text-[#242424]">
                  {props.otp}
                </Text>
              </Section>

              {/* Divider with "or" */}
              <Section className="my-[24px]">
                <table
                  align="center"
                  width="100%"
                  cellPadding="0"
                  cellSpacing="0"
                  role="presentation"
                >
                  <tbody>
                    <tr>
                      <td style={{ borderTop: '1px solid #e5e7eb' }}></td>
                      <td
                        style={{
                          padding: '0 16px',
                          color: '#9ca3af',
                          fontSize: '12px',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        or
                      </td>
                      <td style={{ borderTop: '1px solid #e5e7eb' }}></td>
                    </tr>
                  </tbody>
                </table>
              </Section>

              {/* Reset Button */}
              <Section className="mb-[24px]">
                <CtaButton href={props.resetLink}>Reset Password</CtaButton>
              </Section>

              <Hr className="mx-0 my-[26px] w-full border border-solid border-[#eaeaea]" />

              <Text className="text-[12px] leading-[20px] text-[#9ca3af]">
                This link will expire in {expiresInMinutes} minutes.
              </Text>

              <Text className="text-center text-[12px] leading-[20px] text-[#9ca3af]">
                You&apos;re receiving this because a password reset was
                requested for your account. Don&apos;t want to receive these
                emails?{' '}
                <Link
                  href={`${siteUrl}/unsubscribe`}
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
