import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

export function WelcomePage() {
  const { isAuthenticated, isLoading } = useAuth();

  if (!isLoading && isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen bg-[#FCF9F8] flex flex-col items-center px-6">
      {/* Logo area */}
      <div className="flex flex-col items-center mt-24 mb-8">
        <div className="anim-logo w-44 h-44 mb-8">
          <img
            src="/packplay-logo.jpg"
            alt="PackPlay"
            className="w-full h-full object-contain"
            style={{ mixBlendMode: 'multiply' }}
          />
        </div>

        <h1 className="anim-heading font-headline font-bold text-[28px] text-[#1A1A1A] uppercase tracking-tight text-center">
          PACKPLAY
        </h1>

        <p className="anim-quote font-body text-sm text-[#5C4037] text-center italic mt-3 max-w-[270px] leading-relaxed">
          "Precision in the locker room is performance on the field. Readiness is the teammate that never fails."
        </p>

        <div className="anim-divider w-10 h-0.5 bg-primary mt-5" />
      </div>

      {/* Buttons pinned toward bottom */}
      <div className="anim-buttons w-full max-w-[390px] flex flex-col gap-3 mt-auto mb-10">
        <Link
          to="/login"
          className="w-full min-h-[52px] bg-[#1A1A1A] text-white font-headline font-bold text-xs uppercase tracking-widest flex items-center justify-center"
        >
          LOGIN
        </Link>

        <Link
          to="/register"
          className="w-full min-h-[52px] border border-[#1A1A1A] bg-transparent text-[#1A1A1A] font-headline font-bold text-xs uppercase tracking-widest flex items-center justify-center"
        >
          REGISTER
        </Link>

        <p className="anim-footer font-headline text-[9px] text-[#916F65] tracking-[0.18em] text-center mt-4 uppercase">
          System v2.4.0
        </p>
      </div>
    </div>
  );
}
