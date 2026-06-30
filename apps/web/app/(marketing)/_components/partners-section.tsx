'use client';

import { useCallback, useRef, useState } from 'react';

import Image from 'next/image';

import { ChevronLeft, ChevronRight } from 'lucide-react';

const brands = [
  {
    src: '/images/brands/texas-roadhouse.svg',
    alt: 'Texas Roadhouse',
    height: 114,
  },
  {
    src: '/images/brands/tropical-smoothie-cafe.svg',
    alt: 'Tropical Smoothie Cafe',
    height: 56,
  },
  { src: '/images/brands/dominos.svg', alt: "Domino's", height: 58 },
  { src: '/images/brands/krispy-kreme.svg', alt: 'Krispy Kreme', height: 64 },
  { src: '/images/brands/crunch.svg', alt: 'Crunch Fitness', height: 75 },
  {
    src: '/images/brands/buffalo-wild-wings.svg',
    alt: 'Buffalo Wild Wings',
    height: 75,
  },
  {
    src: '/images/brands/mediterranean-guys.svg',
    alt: 'Mediterranean Guys',
    height: 75,
  },
  { src: '/images/brands/sweetfrog.svg', alt: 'SweetFrog', height: 62 },
  { src: '/images/brands/urgies.svg', alt: "Urgie's", height: 114 },
  {
    src: '/images/brands/beach-bum-tanning.svg',
    alt: 'Beach Bum Tanning',
    height: 114,
  },
  { src: '/images/brands/dq.svg', alt: 'Dairy Queen', height: 114 },
];

export function PartnersSection() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;

    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  const scroll = useCallback((direction: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;

    const scrollAmount = el.clientWidth * 0.6;
    el.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  }, []);

  return (
    <section className="bg-[#F4F4F5] py-12">
      <div className="w-full px-4">
        <h2 className="mb-8 text-center text-3xl font-semibold">
          Global Chains to Local Favorites
        </h2>

        <div className="relative">
          {canScrollLeft && (
            <button
              onClick={() => scroll('left')}
              className="absolute top-1/2 left-2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white shadow-md transition-colors hover:bg-gray-100"
              aria-label="Scroll left"
            >
              <ChevronLeft className="h-5 w-5 text-gray-600" />
            </button>
          )}

          {canScrollRight && (
            <button
              onClick={() => scroll('right')}
              className="absolute top-1/2 right-2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white shadow-md transition-colors hover:bg-gray-100"
              aria-label="Scroll right"
            >
              <ChevronRight className="h-5 w-5 text-gray-600" />
            </button>
          )}

          <div
            ref={scrollRef}
            onScroll={updateScrollState}
            className="scrollbar-hide overflow-x-auto px-4"
          >
            <div className="mx-auto flex w-fit items-center gap-6 md:gap-8">
              {brands.map((brand) => (
                <Image
                  key={brand.src}
                  src={brand.src}
                  alt={brand.alt}
                  width={Math.round((brand.height / 75) * 100)}
                  height={brand.height}
                  style={{ height: brand.height, width: 'auto' }}
                  className="shrink-0 object-contain"
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
