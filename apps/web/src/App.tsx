import { useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { AppEntry, RequireRole } from './auth/AuthContext';
import { AppShell } from './components/AppShell';
import { MarketingLayout } from './marketing/MarketingLayout';
import Home from './marketing/Home';
import Features from './marketing/Features';
import Pricing from './marketing/Pricing';
import About, { Legal } from './marketing/About';
import Contact from './marketing/Contact';
import Login from './pages/Login';
import { Welcome, SocietyPicker } from './pages/Onboard';
import NotFound from './pages/NotFound';
import Dashboard from './pages/admin/Dashboard';
import AdminVisitors from './pages/admin/Visitors';
import Members from './pages/admin/Members';
import AdminStaff from './pages/admin/Staff';
import { AdminNotices, AdminPolls } from './pages/admin/Community';
import Helpdesk, { AdminTicket } from './pages/admin/Helpdesk';
import Amenities from './pages/admin/Amenities';
import { Billing, Expenses } from './pages/admin/Accounts';
import AdminSos from './pages/admin/Sos';
import Settings from './pages/admin/Settings';
import ResidentHome from './pages/resident/Home';
import ResidentVisitors from './pages/resident/Visitors';
import ResidentCommunity from './pages/resident/Community';
import Services, { ResidentTicket } from './pages/resident/Services';
import Payments from './pages/resident/Payments';
import Profile from './pages/resident/Profile';
import { GateVerify, GateLog, GatePending, GateExpected, GateInside, GateStaff, GateSos } from './pages/guard/Gate';

export default function App() {
  const { pathname } = useLocation();
  useEffect(() => window.scrollTo(0, 0), [pathname]);

  return (
    <Routes>
      <Route element={<MarketingLayout />}>
        <Route index element={<Home />} />
        <Route path="features" element={<Features />} />
        <Route path="pricing" element={<Pricing />} />
        <Route path="about" element={<About />} />
        <Route path="contact" element={<Contact />} />
        <Route path="privacy" element={<Legal kind="privacy" />} />
        <Route path="terms" element={<Legal kind="terms" />} />
      </Route>
      <Route path="login" element={<Login />} />

      <Route path="app">
        <Route index element={<AppEntry />} />
        <Route path="welcome" element={<Welcome />} />
        <Route path="societies" element={<SocietyPicker />} />

        <Route path="admin" element={<RequireRole role="ADMIN"><AppShell role="ADMIN" /></RequireRole>}>
          <Route index element={<Dashboard />} />
          <Route path="visitors" element={<AdminVisitors />} />
          <Route path="residents" element={<Members />} />
          <Route path="staff" element={<AdminStaff />} />
          <Route path="notices" element={<AdminNotices />} />
          <Route path="polls" element={<AdminPolls />} />
          <Route path="helpdesk" element={<Helpdesk />} />
          <Route path="helpdesk/:id" element={<AdminTicket />} />
          <Route path="amenities" element={<Amenities />} />
          <Route path="billing" element={<Billing />} />
          <Route path="expenses" element={<Expenses />} />
          <Route path="sos" element={<AdminSos />} />
          <Route path="settings" element={<Settings />} />
        </Route>

        <Route path="home" element={<RequireRole role="RESIDENT"><AppShell role="RESIDENT" /></RequireRole>}>
          <Route index element={<ResidentHome />} />
          <Route path="visitors" element={<ResidentVisitors />} />
          <Route path="community" element={<ResidentCommunity />} />
          <Route path="services" element={<Services />} />
          <Route path="services/tickets/:id" element={<ResidentTicket />} />
          <Route path="payments" element={<Payments />} />
          <Route path="profile" element={<Profile />} />
        </Route>

        <Route path="gate" element={<RequireRole role="GUARD"><AppShell role="GUARD" /></RequireRole>}>
          <Route index element={<GateVerify />} />
          <Route path="log" element={<GateLog />} />
          <Route path="pending" element={<GatePending />} />
          <Route path="expected" element={<GateExpected />} />
          <Route path="inside" element={<GateInside />} />
          <Route path="staff" element={<GateStaff />} />
          <Route path="sos" element={<GateSos />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
