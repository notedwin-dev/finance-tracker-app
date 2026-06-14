import React from "react";
import { Link } from "react-router-dom";
import { ChevronLeftIcon } from "@heroicons/react/24/outline";

type LegalDocumentLayoutProps = {
	title: string;
	lastUpdated: string;
	children: React.ReactNode;
};

export const LegalDocumentLayout: React.FC<LegalDocumentLayoutProps> = ({
	title,
	lastUpdated,
	children,
}) => (
	<div className="min-h-screen bg-background text-gray-300 py-12 px-4 sm:px-6 lg:px-8">
		<div className="max-w-3xl mx-auto">
			<Link
				to="/"
				className="inline-flex items-center text-primary hover:text-primary-dark mb-8 transition-colors"
			>
				<ChevronLeftIcon className="w-4 h-4 mr-2" />
				Back to Home
			</Link>

			<h1 className="text-4xl font-black text-white mb-2">{title}</h1>
			<p className="text-gray-500 mb-8 uppercase tracking-widest text-sm font-bold">
				Last Updated: {lastUpdated}
			</p>

			<div className="prose prose-invert prose-primary max-w-none space-y-8">
				{children}
			</div>
		</div>
	</div>
);
