import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, ProtectedRoute, GatekeeperRoute } from "@/contexts/AuthContext";
import { Layout } from "@/components/Layout";
import NotFound from "@/pages/not-found";

import Login from "@/pages/login";
import Register from "@/pages/register";
import PendingApproval from "@/pages/pending-approval";
import Feed from "@/pages/feed";
import Tree from "@/pages/tree";
import Profile from "@/pages/profile";
import Gallery from "@/pages/gallery";
import Events from "@/pages/events";
import Capsules from "@/pages/capsules";
import Notifications from "@/pages/notifications";
import Chat from "@/pages/chat";
import Map from "@/pages/map";
import Gatekeeper from "@/pages/gatekeeper";
import SystemCockpit from "@/pages/system-cockpit";

const queryClient = new QueryClient();

function AuthenticatedApp() {
  return (
    <Layout>
      <Switch>
        <Route path="/feed" component={Feed} />
        <Route path="/tree" component={Tree} />
        <Route path="/profile/:memberId" component={Profile} />
        <Route path="/gallery" component={Gallery} />
        <Route path="/events" component={Events} />
        <Route path="/capsules" component={Capsules} />
        <Route path="/notifications" component={Notifications} />
        <Route path="/chat" component={Chat} />
        <Route path="/map" component={Map} />
        <Route path="/gatekeeper">
          <GatekeeperRoute>
            <Gatekeeper />
          </GatekeeperRoute>
        </Route>
        <Route path="/">
          <Redirect to="/feed" />
        </Route>
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/pending-approval" component={PendingApproval} />
      <Route path="/system-cockpit">
        <GatekeeperRoute>
          <SystemCockpit />
        </GatekeeperRoute>
      </Route>
      <Route path="/.*">
        <ProtectedRoute>
          <AuthenticatedApp />
        </ProtectedRoute>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthProvider>
            <Router />
          </AuthProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
