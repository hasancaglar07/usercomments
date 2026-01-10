"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { DEFAULT_AVATAR } from "@/src/lib/review-utils";
import { getOptimizedImageUrl } from "@/src/lib/image-optimization";

type UserAvatarProps = {
    src?: string | null;
    alt: string;
    size: number;
    className?: string;
    priority?: boolean;
};

export default function UserAvatar({
    src,
    alt,
    size,
    className,
    priority = false,
}: UserAvatarProps) {
    const [imgSrc, setImgSrc] = useState<string>(
        src ? getOptimizedImageUrl(src, size) : DEFAULT_AVATAR
    );
    const [hasError, setHasError] = useState(false);

    useEffect(() => {
        setImgSrc(src ? getOptimizedImageUrl(src, size) : DEFAULT_AVATAR);
        setHasError(false);
    }, [src, size]);

    return (
        <div className={`relative ${className}`} style={{ width: size, height: size }}>
            <Image
                src={hasError ? DEFAULT_AVATAR : imgSrc}
                alt={alt}
                fill
                sizes={`${size}px`}
                className="object-cover rounded-full"
                onError={() => setHasError(true)}
                priority={priority}
                unoptimized={hasError || imgSrc === DEFAULT_AVATAR}
            />
        </div>
    );
}
