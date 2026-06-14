import React from "react";

type LegalSectionProps = {
	title: string;
	children: React.ReactNode;
};

export const LegalSection: React.FC<LegalSectionProps> = ({
	title,
	children,
}) => (
	<section>
		<h2 className="text-2xl font-bold text-white mb-4">{title}</h2>
		{children}
	</section>
);
