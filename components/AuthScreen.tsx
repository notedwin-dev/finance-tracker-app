import React, { useState } from "react";
import { useAuth } from "../services/auth.services";
import { AuthInput } from "./AuthInput";
import { AuthHeader } from "./AuthHeader";
import { AuthFooter } from "./AuthFooter";
import { GoogleAuthButton } from "./GoogleAuthButton";

export const AuthScreen: React.FC = () => {
	const {
		emailLogin,
		emailSignup,
		loginWithGoogle,
		loginOffline,
		isAuthLoading,
		authStatus,
	} = useAuth();
	const [isSignup, setIsSignup] = useState(false);
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [name, setName] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);
		setIsLoading(true);

		try {
			if (isSignup) {
				await emailSignup(email, password, name);
			} else {
				await emailLogin(email, password);
			}
		} catch (err: any) {
			setError(err.message || "Authentication failed");
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<div className="min-h-screen flex items-center justify-center bg-background p-4">
			<div className="w-full max-w-md bg-surface rounded-3xl p-8 border border-gray-800 shadow-2xl relative overflow-hidden">
				<div className="absolute top-0 left-0 w-full h-2 bg-primary"></div>

				<AuthHeader isSignup={isSignup} />

				<form onSubmit={handleSubmit} className="space-y-4">
					{isSignup && (
						<AuthInput
							id="auth-name"
							label="Full Name"
							icon="user"
							type="text"
							value={name}
							onChange={setName}
							placeholder="John Doe"
						/>
					)}

					<AuthInput
						id="auth-email"
						label="Email Address"
						icon="envelope"
						type="email"
						value={email}
						onChange={setEmail}
						placeholder="name@company.com"
					/>

					<AuthInput
						id="auth-password"
						label="Password"
						icon="lock"
						type="password"
						value={password}
						onChange={setPassword}
						placeholder="••••••••"
					/>

					{error && (
						<p className="text-red-500 text-xs text-center font-medium bg-red-500/10 py-2 rounded-lg border border-red-500/20 animate-shake">
							{error}
						</p>
					)}

					<button
						type="submit"
						disabled={isLoading}
						className={`w-full bg-primary hover:bg-primaryDark text-white font-bold py-3 rounded-xl shadow-lg shadow-indigo-500/20 transition-all active:scale-[0.98] ${isLoading ? "opacity-70 cursor-not-allowed" : ""}`}
					>
						{isLoading ? "Processing..." : isSignup ? "Sign Up" : "Sign In"}
					</button>
				</form>

				<div className="relative my-8">
					<div className="absolute inset-0 flex items-center">
						<div className="w-full border-t border-gray-800"></div>
					</div>
					<div className="relative flex justify-center text-xs">
						<span className="bg-surface px-2 text-gray-500 font-medium">
							OR CONTINUE WITH
						</span>
					</div>
				</div>

				<GoogleAuthButton
					isLoading={isLoading}
					isAuthLoading={isAuthLoading}
					authStatus={authStatus}
					onGoogleLogin={() => loginWithGoogle()}
				/>

				<button
					type="button"
					onClick={loginOffline}
					className="w-full mt-3 bg-card border border-gray-800 hover:border-gray-700 text-gray-400 hover:text-white font-bold py-3 rounded-xl flex items-center justify-center gap-3 transition-all active:scale-[0.98]"
				>
					Continue Offline
				</button>

				<AuthFooter isSignup={isSignup} onToggle={() => setIsSignup(!isSignup)} />
			</div>
		</div>
	);
};
