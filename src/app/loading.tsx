import { Skeleton } from "@/components/ui";

export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading">
      <div className="flex items-end justify-between">
        <div className="space-y-2">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-8 w-72" />
          <Skeleton className="h-3 w-56" />
        </div>
        <Skeleton className="h-8 w-32" />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-[76px]" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-[280px]" />
          ))}
        </div>
        <div className="space-y-4">
          <Skeleton className="h-[220px]" />
          <Skeleton className="h-[180px]" />
        </div>
      </div>
    </div>
  );
}
