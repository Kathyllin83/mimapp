import { Link } from "@tanstack/react-router";
import { Heart } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { brl, discount, MARKETPLACES } from "@/lib/format";
import { useStore } from "@/lib/store";
import type { Product } from "@/lib/types";
import { cn } from "@/lib/utils";

export function ProductCard({ product, className }: { product: Product; className?: string }) {
  const { favorites, toggleFavorite } = useStore();
  const fav = favorites.includes(product.id);
  const [pop, setPop] = useState(false);
  const off = discount(product.price, product.oldPrice);
  return (
    <article className={cn("product-card group", className)}>
      <Link to="/comparar" search={{ id: product.id }} className="block">
        <div className="product-image">
          <img src={product.image} alt={product.name} loading="lazy" width={816} height={816} />
          {off > 0 && <span className="product-discount">−{off}%</span>}
        </div>
        <div className="product-copy">
          <p className="product-store">{MARKETPLACES[product.store].label}</p>
          <h3>{product.name}</h3>
          <div className="product-price">
            <strong>{brl(product.price)}</strong>
            {product.oldPrice && <del>{brl(product.oldPrice)}</del>}
          </div>
        </div>
      </Link>
      <button
        aria-label={fav ? `Remover ${product.name} dos favoritos` : `Favoritar ${product.name}`}
        aria-pressed={fav}
        className="favorite-button"
        onAnimationEnd={() => setPop(false)}
        onClick={() => {
          toggleFavorite(product.id);
          setPop(true);
          toast(fav ? "Removido dos favoritos" : "Salvo no seu perfil");
        }}
      >
        <Heart
          size={18}
          className={cn(fav && "fill-primary text-primary", pop && "animate-heart")}
        />
      </button>
    </article>
  );
}
export function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="product-section">
      <div className="section-heading">
        <h2>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
export function Rail({ products }: { products: Product[] }) {
  return (
    <div className="product-rail">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  );
}
