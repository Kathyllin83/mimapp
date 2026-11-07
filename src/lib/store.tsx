import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { DEFAULT_PLANS } from "./plans";
import type { AppNotification, CategoryId, Plan, PlanId, WishItem } from "./types";

interface User {
  id?: string;
  name: string;
  email: string;
  role?: "user" | "admin";
}

interface State {
  user: User | null;
  favorites: string[];
  wishlist: WishItem[];
  notifications: AppNotification[];
  planId: PlanId;
  plans: Record<PlanId, Plan>;
  aiUsed: number;
  favCategories: CategoryId[];
  notifPrefs: Record<string, boolean>;
}

const initial: State = {
  user: null,
  favorites: [],
  wishlist: [],
  notifications: [],
  planId: "free",
  plans: DEFAULT_PLANS,
  aiUsed: 0,
  favCategories: [],
  notifPrefs: { queda: true, alvo: true, oferta: true, favorito: true, limite: true },
};

const KEY = "achadinha-state-v1";

interface Ctx extends State {
  plan: Plan;
  set: (patch: Partial<State> | ((s: State) => Partial<State>)) => void;
  toggleFavorite: (id: string) => void;
  reset: () => void;
}

const StoreCtx = createContext<Ctx | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(initial);
  const [loaded, setLoaded] = useState(false);
  const [backendReady, setBackendReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        const user =
          saved.user?.email?.toLowerCase() === "root@mima.local"
            ? { ...saved.user, name: "Kathyllin" }
            : saved.user;
        setState({
          ...initial,
          ...saved,
          user,
          favorites: (saved.favorites ?? []).filter((id: string) => !/^p(?:[1-9]|10)$/.test(id)),
          wishlist: (saved.wishlist ?? []).filter(
            (wish: WishItem) =>
              !["w1", "w2", "w3"].includes(wish.id) &&
              ![
                "Eau de Parfum Amber Noir 100ml",
                "Bolsa Estruturada Couro Vinho",
                "Sérum Glow Niacinamida",
              ].includes(wish.name),
          ),
          notifications: (saved.notifications ?? []).filter(
            (notification: AppNotification) =>
              !["n1", "n2", "n3", "n4", "n5"].includes(notification.id),
          ),
        });
      }
    } catch (error) {
      console.warn("Não foi possível recuperar o estado local", error);
    }
    fetch("/api/auth", { credentials: "include" })
      .then((response) =>
        response.ok ? (response.json() as Promise<{ user: User | null }>) : null,
      )
      .then(async (data) => {
        if (!data) return;
        if (!data.user) {
          setState((current) => ({ ...current, user: null }));
          setBackendReady(true);
          return;
        }
        const wishlistResponse = await fetch("/api/wishlist", { credentials: "include" });
        const wishlistData = wishlistResponse.ok
          ? ((await wishlistResponse.json()) as { items?: WishItem[] })
          : null;
        setState((current) => ({
          ...current,
          user: data.user,
          ...(wishlistData?.items
            ? {
                wishlist: wishlistData.items.filter(
                  (wish) =>
                    ![
                      "Eau de Parfum Amber Noir 100ml",
                      "Bolsa Estruturada Couro Vinho",
                      "Sérum Glow Niacinamida",
                    ].includes(wish.name),
                ),
              }
            : {}),
        }));
        setBackendReady(true);
      })
      .catch(() => setBackendReady(true));
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) localStorage.setItem(KEY, JSON.stringify(state));
  }, [state, loaded]);

  useEffect(() => {
    if (!backendReady || !state.user) return;
    void fetch("/api/wishlist", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ items: state.wishlist }),
    });
  }, [backendReady, state.user, state.wishlist]);

  const value = useMemo<Ctx>(
    () => ({
      ...state,
      plan: state.plans[state.planId],
      set: (patch) =>
        setState((s) => ({ ...s, ...(typeof patch === "function" ? patch(s) : patch) })),
      toggleFavorite: (id) =>
        setState((s) => ({
          ...s,
          favorites: s.favorites.includes(id)
            ? s.favorites.filter((f) => f !== id)
            : [...s.favorites, id],
        })),
      reset: () => {
        localStorage.removeItem(KEY);
        setState(initial);
      },
    }),
    [state],
  );

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export function useStore() {
  const c = useContext(StoreCtx);
  if (!c) throw new Error("useStore fora do StoreProvider");
  return c;
}
