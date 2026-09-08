import type { ComponentType } from 'react';
import { Route, Switch, Redirect, useLocation } from 'wouter';
import { StoreProvider, useStore } from '@/data/store';
import { ToastProvider } from '@/components/ui';
import { AdminLayout } from '@/components/layout/admin-layout';
import { CrewLayout } from '@/components/layout/crew-layout';

import Dashboard from '@/pages/dashboard';
import Contracts from '@/pages/contracts';
import Tickets from '@/pages/tickets';
import Schedule from '@/pages/schedule';
import WorkOrders from '@/pages/work-orders';
import Backflow from '@/pages/backflow';
import InboxPage from '@/pages/inbox';
import Invoices from '@/pages/invoices';
import Estimates from '@/pages/estimates';
import Reports from '@/pages/reports';
import TimePage from '@/pages/time';
import Clients from '@/pages/clients';
import ClientDetail from '@/pages/client-detail';
import Services from '@/pages/services';
import Parts from '@/pages/parts';
import Team from '@/pages/team';
import Settings from '@/pages/settings';
import CrewDay from '@/pages/crew-day';
import CrewTicket from '@/pages/crew-ticket';
import CrewWorkOrder from '@/pages/crew-work-order';
import CrewBackflow from '@/pages/crew-backflow';

function Admin({ component: C }: { component: ComponentType }) {
  return (
    <AdminLayout>
      <C />
    </AdminLayout>
  );
}
function Crew({ component: C }: { component: ComponentType }) {
  return (
    <CrewLayout>
      <C />
    </CrewLayout>
  );
}

function Home() {
  const { role } = useStore();
  return <Redirect to={role === 'crew' ? '/my/day' : '/dashboard'} />;
}

function NotFound() {
  const [loc] = useLocation();
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="text-5xl font-black text-muted-foreground/30">404</div>
      <p className="mt-2 text-sm text-muted-foreground">
        Nothing at <code>{loc}</code>.
      </p>
    </div>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <ToastProvider>
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/dashboard">{() => <Admin component={Dashboard} />}</Route>
          <Route path="/contracts">{() => <Admin component={Contracts} />}</Route>
          <Route path="/tickets">{() => <Admin component={Tickets} />}</Route>
          <Route path="/schedule">{() => <Admin component={Schedule} />}</Route>
          <Route path="/work-orders">{() => <Admin component={WorkOrders} />}</Route>
          <Route path="/backflow">{() => <Admin component={Backflow} />}</Route>
          <Route path="/inbox">{() => <Admin component={InboxPage} />}</Route>
          <Route path="/invoices">{() => <Admin component={Invoices} />}</Route>
          <Route path="/estimates">{() => <Admin component={Estimates} />}</Route>
          <Route path="/reports">{() => <Admin component={Reports} />}</Route>
          <Route path="/time">{() => <Admin component={TimePage} />}</Route>
          <Route path="/clients">{() => <Admin component={Clients} />}</Route>
          <Route path="/clients/:id">{() => <Admin component={ClientDetail} />}</Route>
          <Route path="/services">{() => <Admin component={Services} />}</Route>
          <Route path="/parts">{() => <Admin component={Parts} />}</Route>
          <Route path="/team">{() => <Admin component={Team} />}</Route>
          <Route path="/settings">{() => <Admin component={Settings} />}</Route>

          <Route path="/my/day">{() => <Crew component={CrewDay} />}</Route>
          <Route path="/my/ticket">{() => <Crew component={CrewTicket} />}</Route>
          <Route path="/my/work-order">{() => <Crew component={CrewWorkOrder} />}</Route>
          <Route path="/my/backflow">{() => <Crew component={CrewBackflow} />}</Route>

          <Route>{() => <Admin component={NotFound} />}</Route>
        </Switch>
      </ToastProvider>
    </StoreProvider>
  );
}
