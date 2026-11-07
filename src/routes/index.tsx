import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowDown, ArrowRight, Heart, Scale, Sparkles } from "lucide-react";
import hero from "@/assets/mima-landing.jpg";
import perfume from "@/assets/p-perfume.jpg";
import makeup from "@/assets/p-makeup.jpg";
import skincare from "@/assets/p-skincare.jpg";
import { BrandLogo } from "@/components/app/BrandLogo";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Mimá — Perfumaria & Beleza, do seu jeito" },
      {
        name: "description",
        content:
          "Um novo olhar para seus desejos. Descubra perfumes, beleza e alternativas que combinam com você na Mimá.",
      },
      { property: "og:title", content: "Mimá — Perfumaria & Beleza, do seu jeito" },
      {
        property: "og:description",
        content:
          "Apaixone-se pelas descobertas. Perfumes, beleza e compras mais conscientes em um só lugar.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const COLLECTIONS = [
  { title: "Perfumes", caption: "Uma assinatura só sua.", image: perfume },
  { title: "Maquiagem", caption: "Beleza sem pedir licença.", image: makeup },
  { title: "Skincare", caption: "Seu momento de cuidado.", image: skincare },
];
const JOURNEY = [
  {
    number: "01",
    title: "Guarde o que faz seus olhos brilharem",
    text: "Seus favoritos, juntos em uma lista só sua.",
    to: "/desejos",
  },
  {
    number: "02",
    title: "Encontre novas versões do seu favorito",
    text: "Explore o universo dos dupes e suas possibilidades.",
    to: "/dupes",
  },
  {
    number: "03",
    title: "Dê atenção à sua próxima escolha",
    text: "Uma assistente para acompanhar suas descobertas.",
    to: "/assistente",
  },
] as const;

