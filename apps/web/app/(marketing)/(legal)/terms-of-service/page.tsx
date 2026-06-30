import { SitePageHeader } from '~/(marketing)/_components/site-page-header';
import { createI18nServerInstance } from '~/lib/i18n/i18n.server';
import { withI18n } from '~/lib/i18n/with-i18n';

export async function generateMetadata() {
  const { t } = await createI18nServerInstance();

  return {
    title: t('marketing:termsOfService'),
  };
}

async function TermsOfServicePage() {
  const { t } = await createI18nServerInstance();

  return (
    <div>
      <SitePageHeader
        title={t(`marketing:termsOfService`)}
        subtitle={t(`marketing:termsOfServiceDescription`)}
      />

      <div className="container mx-auto max-w-4xl px-4 py-12">
        <article className="max-w-none space-y-16">
          <section className="space-y-4">
            <h2 className="text-center text-2xl font-bold uppercase">
              Tailgate Systems, Inc.
            </h2>

            <h3 className="text-center text-lg font-bold uppercase">
              Cardholder Terms of Service, Data License, Activation Consent, and
              Commercial Data Use Agreement
            </h3>

            <p className="text-muted-foreground leading-7">
              This Cardholder Terms of Service, Data License, Activation
              Consent, and Commercial Data Use Agreement (&quot;Agreement&quot;)
              is a legally binding contract between you, whether as an
              individual, consumer, or end user (&quot;User,&quot;
              &quot;Cardholder,&quot; &quot;you,&quot; or &quot;your&quot;), and
              Tailgate Systems, Inc., a Delaware corporation
              (&quot;Tailgate,&quot; &quot;Company,&quot; &quot;we,&quot;
              &quot;us,&quot; or &quot;our&quot;). This Agreement governs your
              access to, activation of, interaction with, and use of any
              Tailgate-branded physical card, digital card, NFC-enabled card,
              QR-based access mechanism, web interface, mobile interface,
              application, software layer, analytics system, data platform, or
              any related technologies, features, or services now existing or
              later developed (collectively, the &quot;Platform&quot;).
            </p>

            <p className="leading-7 font-bold uppercase">
              By activating a card, tapping an NFC device, scanning a QR code,
              accessing a link, creating an account, redeeming an offer, or
              otherwise interacting with the Platform in any manner, you
              expressly acknowledge, affirm, and consent to all terms of this
              Agreement, including the data collection, data use, data
              commercialization, and data sharing practices described herein.
            </p>

            <p className="text-muted-foreground leading-7">
              If you do not agree, you must not activate, access, or use the
              Platform.
            </p>

            <p className="text-muted-foreground leading-7">
              This Agreement is effective immediately upon your first
              interaction with the Platform and remains effective unless
              terminated in accordance with this Agreement.
            </p>
          </section>

          <section className="space-y-4">
            <h3 className="text-xl font-semibold">
              1. Continuous Acceptance, Activation Consent, and Scope
            </h3>

            <p className="text-muted-foreground leading-7">
              Your activation of any Tailgate card or interaction with the
              Platform constitutes your express, informed, and affirmative
              consent to this Agreement. Consent is not a one-time event. Each
              subsequent interaction with the Platform constitutes renewed
              consent to all terms in effect at that time.
            </p>

            <p className="text-muted-foreground leading-7">
              You acknowledge and agree that activation consent may be obtained
              through multiple mechanisms, including but not limited to card
              activation flows, NFC taps, QR scans, browser prompts, in-app
              disclosures, splash screens, linked notices, or continued use
              following notice. You agree that such mechanisms constitute valid
              legal consent to the fullest extent permitted by law.
            </p>

            <p className="text-muted-foreground leading-7">
              This Agreement applies nationwide throughout the United States and
              is governed exclusively by the laws of the State of Delaware,
              without regard to conflict-of-laws principles.
            </p>
          </section>

          <section className="space-y-4">
            <h3 className="text-xl font-semibold">
              2. Eligibility, Authority, and Representations
            </h3>

            <p className="text-muted-foreground leading-7">
              You represent that you are at least eighteen (18) years of age or
              the age of majority in your jurisdiction, whichever is greater,
              and that you possess the legal capacity to enter into this
              Agreement. You further represent that all information you provide
              or permit to be collected is accurate to the best of your
              knowledge.
            </p>

            <p className="text-muted-foreground leading-7">
              If you access the Platform on behalf of another person or entity,
              you represent and warrant that you have full authority to bind
              such person or entity to this Agreement and its data use
              provisions.
            </p>
          </section>

          <section className="space-y-4">
            <h3 className="text-xl font-semibold">
              3. Platform Function, Disclaimers, and No Entitlement
            </h3>

            <p className="text-muted-foreground leading-7">
              The Platform provides access to promotional offers, discounts,
              analytics-driven experiences, and related benefits offered by
              independent third-party merchants, partners, or organizations.
              Tailgate does not control, operate, or guarantee the actions,
              availability, pricing, quality, legality, or continued
              participation of any third party.
            </p>

            <p className="text-muted-foreground leading-7">
              The Platform and any associated card are access mechanisms only.
              They are not bank accounts, stored-value products, prepaid cards,
              or monetary instruments. No offer has cash value. Tailgate makes
              no representations regarding savings, value, or outcomes.
            </p>
          </section>

          <section className="space-y-4">
            <h3 className="text-xl font-semibold">
              4. User Conduct and Platform Control
            </h3>

            <p className="text-muted-foreground leading-7">
              You agree to use the Platform solely for lawful purposes and in
              compliance with this Agreement. You may not resell, sublicense,
              duplicate, scrape, manipulate, exploit, reverse engineer, or
              misuse the Platform or any associated data.
            </p>

            <p className="text-muted-foreground leading-7">
              Tailgate reserves the unrestricted right to monitor usage, detect
              abuse, and suspend or terminate access at any time, with or
              without notice, and without liability.
            </p>
          </section>

          <section className="space-y-4">
            <h3 className="text-xl font-semibold">
              5. Express Data Collection Consent
            </h3>

            <p className="leading-7 font-bold uppercase">
              By activating or using the Platform, you expressly consent to
              Tailgate&apos;s collection, processing, storage, analysis,
              enrichment, and commercial use of data associated with you, your
              devices, your location, and your behavior.
            </p>

            <p className="text-muted-foreground leading-7">
              You acknowledge that data collection may occur actively or
              passively, directly or indirectly, continuously or intermittently,
              including through background processes and third-party
              technologies integrated into the Platform.
            </p>
          </section>

          <section className="space-y-4">
            <h3 className="text-xl font-semibold">
              6. Categories of Data Collected and Generated
            </h3>

            <p className="text-muted-foreground leading-7">
              Data collected or generated may include, without limitation,
              identifiers, contact information, demographic attributes, inferred
              age ranges, gender indicators where provided or inferred,
              educational affiliation, device identifiers, IP addresses, browser
              and operating system data, timestamps, session metadata, NFC and
              QR interaction logs, redemption events, venue visitation patterns,
              dwell time, frequency metrics, transaction-related metadata,
              approximate or precise location data where enabled or permitted,
              behavioral signals, inferred interests, mobility patterns, and
              engagement profiles.
            </p>

            <p className="text-muted-foreground leading-7">
              You acknowledge that certain data may be inferred or derived
              rather than directly provided by you.
            </p>

            <div className="border-border mt-8 space-y-4 border-l-2 pl-6">
              <h4 className="text-lg font-semibold">
                6.1 Data Use Rights, Commercialization, and Redistribution
              </h4>

              <p className="text-muted-foreground leading-7">
                You hereby grant Tailgate Systems, Inc. a worldwide, perpetual,
                irrevocable, royalty-free, fully paid, transferable, and
                sublicensable right and license, to the maximum extent permitted
                by law, to collect, access, store, analyze, modify, adapt,
                aggregate, anonymize, derive, commercialize, sell, license,
                assign, distribute, disclose, transmit, and otherwise exploit
                any and all data associated with you or your use of the
                Platform.
              </p>

              <p className="text-muted-foreground leading-7">
                This grant includes the right to use and redistribute such data,
                whether in identifiable, de-identified, anonymized, aggregated,
                or derived form, to third parties including but not limited to
                advertisers, analytics providers, data partners, merchants,
                affiliates, research entities, and commercial counterparties,
                for purposes including advertising, audience targeting,
                preference modeling, demographic analysis, behavioral
                segmentation, predictive analytics, machine learning, artificial
                intelligence training, market research, and other commercial or
                operational uses.
              </p>

              <p className="text-muted-foreground leading-7">
                You expressly acknowledge and agree that Tailgate may determine,
                at its sole discretion, the manner, format, scope, and
                recipients of any data redistribution or commercialization,
                subject only to applicable law and valid opt-out rights where
                required. You waive any right to inspect, approve, restrict, or
                receive compensation for such uses.
              </p>
            </div>

            <div className="border-border mt-8 space-y-4 border-l-2 pl-6">
              <h4 className="text-lg font-semibold">
                6.2 Sensitive and Demographic Data Consent
              </h4>

              <p className="text-muted-foreground leading-7">
                To the extent permitted by applicable law, you expressly consent
                to the processing, analysis, aggregation, and commercial use of
                demographic and preference-based data, including but not limited
                to gender identity, racial or ethnic identifiers, location
                patterns, affinity indicators, and inferred characteristics,
                whether provided directly by you or lawfully obtained or derived
                through Platform usage or third-party data sources.
              </p>

              <p className="text-muted-foreground leading-7">
                You acknowledge that such data may be used to create audience
                segments, preference profiles, behavioral insights, and
                analytical products that may be sold, licensed, or shared with
                third parties in anonymized, aggregated, or derived form. Where
                required by law, Tailgate will provide opt-out mechanisms or
                honor applicable data limitation rights, but you agree that such
                rights do not apply to aggregated, anonymized, or derived
                datasets.
              </p>
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-xl font-semibold">
              7. Third-Party Data, Enrichment, and Identity Resolution
            </h3>

            <p className="text-muted-foreground leading-7">
              To the maximum extent permitted by applicable law, Tailgate may
              collect, license, receive, purchase, associate, or infer
              additional data relating to you from third-party sources,
              including advertising networks, analytics providers, data brokers,
              attribution partners, identity resolution services, publicly
              available databases, and technology platforms.
            </p>

            <p className="text-muted-foreground leading-7">
              Such data may be used to enrich user profiles, resolve identities
              across devices or contexts, infer preferences, construct
              audiences, and improve targeting, measurement, and monetization
              capabilities.
            </p>

            <div className="border-border mt-8 space-y-4 border-l-2 pl-6">
              <h4 className="text-lg font-semibold">
                7.1 Aggregated, Anonymized, and Derived Data Ownership
              </h4>

              <p className="text-muted-foreground leading-7">
                You acknowledge and agree that all aggregated, anonymized,
                de-identified, and derived data generated through or in
                connection with the Platform is and shall remain the exclusive
                property of Tailgate Systems, Inc. Such data does not constitute
                personal data once anonymized and is not subject to access,
                deletion, correction, or opt-out rights to the extent permitted
                by law.
              </p>

              <p className="text-muted-foreground leading-7">
                These ownership and usage rights survive account deletion,
                termination of access, or cessation of Platform use.
              </p>
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-xl font-semibold">
              8. Data License and Commercial Rights Grant
            </h3>

            <p className="text-muted-foreground leading-7">
              You hereby grant Tailgate a worldwide, perpetual, irrevocable,
              royalty-free, fully paid, transferable, assignable, and
              sublicensable license to collect, access, use, store, analyze,
              modify, adapt, aggregate, anonymize, derive, model, commercialize,
              sell, license, disclose, distribute, and otherwise exploit all
              data associated with you or your use of the Platform, to the
              maximum extent permitted by law.
            </p>

            <p className="text-muted-foreground leading-7">
              This license includes, without limitation, use for advertising,
              marketing, behavioral targeting, attribution, analytics,
              measurement, audience segmentation, AI and machine-learning
              training, predictive modeling, optimization, research,
              benchmarking, resale, licensing, and commercial partnerships
              across industries.
            </p>

            <p className="text-muted-foreground leading-7">
              By accessing or using the Platform, you expressly consent to the
              collection, processing, storage, and use of a broad range of data
              relating to you and your interactions with the Platform, to the
              maximum extent permitted by applicable law. Such data may include
              information you voluntarily provide, information collected
              automatically, information inferred or derived from your behavior,
              and information obtained from third-party sources.
            </p>

            <p className="text-muted-foreground leading-7">
              Data collected may include, without limitation, personal
              identifiers, contact information, demographic attributes
              (including age range, gender identity, racial or ethnic
              identifiers where voluntarily provided or lawfully obtained),
              educational affiliation, device identifiers, IP address, browser
              type, operating system, network information, interaction metadata,
              redemption history, purchasing tendencies, engagement frequency,
              time-of-day behavior, geographic location data (precise or
              approximate, including GPS, Wi-Fi, Bluetooth, or IP-based location
              where enabled), preferences, interests, inferred behavioral
              traits, and any other data reasonably associated with your use of
              the Platform.
            </p>

            <p className="text-muted-foreground leading-7">
              You acknowledge and agree that Tailgate may associate, infer, or
              derive additional attributes about you, including preferences,
              behavioral segments, affinity categories, and predictive
              characteristics, based on observed activity, aggregated trends,
              and analytical modeling.
            </p>
          </section>

          <section className="space-y-4">
            <h3 className="text-xl font-semibold">
              9. Activation-Based and Contextual Consent Reaffirmation
            </h3>

            <p className="text-muted-foreground leading-7">
              You acknowledge that Tailgate may present additional notices,
              disclosures, or prompts at activation, scan, tap, or interaction
              points and that your continued use following such disclosures
              constitutes reaffirmation of consent. You waive any requirement
              for separate signatures or repeated acknowledgments beyond such
              mechanisms.
            </p>

            <div className="border-border mt-8 space-y-4 border-l-2 pl-6">
              <h4 className="text-lg font-semibold">
                9.1 No Guarantee of Merchant Performance or Discount Honoring
              </h4>

              <p className="text-muted-foreground leading-7">
                You acknowledge and agree that Tailgate acts solely as a
                facilitator of access to third-party merchant offers and does
                not own, operate, control, or manage any participating merchant.
                Tailgate makes no guarantee, representation, or warranty that
                any merchant will honor a particular discount, offer, or
                promotion at any time.
              </p>

              <p className="text-muted-foreground leading-7">
                While Tailgate may enter into agreements with merchants and may
                take reasonable steps to encourage compliance, Tailgate has no
                direct control over merchant operations, verification practices,
                point-of-sale systems, or employee conduct. Tailgate is not
                responsible or liable for a merchant&apos;s refusal to honor an
                offer, modification of terms, unavailability, or discontinuation
                of participation.
              </p>

              <p className="text-muted-foreground leading-7">
                You agree that any dispute regarding the honoring of a discount
                is solely between you and the merchant, and you waive any claim
                against Tailgate arising from a merchant&apos;s failure or
                refusal to honor an offer.
              </p>
            </div>

            <div className="border-border mt-8 space-y-4 border-l-2 pl-6">
              <h4 className="text-lg font-semibold">
                9.2 Limitation of Liability for Merchant Conduct
              </h4>

              <p className="text-muted-foreground leading-7">
                To the maximum extent permitted by law, Tailgate Systems, Inc.
                shall not be liable for any loss, inconvenience, damages, or
                expenses arising from merchant actions or omissions, including
                but not limited to refusal to honor discounts, inaccurate
                representations by merchants, or changes in merchant
                participation. Tailgate&apos;s role is limited to providing
                access and facilitating discovery, not enforcement.
              </p>
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-xl font-semibold">
              10. Aggregated, Anonymized, and Derived Data Ownership
            </h3>

            <p className="text-muted-foreground leading-7">
              You acknowledge and agree that Tailgate exclusively owns all
              aggregated, anonymized, de-identified, or derived data generated
              through or in connection with the Platform. Such data is not
              personal data once anonymized and is not subject to access,
              deletion, or opt-out rights where permitted by law.
            </p>

            <p className="text-muted-foreground leading-7">
              You waive any claim to ownership, compensation, or control over
              such data, regardless of its source.
            </p>
          </section>

          <section className="space-y-4">
            <h3 className="text-xl font-semibold">
              11. Targeting, Marketing, and Cross-Context Use Consent
            </h3>

            <p className="text-muted-foreground leading-7">
              You expressly consent to Tailgate&apos;s use of data for
              personalized, contextual, interest-based, behavioral, and
              location-based advertising and promotions, including across
              different devices, platforms, and contexts. Communications may be
              delivered via email, SMS, push notification, web, in-app
              messaging, or other lawful channels.
            </p>

            <p className="text-muted-foreground leading-7">
              Opt-out mechanisms are provided where legally required; however,
              opt-out does not prohibit non-marketing data processing,
              analytics, measurement, or anonymized use.
            </p>
          </section>

          <section className="space-y-4">
            <h3 className="text-xl font-semibold">
              12. Automated Processing, Profiling, and AI Systems
            </h3>

            <p className="text-muted-foreground leading-7">
              You acknowledge that Tailgate may employ automated decision-making
              systems, algorithms, artificial intelligence, and machine-learning
              models to analyze data, predict behavior, optimize offers, detect
              fraud, and improve operational efficiency. Tailgate is not
              obligated to disclose algorithmic logic, weighting, or outputs.
            </p>
          </section>

          <section className="space-y-4">
            <h3 className="text-xl font-semibold">
              13. Data Retention, Deletion, and Survival
            </h3>

            <p className="text-muted-foreground leading-7">
              Tailgate retains personal data for as long as reasonably necessary
              for the purposes described herein or as permitted by law. Upon
              verified request, Tailgate will comply with applicable deletion or
              access obligations. Aggregated, anonymized, and derived data may
              be retained indefinitely.
            </p>

            <p className="text-muted-foreground leading-7">
              All data licenses and ownership rights survive termination,
              account deletion, or cessation of Platform use to the maximum
              extent permitted by law.
            </p>
          </section>

          <section className="space-y-4">
            <h3 className="text-xl font-semibold">
              14. User Rights and Opt-Outs
            </h3>

            <p className="text-muted-foreground leading-7">
              Tailgate provides rights and opt-out mechanisms as required under
              applicable U.S. privacy laws, including state consumer privacy
              statutes. Requests may be subject to verification and lawful
              limitations. Tailgate may deny requests where permitted by law.
            </p>
          </section>

          <section className="space-y-4">
            <h3 className="text-xl font-semibold">
              15. Data Sharing, Transfers, and Corporate Transactions
            </h3>

            <p className="text-muted-foreground leading-7">
              Tailgate may share, transfer, or assign data and associated rights
              to affiliates, partners, service providers, advertisers,
              acquirers, successors, or assigns, including in connection with
              mergers, acquisitions, financings, or asset sales.
            </p>
          </section>

          <section className="space-y-4">
            <h3 className="text-xl font-semibold">
              16. Security Acknowledgment
            </h3>

            <p className="text-muted-foreground leading-7">
              Tailgate implements reasonable safeguards but does not guarantee
              absolute security. You acknowledge inherent risks associated with
              digital data systems.
            </p>
          </section>

          <section className="space-y-4">
            <h3 className="text-xl font-semibold">17. Disclaimers</h3>

            <p className="leading-7 font-bold uppercase">
              The Platform is provided &quot;as is&quot; and &quot;as
              available.&quot; Tailgate disclaims all warranties, express or
              implied.
            </p>
          </section>

          <section className="space-y-4">
            <h3 className="text-xl font-semibold">
              18. Limitation of Liability
            </h3>

            <p className="leading-7 font-bold uppercase">
              To the maximum extent permitted by law, Tailgate&apos;s total
              liability shall not exceed one hundred U.S. dollars (USD $100).
            </p>
          </section>

          <section className="space-y-4">
            <h3 className="text-xl font-semibold">19. Indemnification</h3>

            <p className="text-muted-foreground leading-7">
              You agree to indemnify and hold harmless Tailgate from claims
              arising from your use of the Platform or violation of this
              Agreement.
            </p>
          </section>

          <section className="space-y-4">
            <h3 className="text-xl font-semibold">
              20. Governing Law, Arbitration, and Class Waiver
            </h3>

            <p className="text-muted-foreground leading-7">
              This Agreement is governed by Delaware law. All disputes shall be
              resolved by binding arbitration on an individual basis. You waive
              class actions.
            </p>
          </section>

          <section className="space-y-4">
            <h3 className="text-xl font-semibold">
              21. Modifications and Continued Use
            </h3>

            <p className="text-muted-foreground leading-7">
              Tailgate may modify this Agreement at any time. Continued use
              constitutes acceptance.
            </p>
          </section>

          <section className="space-y-4">
            <h3 className="text-xl font-semibold">22. Contact Information</h3>

            <p className="text-muted-foreground leading-7">
              Tailgate Systems, Inc.
              <br />
              Legal &amp; Privacy Department
              <br />
              <a
                href="mailto:Shuffm@tailgateofficial.com"
                className="text-primary hover:underline"
              >
                Shuffm@tailgateofficial.com
              </a>
            </p>
          </section>
        </article>
      </div>
    </div>
  );
}

export default withI18n(TermsOfServicePage);
