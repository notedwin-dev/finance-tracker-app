import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import {
	format,
	startOfMonth,
	endOfMonth,
	startOfWeek,
	endOfWeek,
	eachDayOfInterval,
	isSameMonth,
	isSameDay,
	addMonths,
	subMonths,
	parseISO,
	setMonth,
	setYear,
	getYear,
	getMonth,
} from "date-fns";
import { ChevronLeftIcon, ChevronRightIcon, CalendarIcon } from "@heroicons/react/24/solid";

const MONTHS = [
	"Jan",
	"Feb",
	"Mar",
	"Apr",
	"May",
	"Jun",
	"Jul",
	"Aug",
	"Sep",
	"Oct",
	"Nov",
	"Dec",
];
const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const PICKER_HEIGHT = 440;
const PICKER_WIDTH = 320;

type View = "calendar" | "month" | "year";
type Position = "top" | "bottom";

interface Props {
	value: string;
	onChange: (value: string) => void;
	className?: string;
	placeholder?: string;
}

const useClickOutside = (
	ref: React.RefObject<HTMLElement>,
	portalRef: React.RefObject<HTMLElement>,
	onClose: () => void,
) => {
	useEffect(() => {
		const handler = (event: MouseEvent) => {
			const target = event.target as Node;
			const insideTrigger = ref.current && ref.current.contains(target);
			const insidePortal =
				portalRef.current && portalRef.current.contains(target);
			if (!insideTrigger && !insidePortal) onClose();
		};
		document.addEventListener("mousedown", handler);
		return () => document.removeEventListener("mousedown", handler);
	}, [ref, portalRef, onClose]);
};

const computeCoords = (
	container: HTMLElement | null,
): { top: number; left: number; width: number; position: Position } => {
	if (!container) return { top: 0, left: 0, width: 0, position: "bottom" };
	const rect = container.getBoundingClientRect();
	const spaceBelow = window.innerHeight - rect.bottom;
	const spaceAbove = rect.top;
	const position: Position =
		spaceBelow < PICKER_HEIGHT && spaceAbove > spaceBelow ? "top" : "bottom";
	return {
		top: position === "bottom" ? rect.bottom : rect.top,
		left: rect.left,
		width: rect.width,
		position,
	};
};

const usePickerCoords = (
	containerRef: React.RefObject<HTMLDivElement>,
	isOpen: boolean,
) => {
	const [coords, setCoords] = useState({
		top: 0,
		left: 0,
		width: 0,
		position: "bottom" as Position,
	});

	useEffect(() => {
		if (!isOpen) return;
		const update = () => setCoords(computeCoords(containerRef.current));
		update();
		window.addEventListener("scroll", update, true);
		window.addEventListener("resize", update);
		return () => {
			window.removeEventListener("scroll", update, true);
			window.removeEventListener("resize", update);
		};
	}, [isOpen, containerRef]);

	return coords;
};

const PickerTrigger: React.FC<{
	value: string;
	placeholder: string;
	onToggle: () => void;
}> = ({ value, placeholder, onToggle }) => (
	<div
		onClick={onToggle}
		className="flex items-center gap-3 bg-surface/60 backdrop-blur-md border border-white/5 rounded-xl px-4 py-3 text-white cursor-pointer hover:border-indigo-500/50 transition-all group"
	>
		<CalendarIcon className="w-4 h-4 text-gray-500 group-hover:text-indigo-400 transition-colors" />
		<span
			className={`font-extrabold text-sm tracking-tight ${!value ? "text-gray-600" : "text-white"}`}
		>
			{value ? format(parseISO(value), "PPP") : placeholder}
		</span>
	</div>
);

const MonthYearTitle: React.FC<{
	currentMonth: Date;
	onClick: () => void;
}> = ({ currentMonth, onClick }) => (
	<button
		onClick={(e) => {
			e.stopPropagation();
			onClick();
		}}
		className="px-4 py-1.5 hover:bg-white/5 rounded-xl transition-all"
	>
		<h3 className="font-black text-[10px] uppercase tracking-[0.2em] text-white">
			{format(currentMonth, "MMMM yyyy")}
		</h3>
	</button>
);

const NavButton: React.FC<{
	direction: "prev" | "next";
	onClick: () => void;
}> = ({ direction, onClick }) => (
	<button
		onClick={(e) => {
			e.stopPropagation();
			onClick();
		}}
		className="p-2 hover:bg-white/5 rounded-xl text-gray-400 transition-colors"
	>
		{direction === "prev" ? (
			<ChevronLeftIcon className="w-5 h-5" />
		) : (
			<ChevronRightIcon className="w-5 h-5" />
		)}
	</button>
);

