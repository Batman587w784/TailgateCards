import {
  Column,
  Container,
  Hr,
  Img,
  Row,
  Section,
  Text,
} from '@react-email/components';

import { getLogoUrl } from '../lib/email-config';

interface EmailHeaderProps {
  siteUrl: string;
  productName?: string;
}

export function EmailHeader({
  siteUrl,
  productName = 'Tailgate',
}: EmailHeaderProps) {
  return (
    <Container>
      <Section style={{ paddingBottom: '16px' }}>
        <Row>
          <Column style={{ width: '42px', verticalAlign: 'middle' }}>
            <Img
              src={getLogoUrl(siteUrl)}
              width="36"
              height="36"
              alt={productName}
              style={{ borderRadius: '6px' }}
            />
          </Column>
          <Column style={{ verticalAlign: 'middle' }}>
            <Text
              style={{
                margin: '0',
                fontSize: '18px',
                fontWeight: 700,
                color: '#1e3a5f',
              }}
            >
              {productName}
            </Text>
          </Column>
        </Row>
      </Section>
      <Hr style={{ borderColor: '#e5e7eb', margin: '0 0 24px 0' }} />
    </Container>
  );
}
