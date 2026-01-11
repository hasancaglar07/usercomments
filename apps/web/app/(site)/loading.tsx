import {
  HomepageFeedSkeleton,
  HomepageSidebarSkeleton,
  TrendingSectionSkeleton,
} from "@/components/homepage/HomepageSectionSkeletons";

export default function Loading() {
  return (
    <div className="bg-surface-light dark:bg-background-dark text-text-main min-h-screen flex flex-col">
      <main className="flex-grow w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <TrendingSectionSkeleton />
        <div className="flex flex-col lg:flex-row gap-8">
          <div className="flex-1">
            <HomepageFeedSkeleton />
          </div>
          <HomepageSidebarSkeleton />
        </div>
      </main>
    </div>
  );
}
