import { Container } from '@react-email/components';

export function EmailWrapper(
  props: React.PropsWithChildren<{
    className?: string;
  }>,
) {
  return (
    <Container
      style={{
        backgroundColor: '#f5f5f5',
        margin: 'auto',
        fontFamily: 'sans-serif',
        color: '#242424',
        width: '100%',
      }}
    >
      <Container
        style={{
          maxWidth: '600px',
          backgroundColor: '#f5f5f5',
          margin: 'auto',
        }}
        className={'mx-auto px-[20px] py-[40px] ' + props.className || ''}
      >
        {props.children}
      </Container>
    </Container>
  );
}