function Landing() {
  return (
    <div className="landing-page">
      <header className="border-b bg-background">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-4 px-6 md:px-10">
          <Link
            to="/"
            aria-label="Mimá — início"
            className="flex items-center gap-2.5 text-primary"
          >
            <BrandLogo className="h-12 w-[108px]" />
          </Link>
          <nav aria-label="Navegação principal" className="hidden items-center gap-8 md:flex">
            <Button asChild variant="link" className="px-0 text-foreground">
              <Link to="/explorar">Descobertas</Link>
            </Button>
            <Button asChild variant="link" className="px-0 text-foreground">
              <Link to="/dupes">Universo dos dupes</Link>
            </Button>
            <Button asChild variant="link" className="px-0 text-foreground">
              <Link to="/planos">Planos</Link>
            </Button>
          </nav>
          <Button
            asChild
            variant="outline"
            className="rounded-full border-primary/25 px-5 text-primary"
          >
            <Link to="/entrar">
              Entrar <ArrowRight />
            </Link>
          </Button>
        </div>
      </header>
      <main>
        <section className="landing-hero relative isolate overflow-hidden bg-primary-glow text-primary-foreground">
          <img
            src={hero}
            alt="Perfume, maquiagem bordô e uma flor branca em uma composição sofisticada"
            width={1920}
            height={1280}
            fetchPriority="high"
            className="landing-hero-image absolute inset-0 -z-20 h-full w-full object-cover"
          />
          <div className="absolute inset-0 -z-10 bg-primary-glow/30 md:bg-transparent" />
          <div className="mx-auto flex h-full max-w-7xl flex-col justify-center px-6 pb-16 pt-8 md:px-10">
            <div className="landing-intro max-w-lg">
              <p className="mb-5 flex items-center gap-2 text-[10px] font-medium uppercase md:text-xs">
                <span className="h-px w-7 bg-primary-foreground/60" /> O prazer de se descobrir
              </p>
              <h1 className="font-display text-6xl font-medium leading-none md:text-8xl">
                Mimá<span className="text-blush">.</span>
              </h1>
              <p className="mt-5 font-display text-[27px] font-medium leading-tight md:text-4xl">
                Seus desejos.
                <br />
                Um novo jeito de escolher.
              </p>
              <p className="mt-4 max-w-64 text-xs leading-relaxed text-primary-foreground/85 md:max-w-80 md:text-sm">
                Perfumes que encantam. Beleza que inspira. Descobertas que fazem sentido para você.
              </p>
              <Button
                asChild
                size="lg"
                variant="secondary"
                className="mt-6 h-12 rounded-full bg-background px-6 text-primary hover:bg-blush"
              >
                <Link to="/explorar">
                  Quero descobrir <ArrowRight />
                </Link>
              </Button>
            </div>
          </div>
          <span className="absolute bottom-6 left-6 flex items-center gap-2 text-[10px] uppercase text-primary-foreground/75 md:left-10">
            <ArrowDown className="size-3" /> Um universo de possibilidades
          </span>
          <span className="absolute bottom-6 right-10 hidden font-display text-sm italic text-primary-foreground/75 md:block">
            Beleza, com intenção.
          </span>
        </section>
        <div className="border-b bg-background">
          <div className="mx-auto grid max-w-7xl grid-cols-3 gap-3 px-6 py-6 md:px-10 md:py-8">
            {[
              { icon: Heart, label: "Desejos com propósito" },
              { icon: Scale, label: "Escolhas inteligentes" },
              { icon: Sparkles, label: "Novas possibilidades" },
            ].map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex flex-col items-center gap-2 text-center text-[10px] font-medium text-primary md:flex-row md:justify-center md:gap-3 md:text-sm"
              >
                <Icon className="size-5 shrink-0" strokeWidth={1.4} />
                {label}
              </div>
            ))}
          </div>
        </div>
        <section className="mx-auto max-w-7xl px-6 py-14 md:px-10 md:py-20">
          <div className="mb-8 flex items-end justify-between gap-4">
            <div>
              <p className="mb-3 text-[10px] font-semibold uppercase text-muted-foreground">
                O universo Mimá
              </p>
              <h2 className="font-display text-3xl font-medium leading-tight text-primary md:text-4xl">
                Qual é o seu próximo encanto?
              </h2>
            </div>
            <Button asChild variant="link" className="hidden shrink-0 px-0 md:inline-flex">
              <Link to="/explorar">
                Explorar tudo <ArrowRight />
              </Link>
            </Button>
          </div>
          <div className="grid gap-8 sm:grid-cols-3">
            {COLLECTIONS.map((collection, index) => (
              <Link key={collection.title} to="/explorar" className="group block">
                <div className="overflow-hidden bg-muted">
                  <img
                    src={collection.image}
                    alt={collection.title}
                    width={1024}
                    height={1024}
                    loading="lazy"
                    className="aspect-[4/5] w-full object-cover transition-transform duration-700 motion-safe:group-hover:scale-105"
                  />
                </div>
                <div className="mt-4 flex items-center justify-between gap-3">
                  <h3 className="font-display text-2xl text-primary">{collection.title}</h3>
                  <ArrowRight className="size-5 text-primary" strokeWidth={1.5} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  <span className="mr-2 text-primary/50">0{index + 1}</span>
                  {collection.caption}
                </p>
              </Link>
            ))}
          </div>
        </section>
        <section className="border-y bg-secondary">
          <div className="mx-auto grid max-w-7xl gap-10 px-6 py-14 md:grid-cols-2 md:gap-20 md:px-10 md:py-20">
            <div>
              <BrandLogo className="mb-5 h-12 w-[108px]" />
              <p className="mb-3 text-[10px] font-semibold uppercase text-muted-foreground">
                Menos impulso. Mais você.
              </p>
              <h2 className="font-display text-4xl font-medium leading-tight text-primary">
                Desejar é bom.
                <br />
                Escolher bem é melhor.
              </h2>
              <p className="mt-5 max-w-sm text-sm leading-relaxed text-muted-foreground">
                Seu gosto merece espaço. Seu orçamento, respeito. Encontre um jeito mais leve de
                transformar vontade em escolha.
              </p>
              <Button asChild variant="link" className="mt-4 px-0">
                <Link to="/desejos">
                  Começar minha lista <ArrowRight />
                </Link>
              </Button>
            </div>
            <div className="divide-y divide-primary/15">
              {JOURNEY.map((item) => (
                <Link
                  key={item.number}
                  to={item.to}
                  className="group flex items-start gap-4 py-6 first:pt-0"
                >
                  <span className="pt-1 text-xs text-primary/50">{item.number}</span>
                  <div className="flex-1">
                    <h3 className="font-display text-xl text-primary">{item.title}</h3>
                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                      {item.text}
                    </p>
                  </div>
                  <ArrowRight className="mt-1 size-4 shrink-0 text-primary transition-transform motion-safe:group-hover:translate-x-1" />
                </Link>
              ))}
            </div>
          </div>
        </section>
        <section className="px-6 py-16 text-center md:py-24">
          <p className="mb-4 text-[10px] font-semibold uppercase text-muted-foreground">
            Um convite para você
          </p>
          <h2 className="font-display text-4xl font-medium leading-tight text-primary md:text-5xl">
            Seu próximo favorito
            <br />
            pode estar aqui.
          </h2>
          <Button asChild size="lg" className="mt-7 h-12 rounded-full px-7">
            <Link to="/explorar">
              Entrar no universo Mimá <ArrowRight />
            </Link>
          </Button>
        </section>
      </main>
      <footer className="border-t px-6 py-7 md:px-10">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <Link to="/" className="flex items-center gap-2 text-primary">
            <BrandLogo className="h-9 w-[80px]" />
          </Link>
          <p className="text-[10px] leading-relaxed text-muted-foreground">
            Mimá · Perfumaria & Beleza
          </p>
          <span className="text-[10px] text-muted-foreground">Perfumaria & Beleza</span>
        </div>
      </footer>
    </div>
  );
}
