
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
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt={alt}
      className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 ease-in-out group-hover:scale-105"
      decoding="async"
      fetchPriority={imagePriority ? "high" : "auto"}
      loading={imagePriority ? "eager" : "lazy"}
      src={src}
    />
  );
}

