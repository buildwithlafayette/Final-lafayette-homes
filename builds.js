// builds.js
// Lafayette Homes – Available Homes page
// Fixes: duplicate image on open, inconsistent sizing, misaligned hero.
// Uses a single lightbox modal with strict aspect ratio and object-cover.

import React, { useCallback, useEffect, useMemo, useState } from "react";

// -----------------------
// DATA
// -----------------------
// If you already have a separate data file, you can swap HOMES with your import.
// The important part for the gallery is each listing has an `images` array.
//
// Example structure shown here so this file is paste-ready.
const HOMES = [
  {
    id: "dog-leg-ln",
    title: "2610 Dog Leg Ln, Seneca SC",
    city: "Seneca, SC",
    price: "$797,900",
    badges: ["for sale"],
    details: { beds: 5, baths: 4, sqft: 3440 },
    zillowUrl: "https://www.zillow.com/",
    images: [
      // Replace these with your real image URLs (keep order consistent).
      "/images/dog-leg/1.jpg",
      "/images/dog-leg/2.jpg",
      "/images/dog-leg/3.jpg",
      "/images/dog-leg/4.jpg",
      "/images/dog-leg/5.jpg",
      "/images/dog-leg/6.jpg",
    ],
  },
  // You can add more listings here using the same shape
];

