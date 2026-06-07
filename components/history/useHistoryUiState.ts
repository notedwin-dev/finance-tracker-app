import { useEffect, useState } from "react";
import { SCROLL_THRESHOLD } from "./constants";

export const useBackToTop = (): boolean => {
	const [showBackToTop, setShowBackToTop] = useState(false);

	useEffect(() => {
		const handleScroll = () => {
			setShowBackToTop(window.scrollY > SCROLL_THRESHOLD);
		};
		window.addEventListener("scroll", handleScroll, { passive: true });
		return () => window.removeEventListener("scroll", handleScroll);
	}, []);

	return showBackToTop;
};

export const useSearchKeyboard = (
	onOpen: () => void,
	onClose: () => void,
	shouldListenForSlash: boolean,
): void => {
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
				e.preventDefault();
				onOpen();
			}
			if (e.key === "/" && shouldListenForSlash) {
				e.preventDefault();
				onOpen();
			}
			if (e.key === "Escape") {
				onClose();
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [onOpen, onClose, shouldListenForSlash]);
};
