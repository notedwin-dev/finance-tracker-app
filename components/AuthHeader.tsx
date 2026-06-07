import React from "react";

const zenLogo = "/images/ZenFinance.svg";

type Props = {
	isSignup: boolean;
};

export const AuthHeader = ({ isSignup }: Props) => (
	<div className="text-center mb-8">
		<div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-primary/20">
			<img src={zenLogo} alt="ZenFinance" className="w-10 h-10 object-contain" />
		</div>
		<h1 className="text-2xl font-bold text-white tracking-tight">
			{isSignup ? "Create Account" : "Welcome Back"}
		</h1>
		<p className="text-gray-400 text-sm mt-1">
			{isSignup ? "Start tracking your finance today" : "Sign in to your dashboard"}
		</p>
	</div>
);
