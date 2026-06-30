import { withI18n } from '~/lib/i18n/with-i18n';

import { CTASection } from './_components/cta-section';
import { GetStartedSteps } from './_components/get-started-steps';
import { HowItWorksSection } from './_components/how-it-works-section';
import { NFCFeaturesSection } from './_components/nfc-features-section';
import { PartnersSection } from './_components/partners-section';
import { TailgateHero } from './_components/tailgate-hero';
import { TestimonialsSection } from './_components/testimonials-section';

function Home() {
  return (
    <div className="flex flex-col">
      <TailgateHero />
      <PartnersSection />
      <HowItWorksSection />
      <GetStartedSteps />
      <NFCFeaturesSection />
      <TestimonialsSection />
      <CTASection />
    </div>
  );
}

export default withI18n(Home);
