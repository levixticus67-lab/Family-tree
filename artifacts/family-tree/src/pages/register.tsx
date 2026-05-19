import { useLocation, Link } from "wouter";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRegisterUser } from "@workspace/api-client-react";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  displayName: z.string().min(2, "Name must be at least 2 characters"),
  inviteToken: z.string().optional(),
});

export default function Register() {
  const [, setLocation] = useLocation();
  const registerMutation = useRegisterUser();

  const urlToken = new URLSearchParams(window.location.search).get("token") ?? "";

  const form = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: { email: "", password: "", displayName: "", inviteToken: urlToken },
  });

  const onSubmit = (values: z.infer<typeof registerSchema>) => {
    registerMutation.mutate({ data: {
      ...values,
      inviteToken: values.inviteToken || null
    } }, {
      onSuccess: (res) => {
        localStorage.setItem("auth_token", res.token);
        if (res.user.status === "pending") {
          setLocation("/pending-approval");
        } else {
          window.location.href = "/feed";
        }
      },
      onError: (err: any) => {
        form.setError("root", { message: err?.message || "Registration failed" });
      }
    });
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 relative">
      <div className="glass-panel w-full max-w-md p-8 rounded-2xl relative z-10">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-sans font-bold text-primary mb-2 tracking-tight">Sanctuary</h1>
          <p className="text-muted-foreground text-sm">Request access to your family tree.</p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="displayName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name</FormLabel>
                  <FormControl>
                    <Input placeholder="John Doe" {...field} className="bg-background/50" />
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
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input placeholder="name@family.com" {...field} className="bg-background/50" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="••••••••" {...field} className="bg-background/50" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="inviteToken"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Invite Token (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Paste token if you have one" {...field} className="bg-background/50" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {form.formState.errors.root && (
              <p className="text-sm text-destructive font-medium">{form.formState.errors.root.message}</p>
            )}
            <Button type="submit" className="w-full" disabled={registerMutation.isPending}>
              {registerMutation.isPending ? "Submitting..." : "Request Access"}
            </Button>
          </form>
        </Form>

        <div className="mt-6 text-center text-sm text-muted-foreground">
          Already a member? <Link href="/login" className="text-primary hover:underline font-medium">Sign in</Link>
        </div>
      </div>
    </div>
  );
}
