import React from "react";

type Props = {
	isLoading: boolean;
	isAuthLoading: boolean;
	authStatus: string;
	onGoogleLogin: () => void;
};

export const GoogleAuthButton = ({ isLoading, isAuthLoading, authStatus, onGoogleLogin }: Props) => {
	const disabled = isAuthLoading || isLoading;
	return (
		<button
			type="button"
			onClick={onGoogleLogin}
			disabled={disabled}
			className={`w-full bg-white hover:bg-gray-100 text-gray-900 font-bold py-3 rounded-xl flex items-center justify-center gap-3 transition-all active:scale-[0.98] ${disabled ? "opacity-70 cursor-not-allowed" : ""}`}
		>
			{isAuthLoading ? (
				<div className="w-5 h-5 border-2 border-gray-400 border-t-gray-900 rounded-full animate-spin" />
			) : (
				<img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
			)}
			{isAuthLoading ? authStatus || "Authenticating..." : "Google Account"}
		</button>
	);
};
