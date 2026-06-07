import React from "react";
import { Link } from "react-router-dom";

type Props = {
	isSignup: boolean;
	onToggle: () => void;
};

export const AuthFooter = ({ isSignup, onToggle }: Props) => (
	<>
		<p className="text-center text-gray-500 text-sm mt-8">
			{isSignup ? "Already have an account?" : "Don't have an account?"}
			<button
				type="button"
				onClick={onToggle}
				className="text-primary font-bold ml-1 hover:underline"
			>
				{isSignup ? "Sign In" : "Sign Up"}
			</button>
		</p>

		<div className="flex items-center justify-center gap-4 mt-8 pt-6 border-t border-gray-800 text-[10px] font-bold uppercase tracking-widest text-gray-600">
			<Link to="/privacy" className="hover:text-gray-400 transition-colors">
				Privacy Policy
			</Link>
			<Link to="/terms" className="hover:text-gray-400 transition-colors">
				Terms of Service
			</Link>
		</div>
	</>
);
