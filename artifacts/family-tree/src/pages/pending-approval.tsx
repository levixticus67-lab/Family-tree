import { Link } from "wouter";
import { Shield, ArrowLeft } from "lucide-react";

export default function PendingApproval() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 relative">
      <div className="glass-panel w-full max-w-lg p-10 rounded-2xl relative z-10 text-center">
        <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
          <Shield className="w-10 h-10 text-primary" />
        </div>
        
        <h1 className="text-3xl font-sans font-bold text-foreground mb-4 tracking-tight">Sanctuary is Private</h1>
        <p className="text-muted-foreground mb-8 leading-relaxed">
          Your request to join has been securely routed to your family's Gatekeeper. Because this space holds personal memories and lineage, every new member must be verified. You'll receive an email as soon as your access is approved.
        </p>

        <Link href="/login" className="inline-flex items-center text-sm font-medium text-primary hover:underline">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Return to Sign In
        </Link>
      </div>
    </div>
  );
}
