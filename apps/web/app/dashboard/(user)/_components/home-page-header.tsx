import { PageHeader } from '@kit/ui/page';

export function HomeLayoutPageHeader(
  props: React.PropsWithChildren<{
    title: string | React.ReactNode;
    description: string | React.ReactNode;
    trailing?: React.ReactNode;
  }>,
) {
  return (
    <PageHeader
      className="hidden lg:flex"
      description={props.description}
      trailing={props.trailing}
    >
      {props.children}
    </PageHeader>
  );
}
