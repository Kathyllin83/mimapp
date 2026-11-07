import bordo from "@/assets/logos/01_logo_bordo.png";
import clara from "@/assets/logos/02_logo_clara.png";
import { cn } from "@/lib/utils";

export function BrandLogo({
  variant = "bordo",
  className,
}: {
  variant?: "bordo" | "clara";
  className?: string;
}) {
  return (
    <img
      src={variant === "clara" ? clara : bordo}
      alt="Mimá"
      width={768}
      height={341}
      className={cn("brand-logo shrink-0 object-contain", className)}
    />
  );
}
