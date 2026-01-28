import React, { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../services/auth.services";
import {
  SparklesIcon,
  ShieldCheckIcon,
  CloudArrowUpIcon,
  DevicePhoneMobileIcon,
} from "@heroicons/react/24/outline";

const LandingPage: React.FC = () => {
  const { profile, loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (profile.isLoggedIn) {
      navigate("/app", { replace: true });
    }
  }, [profile.isLoggedIn, navigate]);

  const handleLaunchApp = () => {
    if (profile.isLoggedIn) {
      navigate("/app");
    } else {
      loginWithGoogle();
    }
  };

  return (
    <div className="min-h-screen bg-background text-white selection:bg-primary/30">
      {/* Navigation */}
      <nav className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between border-b border-gray-900">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <SparklesIcon className="w-5 h-5 text-white" />
          </div>
          <span className="font-black text-xl tracking-tight">ZenFinance</span>
        </div>
        <div className="flex items-center gap-8">
          <button
            onClick={handleLaunchApp}
            className="bg-primary hover:bg-primary-dark text-white px-5 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-primary/20 active:scale-95 cursor-pointer"
          >
            Launch App
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-6 pt-20 pb-32 text-center lg:text-left grid lg:grid-cols-2 gap-12 items-center">
        <div className="space-y-8 animate-fadeIn">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-black uppercase tracking-widest">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
            Available Now
          </div>
          <h1 className="text-5xl md:text-7xl font-black leading-tight tracking-tighter">
            Your Finance. <br />
            <span className="text-primary italic">Your Data.</span> <br />
            Your Sovereignty.
          </h1>
          <p className="text-gray-400 text-lg md:text-xl max-w-xl mx-auto lg:mx-0 leading-relaxed">
            A powerful, private finance tracker that stores your data in your
            own Google Sheets. AI-powered insights meets decentralized storage.
          </p>
          <div className="flex flex-col sm:flex-row items-center gap-4 pt-4">
            <button
              onClick={handleLaunchApp}
              className="w-full sm:w-auto px-8 py-4 bg-primary hover:bg-primary-dark text-white rounded-2xl font-black text-lg transition-all shadow-xl shadow-primary/25 text-center cursor-pointer"
            >
              Start Tracking Free
            </button>
            <p className="text-gray-500 text-sm font-bold uppercase tracking-widest">
              No credit card. No subscription.
            </p>
          </div>
        </div>
        <div className="relative group perspective-1000 hidden lg:block">
          <div className="w-full aspect-square bg-gradient-to-br from-primary/20 to-secondary/20 rounded-[3rem] border border-white/10 flex items-center justify-center overflow-hidden rotate-3 group-hover:rotate-0 transition-transform duration-700 shadow-2xl">
            <div className="absolute inset-0 bg-[url('https://notedwin.dev/grid.svg')] bg-center opacity-30"></div>
            <SparklesIcon className="w-48 h-48 text-primary/40" />
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="bg-surface py-32">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-20 space-y-4">
            <h2 className="text-3xl md:text-5xl font-black">
              Built for Privacy
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              We believe your financial history is yours alone. ZenFinance is
              designed so we never even see your balance.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 text-center sm:text-left">
            {[
              {
                icon: ShieldCheckIcon,
                title: "Data Sovereignty",
                desc: "Your data is stored in your personal Google Sheet. You own it forever. We never see it.",
              },
              {
                icon: SparklesIcon,
                title: "AI Insights",
                desc: "Get personalized financial advice from Gemini 2.0 Flash based on your real spending habits.",
              },
              {
                icon: CloudArrowUpIcon,
                title: "Real-time Sync",
                desc: "Edit your sheet manually or use our app—everything stays in sync across all your devices.",
              },
            ].map((feature, i) => (
              <div
                key={i}
                className="p-8 bg-background border border-gray-800 rounded-3xl hover:border-primary/50 transition-colors group"
              >
                <feature.icon className="w-12 h-12 text-primary mb-6 group-hover:scale-110 transition-transform" />
                <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
                <p className="text-gray-400 leading-relaxed text-sm">
                  {feature.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-20 px-6 border-t border-gray-900">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-12">
          <div className="space-y-4 text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-2">
              <SparklesIcon className="w-6 h-6 text-primary" />
              <span className="font-black text-xl">ZenFinance</span>
            </div>
            <p className="text-gray-500 text-sm font-medium">
              Developed by{" "}
              <a
                href="https://notedwin.dev"
                className="text-white hover:text-primary transition-colors"
              >
                Edwin Ng
              </a>
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-8 text-sm font-bold uppercase tracking-widest text-gray-500">
            <Link to="/privacy" className="hover:text-white transition-colors">
              Privacy
            </Link>
            <Link to="/terms" className="hover:text-white transition-colors">
              Terms
            </Link>
            <a
              href="https://github.com/notedwin"
              className="hover:text-white transition-colors"
            >
              GitHub
            </a>
          </div>
        </div>
        <div className="max-w-7xl mx-auto mt-12 text-center text-gray-600 text-xs uppercase tracking-[0.3em] font-black">
          © 2026 ZenFinance. No Rights Reserved. It's your app.
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
