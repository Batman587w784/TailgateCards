import { Heading } from '@react-email/components';

export function EmailHeading(props: React.PropsWithChildren) {
  return (
    <Heading className="mx-0 p-0 font-sans text-[24px] font-semibold text-[#0018a9]">
      {props.children}
    </Heading>
  );
}
