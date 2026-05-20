import { useEffect, useRef } from "react";
import { useLocation, Link } from "wouter";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useAuth } from "@/contexts/AuthContext";
import ThemeToggle from "@/components/ThemeToggle";
import {
  GitBranch, Users, MessageSquare, Shield, ChevronRight,
  TreePine, Star, Zap, Globe
} from "lucide-react";

gsap.registerPlugin(ScrollTrigger);

const FEATURES = [
  {
    icon: TreePine,
    title: "Interactive Family Tree",
    desc: "Drag, zoom, and explore your family network. Every member is a clickable card connected by relationship lines across generations.",
  },
  {
    icon: Users,
    title: "Multi-Family Networks",
    desc: "Each family registers independently. Link in-laws and outside lineages seamlessly — your tree grows as your family does.",
  },
  {
    icon: MessageSquare,
    title: "Family Chat",
    desc: "Real-time family messaging with direct messages, group chat, photo sharing, and presence indicators.",
  },
  {
    icon: Shield,
    title: "Private & Secure",
    desc: "Every family account is isolated. A gatekeeper controls access. Your heritage stays yours.",
  },
];

const STEPS = [
  { n: "01", title: "Create Your Family Account", desc: "Register with your family name and an admin email. Your account is active instantly." },
  { n: "02", title: "Build Your Tree", desc: "Add family members, drag them into place, and draw the parent, child, and spouse connections." },
  { n: "03", title: "Invite Your Family", desc: "Generate invite links for relatives. They join your private family network." },
  { n: "04", title: "Explore Your Heritage", desc: "Zoom, search, and click into profiles. Chat in real time. Discover how everyone is connected." },
];

