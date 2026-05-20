import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import ThemeToggle from "@/components/ThemeToggle";
import { GitBranch, Users, User, Mail, Lock, ChevronRight, Check } from "lucide-react";

const schema = z.object({
  familyName: z.string().min(2, "Family name must be at least 2 characters"),
  displayName: z.string().min(2, "Your name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type FormData = z.infer<typeof schema>;

export default function Register() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (user) setLocation(user.role === "master_admin" ? "/admin" : "/app");
  }, [user, setLocation]);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { familyName: "", displayName: "", email: "", password: "", confirmPassword: "" },
  });

  const onSubmit = async (values: FormData) => {
    setIsPending(true);
    setError("");
    try {
      const res = await fetch("/api/auth/register-family", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          familyName: values.familyName,
          displayName: values.displayName,
          email: values.email,
          password: values.password,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Registration failed. Please try again.");
        return;
      }
      localStorage.setItem("auth_token", data.token);
      window.location.href = "/app";
    } catch {
      setError("Network error. Please check your connection.");
    } finally {
      setIsPending(false);
    }
  };

  const perks = [
    "Your own private family tree workspace",
    "Interactive drag-and-zoom family nodes",
    "Real-time family chat",
    "Invite family members via link",
  ];

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{ background: "hsl(var(--background))" }}
    >
      <div
        className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[700px] h-[500px] rounded-full opacity-10 blur-3xl pointer-events-none"
        style={{ background: "radial-gradient(circle, hsl(var(--primary)) 0%, transparent 70%)" }}
      />

      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-6 h-16">
        <Link href="/" className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
          <GitBranch className="w-4 h-4 text-primary" />
          Kinship
        </Link>
        <ThemeToggle />
      </div>

      <div className="relative z-10 w-full max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 pt-8 fade-up">
        {/* Left panel — perks */}
        <div className="hidden lg:flex flex-col justify-center pr-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-4">Free to Start</p>
          <h1 className="font-serif text-4xl font-bold leading-tight mb-6">
            Register your family's
            <span className="gradient-text"> private tree</span>
          </h1>
          <p className="text-muted-foreground mb-8 leading-relaxed">
            Your family gets its own isolated workspace. You're the admin — invite who you want, build your tree, chat in real time.
          </p>
          <ul className="space-y-3">
            {perks.map((p) => (
              <li key={p} className="flex items-center gap-3 text-sm">
                <div className="w-5 h-5 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
                  <Check className="w-3 h-3 text-primary" />
                </div>
                {p}
              </li>
            ))}
          </ul>
        </div>

        {/* Right panel — form */}
        <div
          className="rounded-2xl p-8 border border-border/60 shadow-2xl"
          style={{ background: "hsl(var(--card))" }}
        >
          <div className="mb-6">
            <h2 className="font-serif text-2xl font-bold mb-1">Create family account</h2>
            <p className="text-sm text-muted-foreground">You'll be the family administrator</p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="familyName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Family Name</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          placeholder="e.g. The Johnson Family"
                          {...field}
                          className="pl-10 bg-background/60 border-border/60 focus:border-primary/60"
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="displayName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Your Full Name</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          placeholder="John Johnson"
                          {...field}
                          className="pl-10 bg-background/60 border-border/60 focus:border-primary/60"
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Address</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          type="email"
                          placeholder="you@example.com"
                          {...field}
                          className="pl-10 bg-background/60 border-border/60 focus:border-primary/60"
                          autoComplete="email"
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            type="password"
                            placeholder="••••••••"
                            {...field}
                            className="pl-10 bg-background/60 border-border/60 focus:border-primary/60"
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirm</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            type="password"
                            placeholder="••••••••"
                            {...field}
                            className="pl-10 bg-background/60 border-border/60 focus:border-primary/60"
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {error && (
                <div className="rounded-lg px-4 py-3 text-sm bg-destructive/10 text-destructive border border-destructive/20">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                className="w-full h-11 font-semibold mt-2 shadow-lg glow-subtle"
                disabled={isPending}
              >
                {isPending ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                    Creating family…
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    Create Family Account
                    <ChevronRight className="w-4 h-4" />
                  </span>
                )}
              </Button>
            </form>
          </Form>

          <div className="mt-5 text-center">
            <p className="text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link href="/login" className="text-primary hover:underline font-medium">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
