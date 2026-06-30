import { Container, Link, Text } from '@react-email/components';

interface EmailFooterProps {
  reasonText: string;
  siteUrl: string;
  productName?: string;
}

export function EmailFooter({ reasonText, siteUrl }: EmailFooterProps) {
  return (
    <Container style={{ paddingTop: '24px' }}>
      <Text
        style={{
          textAlign: 'center' as const,
          fontSize: '12px',
          lineHeight: '18px',
          color: '#71717a',
          margin: '0 0 4px 0',
        }}
      >
        {reasonText}
      </Text>

      <Text
        style={{
          textAlign: 'center' as const,
          fontSize: '12px',
          lineHeight: '18px',
          color: '#71717a',
          margin: '0',
        }}
      >
        {"Don't want to receive these emails? "}
        <Link
          href={`${siteUrl}/unsubscribe`}
          style={{ color: '#0018a9', textDecoration: 'none' }}
        >
          Unsubscribe
        </Link>
      </Text>
    </Container>
  );
}
