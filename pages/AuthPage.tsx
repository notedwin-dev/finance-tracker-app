import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../services/auth.services";
import { AuthScreen } from "../components/AuthScreen";

const AuthPage: React.FC = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (profile.isLoggedIn) {
      navigate("/app", { replace: true });
    }
  }, [profile.isLoggedIn, navigate]);

  return (
    <div className="animate-fadeIn shadow-2xl">
      <AuthScreen />
    </div>
  );
};

export default AuthPage;
