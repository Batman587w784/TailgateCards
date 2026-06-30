import type { Metadata } from 'next';

import { ContactForm } from '~/(standalone)/contact/_components/contact-form';

export const metadata: Metadata = {
  title: 'Contact Us | Tailgate',
  description:
    'Get in touch with the Tailgate team to learn how we can help your organization, merchants, or cardholders.',
};

function ContactPage() {
  return (
    <>
      <div className="mb-8 flex flex-col items-center text-center">
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
          Interested in what Tailgate can do for you?
        </h1>
      </div>

      <div className="mb-8 rounded-xl border bg-[#F4F4F5]/50 p-4">
        <ul className="text-foreground space-y-4 text-sm">
          <li>
            <span className="mb-4 font-medium">For organizations:</span>
            <br />
            Tailgate makes fundraising easier by selling discount cards online,
            helping you track card usage, and monitor earnings.
          </li>
          <li>
            <span className="mb-4 font-medium">For cardholders:</span>
            <br />
            Activate your digital account and browse available discounts at
            local merchants.
          </li>
          <li>
            <span className="mb-4 font-medium">For merchants:</span>
            <br />
            Tailgate helps you drive more daily foot traffic by promoting your
            offers to broader audience while providing you with analytics to
            monitor traction.
          </li>
        </ul>
      </div>

      <div className="mb-6 text-center">
        <p className="text-foreground text-center text-base">
          Leave your info below and our team will reach out to you.
        </p>
        <p className="text-muted-foreground mt-1 text-sm">
          Prefer direct contact?
          <br />
          Please find our details at the bottom of the page.
        </p>
      </div>

      <ContactForm />
    </>
  );
}

export default ContactPage;
