import { Link } from "wouter";
import { GitBranch, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center text-center px-6"
      style={{ background: "hsl(var(--background))" }}
    >
      <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
        <GitBranch className="w-8 h-8 text-primary" />
      </div>
      <h1 className="font-serif text-7xl font-bold text-primary/30 mb-2">404</h1>
      <h2 className="font-semibold text-xl mb-3">Page not found</h2>
      <p className="text-muted-foreground text-sm mb-8 max-w-sm">
        The page you're looking for doesn't exist or has been moved.
      </p>
      <Link href="/">
        <button className="flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity shadow-md">
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </button>
      </Link>
    </div>
  );
}
