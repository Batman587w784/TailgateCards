import Image from 'next/image';

import { ChevronsDown } from 'lucide-react';

const steps = [
  {
    number: 1,
    title: 'Join Your Organization',
    description:
      'Register for a digital Tailgate account through your organization.',
  },
  {
    number: 2,
    title: 'Activate & Browse',
    description:
      'Activate your digital account and browse available discounts at local merchants.',
  },
  {
    number: 3,
    title: 'Save & Support',
    description:
      'Enjoy discounts while your organization earns funds from every purchase.',
  },
];

export function GetStartedSteps() {
  return (
    <section className="bg-[#F4F4F5] px-4 py-16 md:py-24">
      <div className="relative mx-auto max-w-7xl overflow-hidden rounded-4xl border border-zinc-200/70 bg-[#f0f0f1] p-4 shadow-sm sm:p-10">
        {/* Background image */}
        <Image
          src="/images/timeline-steps.png"
          alt=""
          width={325}
          height={325}
          className="pointer-events-none absolute right-0 bottom-0 w-[200px] sm:right-10 sm:bottom-10 sm:w-[325px]"
          aria-hidden="true"
        />

        {/* 2-column grid: timeline track | content */}
        <div className="grid grid-cols-[48px_1fr] gap-x-4 sm:grid-cols-[120px_1fr] sm:gap-x-7">
          {/* ── Timeline track column ── */}
          <div className="relative flex flex-col items-center">
            {/* Start node */}
            <div className="bg-brand z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
              <ChevronsDown
                className="h-[22px] w-[22px] text-white"
                strokeWidth={2}
              />
            </div>

            {/* Stem line with increasing blur toward bottom */}
            <div className="relative mt-0 flex-1">
              {/* Core line */}
              <div className="bg-brand absolute inset-y-0 left-1/2 w-[3px] -translate-x-1/2" />

              {/* Glow layer 1 – top portion */}
              <div className="bg-brand/18 absolute top-0 left-1/2 h-[55%] w-2 -translate-x-1/2 blur-[3px]" />

              {/* Glow layer 2 – middle */}
              <div className="bg-brand/16 absolute top-[40%] left-1/2 h-[40%] w-3 -translate-x-1/2 blur-[8px]" />

              {/* Glow layer 3 – bottom */}
              <div className="bg-brand/14 absolute top-[65%] left-1/2 h-[35%] w-5 -translate-x-1/2 blur-[14px]" />
            </div>
          </div>

          {/* ── Content column ── */}
          <div className="flex flex-col">
            {/* Heading */}
            <h2 className="mb-8 text-xl font-extrabold tracking-tight text-zinc-900 sm:text-4xl">
              Get Started in 3 Easy Steps
            </h2>

            {/* Steps */}
            <div className="flex flex-col gap-8">
              {steps.map((step) => (
                <div key={step.number} className="flex items-center gap-5">
                  {/* Step marker */}
                  <div className="bg-brand flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-semibold text-white">
                    {step.number}
                  </div>

                  {/* Step text */}
                  <div className="pt-1">
                    <h3 className="text-sm font-semibold text-zinc-900 sm:text-base">
                      {step.title}
                    </h3>
                    <p className="text-sm leading-relaxed text-zinc-800 sm:text-base">
                      {step.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