const CalendarHeader: React.FC<{
	currentMonth: Date;
	onPrev: () => void;
	onTitleClick: () => void;
	onNext: () => void;
}> = ({ currentMonth, onPrev, onTitleClick, onNext }) => (
	<div className="flex items-center justify-between mb-6">
		<NavButton direction="prev" onClick={onPrev} />
		<MonthYearTitle currentMonth={currentMonth} onClick={onTitleClick} />
		<NavButton direction="next" onClick={onNext} />
	</div>
);

const WeekdayHeader: React.FC = () => (
	<div className="grid grid-cols-7 gap-1 text-center mb-2">
		{WEEKDAYS.map((d) => (
			<span
				key={d}
				className="text-[10px] font-black text-gray-600 uppercase tracking-widest"
			>
				{d}
			</span>
		))}
	</div>
);

const DayCell: React.FC<{
	day: Date;
	selected: Date | null;
	currentMonth: Date;
	onPick: (day: Date, e: React.MouseEvent) => void;
}> = ({ day, selected, currentMonth, onPick }) => {
	const isSelected = selected && isSameDay(day, selected);
	const isCurrentMonth = isSameMonth(day, currentMonth);
	const isToday = isSameDay(day, new Date());
	return (
		<button
			onClick={(e) => onPick(day, e)}
			className={`
				h-10 w-10 rounded-2xl text-[11px] font-black transition-all flex items-center justify-center
				${!isCurrentMonth ? "text-gray-800" : "text-white"}
				${isSelected ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/40 scale-110 z-10" : "hover:bg-white/5"}
				${isToday && !isSelected ? "border border-indigo-500/30 text-indigo-400" : ""}
			`}
		>
			{format(day, "d")}
		</button>
	);
};

const CalendarGrid: React.FC<{
	currentMonth: Date;
	selected: Date | null;
	onPick: (day: Date, e: React.MouseEvent) => void;
}> = ({ currentMonth, selected, onPick }) => {
	const days = eachDayOfInterval({
		start: startOfWeek(startOfMonth(currentMonth)),
		end: endOfWeek(endOfMonth(currentMonth)),
	});
	return (
		<>
			<WeekdayHeader />
			<div className="grid grid-cols-7 gap-1">
				{days.map((day, i) => (
					<DayCell
						key={i}
						day={day}
						selected={selected}
						currentMonth={currentMonth}
						onPick={onPick}
					/>
				))}
			</div>
		</>
	);
};

const MonthGrid: React.FC<{
	currentMonth: Date;
	onPick: (month: number) => void;
	onTitleClick: () => void;
}> = ({ currentMonth, onPick, onTitleClick }) => (
	<div className="animate-fadeIn">
		<div className="flex items-center justify-between mb-6">
			<div />
			<button
				onClick={(e) => {
					e.stopPropagation();
					onTitleClick();
				}}
				className="px-4 py-2 hover:bg-white/5 rounded-xl text-white font-black text-[10px] uppercase tracking-[0.2em]"
			>
				{getYear(currentMonth)}
			</button>
			<div />
		</div>
		<div className="grid grid-cols-3 gap-2">
			{MONTHS.map((m, i) => (
				<button
					key={m}
					onClick={(e) => {
						e.stopPropagation();
						onPick(i);
					}}
					className={`py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
						getMonth(currentMonth) === i
							? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30"
							: "text-gray-400 hover:bg-white/5 hover:text-white"
					}`}
				>
					{m}
				</button>
			))}
		</div>
	</div>
);

const YearGrid: React.FC<{
	currentMonth: Date;
	years: number[];
	onPick: (year: number) => void;
	onShiftDecade: (delta: number) => void;
}> = ({ currentMonth, years, onPick, onShiftDecade }) => (
	<div className="animate-fadeIn">
		<div className="flex items-center justify-between mb-6">
			<NavButton direction="prev" onClick={() => onShiftDecade(-10)} />
			<h3 className="font-black text-[10px] uppercase tracking-[0.2em] text-white">
				Select Year
			</h3>
			<NavButton direction="next" onClick={() => onShiftDecade(10)} />
		</div>
		<div className="grid grid-cols-3 gap-2 max-h-60 overflow-y-auto scrollbar-hide pr-1">
			{years.map((y) => (
				<button
					key={y}
					onClick={(e) => {
						e.stopPropagation();
						onPick(y);
					}}
					className={`py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
						getYear(currentMonth) === y
							? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30"
							: "text-gray-400 hover:bg-white/5 hover:text-white"
					}`}
				>
					{y}
				</button>
			))}
		</div>
	</div>
);

