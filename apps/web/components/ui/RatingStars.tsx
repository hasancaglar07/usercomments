import type { StarType } from "@/src/types";

type RatingStarsProps = {
  stars: StarType[];
  valueText?: string;
};

export function RatingStarsHomepage({ stars, valueText }: RatingStarsProps) {
  return (
    <div className="flex items-center gap-1 mb-2">
      {stars.map((star, index) => {
        const baseClass = "material-symbols-outlined text-[20px]";
        if (star === "full") {
          return (
            <span key={index} className={`${baseClass} star-filled`}>
              star
            </span>
          );
        }
        if (star === "half") {
          return (
            <span key={index} className={`${baseClass} star-filled`}>
              star_half
            </span>
          );
        }
        return (
          <span key={index} className={`${baseClass} star-empty`}>
            star
          </span>
        );
      })}
      {valueText ? (
        <span className="ml-2 text-xs font-bold text-gray-400">{valueText}</span>
      ) : null}
    </div>
  );
}

export function RatingStarsCatalog({ stars, valueText }: RatingStarsProps) {
  return (
    <div className="flex items-center gap-1 mb-3">
      {stars.map((star, index) => {
        const filledClass =
          "material-symbols-outlined text-secondary text-[20px] fill-current";
        const emptyClass =
          "material-symbols-outlined text-slate-300 text-[20px] fill-current";
        if (star === "full") {
          return (
            <span key={index} className={filledClass}>
              star
            </span>
          );
        }
        if (star === "half") {
          return (
            <span key={index} className={filledClass}>
              star_half
            </span>
          );
        }
        return (
          <span key={index} className={emptyClass}>
            star
          </span>
        );
      })}
      {valueText ? (
        <span className="ml-2 text-sm font-medium text-slate-600 dark:text-slate-400">
          {valueText}
        </span>
      ) : null}
    </div>
  );
}

export function RatingStarsCategory({ stars }: RatingStarsProps) {
  return (
    <div className="flex text-primary">
      {stars.map((star, index) => {
        const baseClass = "material-symbols-outlined text-[20px]";
        if (star === "full") {
          return (
            <span key={index} className={`${baseClass} fill-current`}>
              star
            </span>
          );
        }
        if (star === "half") {
          return (
            <span key={index} className={`${baseClass} fill-current`}>
              star_half
            </span>
          );
        }
        return (
          <span key={index} className={`${baseClass} text-gray-300`}>
            star
          </span>
        );
      })}
    </div>
  );
}

export function RatingStarsProfile({ stars }: RatingStarsProps) {
  return (
    <div className="flex items-center gap-0.5 text-yellow-400">
      {stars.map((star, index) => {
        if (star === "empty") {
          return (
            <span key={index} className="material-symbols-outlined text-[20px]">
              star
            </span>
          );
        }
        return (
          <span key={index} className="material-symbols-filled text-[20px]">
            star
          </span>
        );
      })}
    </div>
  );
}