export default function Landing() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const heroRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (user) {
      setLocation(user.role === "master_admin" ? "/admin" : "/app");
    }
  }, [user, setLocation]);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

      tl.from(".hero-eyebrow", { opacity: 0, y: 24, duration: 0.7 })
        .from(".hero-title", { opacity: 0, y: 60, duration: 1 }, "-=0.4")
        .from(".hero-sub", { opacity: 0, y: 32, duration: 0.8 }, "-=0.5")
        .from(".hero-cta", { opacity: 0, y: 20, stagger: 0.12, duration: 0.6 }, "-=0.4")
        .from(".hero-visual", { opacity: 0, scale: 0.92, duration: 1.2, ease: "back.out(1.3)" }, "-=0.8");

      gsap.from(navRef.current, { opacity: 0, y: -20, duration: 0.8, ease: "power2.out" });

      gsap.utils.toArray<HTMLElement>(".reveal-up").forEach((el) => {
        gsap.from(el, {
          opacity: 0,
          y: 50,
          duration: 0.8,
          ease: "power2.out",
          scrollTrigger: {
            trigger: el,
            start: "top 85%",
            toggleActions: "play none none none",
          },
        });
      });

      gsap.utils.toArray<HTMLElement>(".reveal-stagger").forEach((container) => {
        const children = container.querySelectorAll(".stagger-child");
        gsap.from(children, {
          opacity: 0,
          y: 40,
          stagger: 0.15,
          duration: 0.7,
          ease: "power2.out",
          scrollTrigger: {
            trigger: container,
            start: "top 80%",
            toggleActions: "play none none none",
          },
        });
      });

      gsap.utils.toArray<HTMLElement>(".parallax-bg").forEach((el) => {
        gsap.to(el, {
          yPercent: -20,
          ease: "none",
          scrollTrigger: {
            trigger: el,
            start: "top bottom",
            end: "bottom top",
            scrub: 1.5,
          },
        });
      });
    }, heroRef);

    return () => ctx.revert();
  }, []);

  return (
    <div
      ref={heroRef}
      className="min-h-screen overflow-x-hidden"
      style={{ background: "hsl(var(--background))" }}
    >
      {/* NAV */}
      <nav
        ref={navRef}
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 md:px-12 h-16 glass border-b border-border/40"
      >
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
            <GitBranch className="w-4 h-4 text-primary" />
          </div>
          <span className="font-semibold text-lg tracking-tight">Kinship</span>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link href="/login">
            <button className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Sign In
            </button>
          </Link>
          <Link href="/register">
            <button className="px-5 py-2 text-sm font-semibold rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity shadow-md glow-subtle">
              Get Started
            </button>
          </Link>
        </div>
      </nav>

      {/* ─── HERO ─────────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex flex-col items-center justify-center text-center px-6 pt-16 overflow-hidden">
        {/* Ambient orbs */}
        <div
          className="parallax-bg absolute top-1/4 -left-32 w-96 h-96 rounded-full opacity-20 blur-3xl pointer-events-none"
          style={{ background: "radial-gradient(circle, hsl(var(--primary)) 0%, transparent 70%)" }}
        />
        <div
          className="parallax-bg absolute bottom-1/4 -right-32 w-96 h-96 rounded-full opacity-15 blur-3xl pointer-events-none"
          style={{ background: "radial-gradient(circle, hsl(250, 80%, 60%) 0%, transparent 70%)" }}
        />

        <div className="relative z-10 max-w-4xl mx-auto">
          <p className="hero-eyebrow inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-primary mb-6 px-4 py-2 rounded-full bg-primary/10 border border-primary/20">
            <Star className="w-3 h-3" /> Multi-Family Heritage Platform
          </p>

          <h1 className="hero-title font-serif text-5xl md:text-7xl lg:text-8xl font-bold leading-[1.05] mb-6">
            Your Family's
            <br />
            <span className="gradient-text">Living Story</span>
          </h1>

          <p className="hero-sub text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed mb-10">
            Build an interactive, draggable family tree. Connect generations, preserve memories,
            and share your heritage — all in one cinematic, private space.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/register">
              <button className="hero-cta flex items-center gap-2 px-8 py-4 rounded-xl bg-primary text-primary-foreground text-base font-semibold hover:opacity-90 transition-all duration-200 shadow-lg glow-primary">
                Start Your Family Tree
                <ChevronRight className="w-4 h-4" />
              </button>
            </Link>
            <Link href="/login">
              <button className="hero-cta flex items-center gap-2 px-8 py-4 rounded-xl border border-border text-foreground text-base font-medium hover:bg-card/80 transition-all duration-200">
                Sign In to My Account
              </button>
            </Link>
          </div>
        </div>

        {/* Hero visual — mini-tree preview */}
        <div className="hero-visual relative z-10 mt-20 max-w-3xl w-full mx-auto">
          <div
            className="rounded-2xl border border-border/60 overflow-hidden shadow-2xl"
            style={{ background: "hsl(var(--card))", boxShadow: "0 24px 80px rgba(0,0,0,0.5)" }}
          >
            {/* Fake toolbar */}
            <div className="flex items-center gap-2 px-5 py-3 border-b border-border/50" style={{ background: "hsl(var(--background) / 0.8)" }}>
              <div className="w-3 h-3 rounded-full bg-red-500/70" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
              <div className="w-3 h-3 rounded-full bg-green-500/70" />
              <span className="ml-3 text-xs text-muted-foreground font-mono">kinship.app — Family Tree</span>
            </div>
            {/* Preview canvas */}
            <div className="relative h-64 overflow-hidden bg-dot-pattern">
              {[
                { label: "James Sr.", x: 120, y: 30, color: "sky" },
                { label: "Mary", x: 290, y: 30, color: "rose" },
                { label: "James Jr.", x: 80, y: 130, color: "sky" },
                { label: "Emily", x: 240, y: 130, color: "rose" },
                { label: "Lucas", x: 390, y: 130, color: "sky" },
                { label: "Olivia", x: 160, y: 220, color: "violet" },
              ].map((n) => (
                <div
                  key={n.label}
                  className="absolute glass rounded-xl px-4 py-2 text-xs font-medium border"
                  style={{
                    left: n.x,
                    top: n.y,
                    borderColor: `hsl(var(--primary) / 0.4)`,
                    color: "hsl(var(--foreground))",
                    whiteSpace: "nowrap",
                  }}
                >
                  {n.label}
                </div>
              ))}
              {/* Connecting lines */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ opacity: 0.4 }}>
                <line x1="205" y1="46" x2="205" y2="130" stroke="hsl(var(--primary))" strokeWidth="1.5" strokeDasharray="4,3" />
                <line x1="120" y1="46" x2="120" y2="130" stroke="hsl(var(--primary))" strokeWidth="1.5" strokeDasharray="4,3" />
                <line x1="290" y1="46" x2="415" y2="130" stroke="hsl(var(--primary))" strokeWidth="1.5" strokeDasharray="4,3" />
                <line x1="108" y1="146" x2="185" y2="220" stroke="hsl(var(--primary))" strokeWidth="1.5" strokeDasharray="4,3" />
              </svg>
            </div>
          </div>
        </div>
      </section>

      {/* ─── FEATURES ─────────────────────────────────────────────── */}
      <section className="relative py-28 px-6" style={{ background: "hsl(var(--card))" }}>
        <div className="max-w-6xl mx-auto">
          <div className="reveal-up text-center mb-16">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-3">Everything You Need</p>
            <h2 className="font-serif text-4xl md:text-5xl font-bold">Built for your family's story</h2>
          </div>

          <div className="reveal-stagger grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="stagger-child rounded-2xl border border-border/50 p-6 hover:border-primary/40 hover:shadow-lg transition-all duration-300 group"
                style={{ background: "hsl(var(--background))" }}
              >
                <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <f.icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-semibold text-base mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── HOW IT WORKS ─────────────────────────────────────────── */}
      <section className="relative py-28 px-6 overflow-hidden">
        <div
          className="parallax-bg absolute top-0 right-0 w-[600px] h-[600px] rounded-full opacity-5 blur-3xl pointer-events-none"
          style={{ background: "radial-gradient(circle, hsl(var(--primary)) 0%, transparent 70%)" }}
        />
        <div className="max-w-4xl mx-auto">
          <div className="reveal-up text-center mb-16">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-3">Simple Process</p>
            <h2 className="font-serif text-4xl md:text-5xl font-bold">Four steps to your legacy</h2>
          </div>

          <div className="reveal-stagger space-y-6">
            {STEPS.map((s, i) => (
              <div
                key={s.n}
                className="stagger-child flex items-start gap-6 p-6 rounded-2xl border border-border/50 hover:border-primary/30 transition-colors"
                style={{ background: "hsl(var(--card))" }}
              >
                <div
                  className="flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center text-sm font-bold font-mono"
                  style={{ background: "hsl(var(--primary) / 0.12)", color: "hsl(var(--primary))" }}
                >
                  {s.n}
                </div>
                <div>
                  <h3 className="font-semibold text-base mb-1">{s.title}</h3>
                  <p className="text-sm text-muted-foreground">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── STATS ────────────────────────────────────────────────── */}
      <section className="py-20 px-6" style={{ background: "hsl(var(--card))" }}>
        <div className="max-w-4xl mx-auto">
          <div className="reveal-stagger grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            {[
              { icon: Globe, value: "Multi-Family", label: "Each family is independent & private" },
              { icon: Zap, value: "Real-Time", label: "Live chat and presence updates" },
              { icon: Shield, value: "Secure", label: "JWT auth, role-based access control" },
            ].map((s) => (
              <div key={s.label} className="stagger-child">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <s.icon className="w-5 h-5 text-primary" />
                </div>
                <p className="font-serif text-2xl font-bold mb-1">{s.value}</p>
                <p className="text-sm text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA ──────────────────────────────────────────────────── */}
      <section className="relative py-32 px-6 text-center overflow-hidden">
        <div
          className="parallax-bg absolute inset-0 opacity-10 pointer-events-none"
          style={{ background: "radial-gradient(ellipse at center, hsl(var(--primary)) 0%, transparent 60%)" }}
        />
        <div className="reveal-up relative z-10 max-w-2xl mx-auto">
          <h2 className="font-serif text-4xl md:text-5xl font-bold mb-6">
            Ready to preserve your family's legacy?
          </h2>
          <p className="text-lg text-muted-foreground mb-10">
            Join families already building their trees on Kinship. Free to start.
          </p>
          <Link href="/register">
            <button className="inline-flex items-center gap-2 px-10 py-5 rounded-xl bg-primary text-primary-foreground text-lg font-semibold hover:opacity-90 transition-all shadow-xl glow-primary">
              Register Your Family
              <ChevronRight className="w-5 h-5" />
            </button>
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-border/40 py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <GitBranch className="w-4 h-4 text-primary" />
            <span className="font-medium text-foreground">Kinship</span>
            <span>— Family Tree Platform</span>
          </div>
          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} Kinship. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
