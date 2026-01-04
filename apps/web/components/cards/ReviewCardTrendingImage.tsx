"use client";

import { useState } from "react";

type ReviewCardTrendingImageProps = {
  alt: string;
  src: string;
  imagePriority?: boolean;
};

export default function ReviewCardTrendingImage({
  alt,
  src,
  imagePriority = false,
}: ReviewCardTrendingImageProps) {
  const [isImageLoading, setIsImageLoading] = useState(!imagePriority);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt={alt}
      className={`absolute inset-0 h-full w-full object-cover transition-all duration-300 ease-in-out group-hover:scale-105 ${
        isImageLoading
          ? "scale-110 blur-xl grayscale opacity-0"
          : "scale-100 blur-0 grayscale-0 opacity-100"
      }`}
      decoding="async"
      fetchPriority={imagePriority ? "high" : "auto"}
      loading={imagePriority ? "eager" : "lazy"}
      src={src}
      onLoad={() => setIsImageLoading(false)}
    />
  );
}
