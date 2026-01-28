import React from "react";
import { Link } from "react-router-dom";

const NotFound: React.FC = () => {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center text-center px-4">
      <h1 className="text-9xl font-black text-primary/20">404</h1>
      <div className="absolute">
        <h2 className="text-4xl font-black text-white mb-4 tracking-tighter">
          Lost in hyperspace?
        </h2>
        <p className="text-gray-400 mb-8 max-w-sm mx-auto">
          This page doesn't exist or has been moved to another dimension.
        </p>
        <Link
          to="/"
          className="inline-flex items-center px-6 py-3 bg-primary hover:bg-primary-dark text-white rounded-xl font-bold transition-all shadow-xl shadow-primary/20"
        >
          Back to Earth
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
