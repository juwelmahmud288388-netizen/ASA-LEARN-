import React, { useEffect, useState } from 'react';
import { AiTutorWidget } from './components/AiTutorWidget';
import { Footer } from './components/Footer';
import { LanguageSelectorModal } from './components/LanguageSelectorModal';
import { Logo3DLoader } from './components/Logo3DLoader';
import { MobileBottomNav } from './components/MobileBottomNav';
import { Navbar } from './components/Navbar';
import { OfflineIndicator } from './components/PWAInstallButton';
import { StudentProfileModal } from './components/StudentProfileModal';
import { AppProvider, useApp } from './context/AppContext';
import { AdminDashboard } from './pages/AdminDashboard';
import { ForgotPasswordPage, LoginPage, RegisterPage } from './pages/AuthPages';
import { ClassDirectoryPage } from './pages/ClassDirectoryPage';
import { LandingPage } from './pages/LandingPage';
import { LeaderboardPage } from './pages/LeaderboardPage';
import { LessonPlayerPage } from './pages/LessonPlayerPage';
import { AboutPage, FeaturesPage, PolicyPage } from './pages/StaticPages';
import { StudentDashboard } from './pages/StudentDashboard';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

class AppErrorBoundary extends React.Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, message: error?.message || 'Unexpected rendering issue.' };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[70dvh] items-center justify-center px-4 py-12">
          <div className="glass-surface max-w-md rounded-3xl p-7 text-center">
            <h2 className="font-display text-xl font-bold text-[#172554] dark:text-[#BFE8FF]">
              Something went wrong
            </h2>
            <p className="mt-2 text-xs text-[#64748B] dark:text-slate-300">{this.state.message}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-5 rounded-xl bg-[#172554] px-5 py-2.5 text-sm font-semibold text-white transition active:scale-95 dark:bg-[#BFE8FF] dark:text-[#172554]"
            >
              Reload ASA,LEARN
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const RouterView: React.FC = () => {
  const { route } = useApp();
  const cleanRoute = route.split('?')[0] || '/';

  if (cleanRoute === '/' || cleanRoute === '') return <LandingPage />;
  if (cleanRoute === '/classes' || cleanRoute.startsWith('/classes/')) return <ClassDirectoryPage />;
  if (cleanRoute.startsWith('/lesson/')) return <LessonPlayerPage />;
  if (cleanRoute === '/dashboard') return <StudentDashboard />;
  if (cleanRoute === '/leaderboard') return <LeaderboardPage />;
  if (cleanRoute === '/admin') return <AdminDashboard />;
  if (cleanRoute === '/login') return <LoginPage />;
  if (cleanRoute === '/register') return <RegisterPage />;
  if (cleanRoute === '/forgot-password') return <ForgotPasswordPage />;
  if (cleanRoute === '/about') return <AboutPage />;
  if (cleanRoute === '/features') return <FeaturesPage />;
  if (cleanRoute === '/privacy') return <PolicyPage type="privacy" />;
  if (cleanRoute === '/terms') return <PolicyPage type="terms" />;
  return <LandingPage />;
};

const AppShell: React.FC = () => {
  const { route, authLoading, curriculumLoading, appSettings, language } = useApp();
  const [minDelayDone, setMinDelayDone] = useState(false);
  const [failsafeDone, setFailsafeDone] = useState(false);

  useEffect(() => {
    const t1 = window.setTimeout(() => setMinDelayDone(true), 1050);
    const t2 = window.setTimeout(() => setFailsafeDone(true), 1900);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, []);

  const showSplash = !failsafeDone && (!minDelayDone || authLoading || curriculumLoading);

  return (
    <>
      <Logo3DLoader
        visible={showSplash}
        logoUrl={appSettings.branding.logoUrl}
        siteName={appSettings.branding.siteName}
        language={language}
      />
      <div className="min-h-screen overflow-x-clip">
        <Navbar />
        <main className="min-h-[75dvh] pb-24 md:pb-0">
          <div key={route.split('?')[0] || '/'} className="page-enter">
            <AppErrorBoundary>
              <RouterView />
            </AppErrorBoundary>
          </div>
        </main>
        <Footer />
        <MobileBottomNav />
        <AiTutorWidget />
        <LanguageSelectorModal />
        <StudentProfileModal />
        <OfflineIndicator />
      </div>
    </>
  );
};

export default function App() {
  return (
    <AppProvider>
      <AppShell />
    </AppProvider>
  );
}