const PickerFooter: React.FC<{
	view: View;
	onToday: () => void;
	onClose: () => void;
}> = ({ view, onToday, onClose }) => (
	<div className="mt-6 flex justify-between items-center px-1">
		<button
			onClick={(e) => {
				e.stopPropagation();
				onToday();
			}}
			className="text-[10px] font-black text-indigo-400 uppercase tracking-widest hover:text-indigo-300 transition-colors"
		>
			Today
		</button>
		<button
			onClick={(e) => {
				e.stopPropagation();
				onClose();
			}}
			className="text-[10px] font-black text-gray-500 uppercase tracking-widest hover:text-white transition-colors"
		>
			{view !== "calendar" ? "Back" : "Close"}
		</button>
	</div>
);

const DatePicker: React.FC<Props> = ({
	value,
	onChange,
	className = "",
	placeholder = "Select date",
}) => {
	const [isOpen, setIsOpen] = useState(false);
	const [view, setView] = useState<View>("calendar");
	const [currentMonth, setCurrentMonth] = useState(
		value ? parseISO(value) : new Date(),
	);
	const containerRef = useRef<HTMLDivElement>(null);
	const portalRef = useRef<HTMLDivElement>(null);
	const coords = usePickerCoords(containerRef, isOpen);

	useEffect(() => {
		if (isOpen) setView("calendar");
	}, [isOpen]);

	useEffect(() => {
		if (value) setCurrentMonth(parseISO(value));
	}, [value]);

	const closePicker = () => {
		setIsOpen(false);
		setView("calendar");
	};

	useClickOutside(containerRef, portalRef, closePicker);

	const selectedDate = value ? parseISO(value) : null;
	const currentYear = getYear(currentMonth);
	const years = Array.from({ length: 21 }, (_, i) => currentYear - 10 + i);

	const handleDateClick = (day: Date, e: React.MouseEvent) => {
		e.stopPropagation();
		onChange(format(day, "yyyy-MM-dd"));
		setIsOpen(false);
	};

	const handleMonthPick = (monthIndex: number) => {
		setCurrentMonth(setMonth(currentMonth, monthIndex));
		setView("calendar");
	};

	const handleYearPick = (year: number) => {
		setCurrentMonth(setYear(currentMonth, year));
		setView("month");
	};

	const handleToday = () => {
		onChange(format(new Date(), "yyyy-MM-dd"));
		setIsOpen(false);
	};

	return (
		<div className={`relative ${className}`} ref={containerRef}>
			<PickerTrigger
				value={value}
				placeholder={placeholder}
				onToggle={() => setIsOpen(!isOpen)}
			/>

			{isOpen &&
				createPortal(
					<>
						<div
							className="fixed inset-0 z-1000 bg-black/20 backdrop-blur-[2px] sm:bg-transparent sm:backdrop-blur-none animate-fadeIn"
							onClick={() => setIsOpen(false)}
						/>
						<div
							className="fixed inset-0 z-1001 flex items-center justify-center p-4 pointer-events-none sm:inset-auto sm:block sm:p-0 sm:pointer-events-auto"
							style={
								window.innerWidth >= 640
									? {
											top: `${coords.top + (coords.position === "bottom" ? 8 : -8)}px`,
											left: `${coords.left + coords.width - PICKER_WIDTH}px`,
											position: "fixed",
											transform:
												coords.position === "top"
													? "translateY(-100%)"
													: "none",
										}
									: {}
							}
						>
							<div
								ref={portalRef}
								className="bg-surface border border-white/10 rounded-4xl shadow-2xl p-5 w-[320px] animate-fadeIn backdrop-blur-2xl pointer-events-auto mx-auto sm:mx-0 shadow-black/50"
								onClick={(e) => e.stopPropagation()}
							>
								{view === "calendar" && (
									<>
										<CalendarHeader
											currentMonth={currentMonth}
											onPrev={() =>
												setCurrentMonth(subMonths(currentMonth, 1))
											}
											onTitleClick={() => setView("month")}
											onNext={() =>
												setCurrentMonth(addMonths(currentMonth, 1))
											}
										/>
										<CalendarGrid
											currentMonth={currentMonth}
											selected={selectedDate}
											onPick={handleDateClick}
										/>
									</>
								)}
								{view === "month" && (
									<MonthGrid
										currentMonth={currentMonth}
										onPick={handleMonthPick}
										onTitleClick={() => setView("year")}
									/>
								)}
								{view === "year" && (
									<YearGrid
										currentMonth={currentMonth}
										years={years}
										onPick={handleYearPick}
										onShiftDecade={(delta) =>
											setCurrentMonth(
												setYear(currentMonth, currentYear + delta),
											)
										}
									/>
								)}
								<PickerFooter
									view={view}
									onToday={handleToday}
									onClose={() =>
										view !== "calendar" ? setView("calendar") : closePicker()
									}
								/>
							</div>
						</div>
					</>,
					document.body,
				)}
		</div>
	);
};

export default DatePicker;
