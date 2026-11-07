import { Link, useRouterState } from "@tanstack/react-router";
import { Bell, Compass, Heart, Sparkles, Tag, User } from "lucide-react";
import type { ReactNode } from "react";
import { BrandLogo } from "./BrandLogo";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/explorar", label: "Explorar", icon: Compass },
  { to: "/ofertas", label: "Ofertas", icon: Tag },
  { to: "/desejos", label: "Desejos", icon: Heart },
  { to: "/assistente", label: "Assistente", icon: Sparkles },
  { to: "/notificacoes", label: "Alertas", icon: Bell },
  { to: "/perfil", label: "Perfil", icon: User },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { notifications } = useStore();
  const unread = notifications.filter((n) => !n.read).length;
  if (path === "/" || path.startsWith("/admin")) return <>{children}</>;
  return (
    <div className={cn("shopping-app", path === "/assistente" && "is-chat")}>
      <a href="#main-content" className="skip-link">
        Pular para o conteúdo
      </a>
      <header className="app-topbar">
        <div className="app-topbar-inner">
          <Link to="/" aria-label="Mimá — início" className="brand-lockup">
            <BrandLogo className="h-10 w-[90px]" />
          </Link>
          <nav aria-label="Navegação principal" className="desktop-nav">
            {NAV.map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                aria-current={path === to ? "page" : undefined}
                className={cn("desktop-nav-link", path === to && "is-active")}
              >
                {label}
              </Link>
            ))}
          </nav>
          <Link to="/planos" className="membership-link">
            Conheça o clube <span aria-hidden="true">↗</span>
          </Link>
          <Link
            to="/notificacoes"
            aria-label={`Alertas, ${unread} não lidos`}
            className="mobile-alert"
          >
            <Bell size={21} />
            {unread > 0 && <i />}
          </Link>
        </div>
      </header>
      <main id="main-content" className="app-main" tabIndex={-1}>
        <div key={path} className="page-transition">
          {children}
        </div>
        <footer className="brand-footer">
          <span className="brand-dot" /> Mimá · suas escolhas em um só lugar
        </footer>
      </main>
      <nav aria-label="Navegação mobile" className="bottom-nav">
        {NAV.map(({ to, label, icon: Icon }) => {
          const active = path === to;
          return (
            <Link
              key={to}
              to={to}
              aria-current={active ? "page" : undefined}
              className={cn("bottom-nav-link", active && "is-active")}
            >
              <span className="nav-icon">
                <Icon size={21} strokeWidth={active ? 2 : 1.6} />
                {to === "/notificacoes" && unread > 0 && <i className="nav-dot" />}
              </span>
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <header className="page-heading">
      <div>
        <p className="eyebrow">Seu universo Mimá</p>
        <h1>{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {right}
    </header>
  );
}
