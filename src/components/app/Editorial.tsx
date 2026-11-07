import { BrandLogo } from "./BrandLogo";

/** Lightweight CSS object; optional art can replace it without loading a 3D engine. */
export function BrandObject({ src, className = "" }: { src?: string; className?: string }) {
  return (
    <div className={`brand-object ${className}`} aria-hidden="true">
      {src ? (
        <img src={src} alt="" />
      ) : (
        <div className="gift-object">
          <span className="gift-handle" />
          <BrandLogo variant="clara" className="h-8 w-16" />
          <span className="gift-tag">m.</span>
        </div>
      )}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="empty-state">
      <BrandObject />
      <h2 className="font-display text-2xl">{title}</h2>
      <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
      {children}
    </div>
  );
}
