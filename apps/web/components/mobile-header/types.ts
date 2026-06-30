export type MobileHeaderLeftVariant = 'logo' | 'back';

export interface MobileHeaderProps {
  /** Controls the left side content - 'logo' shows AppLogo, 'back' shows back button */
  left?: MobileHeaderLeftVariant;

  /** Custom href for the back button (defaults to router.back()) */
  backHref?: string;

  /** Right side content - can be custom ReactNode */
  right?: React.ReactNode;

  /** Additional className for the header container */
  className?: string;
}