// -----------------------
// LIGHTBOX MODAL
// -----------------------
function Lightbox({
  isOpen,
  images,
  index,
  onClose,
  onPrev,
  onNext,
}: {
  isOpen: boolean;
  images: string[];
  index: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  // Disable body scroll while the modal is open
  useEffect(() => {
    if (!isOpen) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [isOpen]);

  if (!isOpen) return null;
  const src = images?.[index];

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
      >
        ✕
      </button>

      {/* Centered media stage – single image only */}
      <div
        className="mx-auto flex h-full max-w-6xl items-center px-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Prev */}
        <button
          aria-label="Previous image"
          onClick={onPrev}
          className="mr-3 hidden shrink-0 rounded-full bg-white/10 p-3 text-white hover:bg-white/20 md:inline-flex"
        >
          ‹
        </button>

        {/* Stage: locked aspect so every image renders same shape */}
        <div className="w-full">
          <div className="relative mx-auto aspect-[16/9] w-full overflow-hidden rounded-2xl shadow-2xl">
            {src ? (
              <img
                key={src}
                src={src}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
                draggable={false}
              />
            ) : null}
          </div>

          {/* Pagination indicators */}
          <div className="mt-3 flex items-center justify-center gap-2">
            {images.map((_, i) => (
              <button
                key={i}
                onClick={() => {
                  // jump directly
                  const el = document.getElementById("__lightbox-jump");
                  if (el) el.focus();
                }}
                className={`h-2 w-2 rounded-full ${
                  i === index ? "bg-white" : "bg-white/40"
                }`}
                aria-label={`Go to image ${i + 1}`}
              />
            ))}
            <span id="__lightbox-jump" className="sr-only">
              Image {index + 1} of {images.length}
            </span>
          </div>

          {/* Mobile next/prev */}
          <div className="mt-3 flex items-center justify-center gap-3 md:hidden">
            <button
              onClick={onPrev}
              className="rounded-full bg-white/10 px-4 py-2 text-white hover:bg-white/20"
            >
              Prev
            </button>
            <button
              onClick={onNext}
              className="rounded-full bg-white/10 px-4 py-2 text-white hover:bg-white/20"
            >
              Next
            </button>
          </div>
        </div>

        {/* Next */}
        <button
          aria-label="Next image"
          onClick={onNext}
          className="ml-3 hidden shrink-0 rounded-full bg-white/10 p-3 text-white hover:bg-white/20 md:inline-flex"
        >
          ›
        </button>
      </div>
    </div>
  );
}

// -----------------------
// LISTING CARD
// -----------------------
function ListingCard({
  home,
  onOpenGallery,
}: {
  home: (typeof HOMES)[number];
  onOpenGallery: (images: string[], startIndex?: number) => void;
}) {
  const first = home.images?.[0];

  return (
    <div className="group overflow-hidden rounded-2xl border border-white/10 bg-neutral-900 shadow-lg transition hover:shadow-xl">
      {/* Locked aspect for consistency across cards */}
      <div className="relative aspect-[16/9] w-full overflow-hidden">
        {first && (
          <img
            src={first}
            alt={home.title}
            className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
            loading="lazy"
          />
        )}
        <button
          onClick={() => onOpenGallery(home.images, 0)}
          className="absolute inset-0"
          aria-label={`Open gallery for ${home.title}`}
          title="View photos"
        />
      </div>

      <div className="space-y-2 p-4">
        <div className="flex items-center gap-2">
          {home.badges?.map((b) => (
            <span
              key={b}
              className="rounded-full bg-emerald-600/15 px-2 py-0.5 text-xs text-emerald-400"
            >
              {b}
            </span>
          ))}
        </div>

        <h3 className="text-lg font-semibold text-white">{home.title}</h3>
        <p className="text-sm text-white/70">{home.city}</p>

        <div className="flex flex-wrap items-center gap-3 text-sm text-white/80">
          <span className="font-medium">{home.price}</span>
          <span>• {home.details.beds} Beds</span>
          <span>• {home.details.baths} Baths</span>
          <span>• {home.details.sqft.toLocaleString()} sqft</span>
        </div>

        <div className="mt-3 flex gap-2">
          {home.zillowUrl && (
            <a
              href={home.zillowUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-xl border border-white/10 px-3 py-2 text-sm text-white hover:bg-white/10"
            >
              View on Zillow
            </a>
          )}
          <button
            onClick={() => onOpenGallery(home.images, 0)}
            className="rounded-xl bg-white px-3 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-200"
          >
            View Photos
          </button>
        </div>
      </div>
    </div>
  );
}

// -----------------------
// PAGE
// -----------------------
export default function Builds() {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const openGallery = useCallback((images: string[], startIndex = 0) => {
    if (!images || !images.length) return;
    setLightboxImages(images);
    setLightboxIndex(startIndex);
    setLightboxOpen(true);
  }, []);

  const closeGallery = useCallback(() => setLightboxOpen(false), []);
  const nextImage = useCallback(() => {
    setLightboxIndex((i) =>
      lightboxImages.length ? (i + 1) % lightboxImages.length : 0
    );
  }, [lightboxImages.length]);
  const prevImage = useCallback(() => {
    setLightboxIndex((i) =>
      lightboxImages.length ? (i - 1 + lightboxImages.length) % lightboxImages.length : 0
    );
  }, [lightboxImages.length]);

  // Keyboard controls for the lightbox
  useEffect(() => {
    if (!lightboxOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeGallery();
      if (e.key === "ArrowRight") nextImage();
      if (e.key === "ArrowLeft") prevImage();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxOpen, closeGallery, nextImage, prevImage]);

  const homes = useMemo(() => HOMES, []);

  return (
    <main className="mx-auto max-w-7xl px-4 py-10">
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-white">Available Homes</h1>
        <p className="mt-1 text-white/70">
          Tap any card to view photos. All images open in a unified lightbox with a fixed 16:9
          stage so every picture is the same size and shape.
        </p>
      </header>

      {/* Grid of listings */}
      <section className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {homes.map((home) => (
          <ListingCard
            key={home.id}
            home={home}
            onOpenGallery={openGallery}
          />
        ))}
      </section>

      {/* Single lightbox instance for the entire page */}
      <Lightbox
        isOpen={lightboxOpen}
        images={lightboxImages}
        index={lightboxIndex}
        onClose={closeGallery}
        onPrev={prevImage}
        onNext={nextImage}
      />
    </main>
  );
}
