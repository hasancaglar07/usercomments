export function Skeleton({
    className,
    ...props
}: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            className={`bg-gray-200 dark:bg-gray-700/50 rounded-md shine-effect ${className || ''}`}
            {...props}
        />
    );
}

