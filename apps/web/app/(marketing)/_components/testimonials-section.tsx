import Image from 'next/image';

import { Star } from 'lucide-react';

import { Card, CardContent } from '@kit/ui/card';

const testimonials = [
  {
    image: '/images/tailgate-cards/tg-card-1.svg',
    quote:
      'Tailgate helped us raise over $10,000 for our annual event. Our members love the discounts!',
    author: 'Sarah Mitchell',
    role: 'Organization President',
  },
  {
    image: '/images/tailgate-cards/tg-card-2.svg',
    quote:
      "We've seen a 40% increase in foot traffic. It's a win-win for everyone.",
    author: "Mike's Coffee House",
    role: 'Local Business Owner',
  },
  {
    image: '/images/tailgate-cards/tg-card-3.svg',
    quote:
      "I've saved over $200 this year just by using my Tailgate account at local spots.",
    author: 'Alex Chen',
    role: 'Cardholder',
  },
];

function StarRating() {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star key={star} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
      ))}
    </div>
  );
}

export function TestimonialsSection() {
  return (
    <section className="bg-[#F4F4F5] px-4 py-16 md:py-24">
      <div className="mx-auto max-w-7xl">
        {/* Section header */}
        <h2 className="mb-12 text-center text-3xl font-bold md:text-4xl">
          Loved by <span className="text-brand">Everyone!</span>
        </h2>

        {/* Testimonials grid */}
        <div className="grid gap-6 md:grid-cols-3">
          {testimonials.map((testimonial) => (
            <Card
              key={testimonial.author}
              className="overflow-hidden border-0 bg-[#EFEFF0]"
            >
              <CardContent className="p-8">
                {/* Card image */}
                <div className="relative aspect-[350/220]">
                  <Image
                    src={testimonial.image}
                    alt={`${testimonial.author} card`}
                    fill
                    className="object-cover"
                  />
                </div>
                {/* Star rating */}
                <div className="mt-2 mb-4">
                  <StarRating />
                </div>

                {/* Quote */}
                <p className="text-muted-foreground mb-4 text-sm leading-relaxed">
                  &ldquo;{testimonial.quote}&rdquo;
                </p>

                {/* Attribution */}
                <div>
                  <div className="font-semibold">{testimonial.author}</div>
                  <div className="text-muted-foreground text-sm">
                    {testimonial.role}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
