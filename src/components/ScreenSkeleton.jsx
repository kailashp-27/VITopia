export default function ScreenSkeleton({ cards = 3 }) {
  return (
    <div
      className="screen-skeleton"
      role="status"
      aria-live="polite"
      aria-label="Loading content"
    >
      <div className="skeleton-card skeleton-hero">
        <div className="skeleton-line skeleton-w-40 skeleton-h-sm" />
        <div className="skeleton-line skeleton-w-65 skeleton-h-lg" />
        <div className="skeleton-line skeleton-w-50 skeleton-h-sm" />
      </div>
      {Array.from({ length: cards }, (_, i) => (
        <div key={i} className="skeleton-card">
          <div className="skeleton-row">
            <div className="skeleton-line skeleton-w-55 skeleton-h-md" />
            <div className="skeleton-pill" />
          </div>
          <div className="skeleton-line skeleton-w-80 skeleton-h-sm" />
        </div>
      ))}
    </div>
  );
}
