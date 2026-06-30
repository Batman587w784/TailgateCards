import { Button } from '@react-email/components';

export function CtaButton(
  props: React.PropsWithChildren<{
    href: string;
  }>,
) {
  return (
    <Button
      className="rounded-md bg-[#0018a9] px-[24px] py-[12px] text-[16px] font-semibold text-white no-underline"
      href={props.href}
    >
      {props.children}
    </Button>
  );
}
