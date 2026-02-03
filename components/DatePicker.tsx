import React, { useState, useRef, useEffect } from "react";
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
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CalendarIcon,
} from "@heroicons/react/24/solid";

interface Props {
  value: string; // YYYY-MM-DD
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
}

const DatePicker: React.FC<Props> = ({
  value,
  onChange,
  className = "",
  placeholder = "Select date",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<"calendar" | "month" | "year">("calendar");
  const [currentMonth, setCurrentMonth] = useState(
    value ? parseISO(value) : new Date(),
  );
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setView("calendar");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Reset view when opening
  useEffect(() => {
    if (isOpen) setView("calendar");
  }, [isOpen]);

  // Update currentMonth if value changes from outside
  useEffect(() => {
    if (value) {
      setCurrentMonth(parseISO(value));
    }
  }, [value]);

  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(currentMonth)),
    end: endOfWeek(endOfMonth(currentMonth)),
  });

  const months = [
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

  const currentYear = getYear(currentMonth);
  const years = Array.from({ length: 21 }, (_, i) => currentYear - 10 + i);

  const handleDateClick = (day: Date, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(format(day, "yyyy-MM-dd"));
    setIsOpen(false);
  };

  const selectedDate = value ? parseISO(value) : null;

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 bg-surface/60 backdrop-blur-md border border-white/5 rounded-xl px-4 py-3 text-white cursor-pointer hover:border-indigo-500/50 transition-all group"
      >
        <CalendarIcon className="w-4 h-4 text-gray-500 group-hover:text-indigo-400 transition-colors" />
        <span
          className={`font-extrabold text-sm tracking-tight ${!value ? "text-gray-600" : "text-white"}`}
        >
          {value ? format(parseISO(value), "PPP") : placeholder}
        </span>
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 sm:right-0 sm:left-auto mt-2 z-100 bg-surface border border-white/10 rounded-4xl shadow-2xl p-5 w-[320px] animate-fadeIn backdrop-blur-2xl">
          {view === "calendar" && (
            <>
              <div className="flex items-center justify-between mb-6">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentMonth(subMonths(currentMonth, 1));
                  }}
                  className="p-2 hover:bg-white/5 rounded-xl text-gray-400 transition-colors"
                >
                  <ChevronLeftIcon className="w-5 h-5" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setView("month");
                  }}
                  className="px-4 py-1.5 hover:bg-white/5 rounded-xl transition-all"
                >
                  <h3 className="font-black text-[10px] uppercase tracking-[0.2em] text-white">
                    {format(currentMonth, "MMMM yyyy")}
                  </h3>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentMonth(addMonths(currentMonth, 1));
                  }}
                  className="p-2 hover:bg-white/5 rounded-xl text-gray-400 transition-colors"
                >
                  <ChevronRightIcon className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-7 gap-1 text-center mb-2">
                {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
                  <span
                    key={d}
                    className="text-[10px] font-black text-gray-600 uppercase tracking-widest"
                  >
                    {d}
                  </span>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1">
                {days.map((day, i) => {
                  const isSelected =
                    selectedDate && isSameDay(day, selectedDate);
                  const isCurrentMonth = isSameMonth(day, currentMonth);
                  const isToday = isSameDay(day, new Date());

                  return (
                    <button
                      key={i}
                      onClick={(e) => handleDateClick(day, e)}
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
                })}
              </div>
            </>
          )}

          {view === "month" && (
            <div className="animate-fadeIn">
              <div className="flex items-center justify-between mb-6">
                <div />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setView("year");
                  }}
                  className="px-4 py-2 hover:bg-white/5 rounded-xl text-white font-black text-[10px] uppercase tracking-[0.2em]"
                >
                  {getYear(currentMonth)}
                </button>
                <div />
              </div>
              <div className="grid grid-cols-3 gap-2">
                {months.map((m, i) => (
                  <button
                    key={m}
                    onClick={(e) => {
                      e.stopPropagation();
                      setCurrentMonth(setMonth(currentMonth, i));
                      setView("calendar");
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
          )}

          {view === "year" && (
            <div className="animate-fadeIn">
              <div className="flex items-center justify-between mb-6">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentMonth(setYear(currentMonth, currentYear - 10));
                  }}
                  className="p-2 hover:bg-white/5 rounded-xl text-gray-400"
                >
                  <ChevronLeftIcon className="w-5 h-5" />
                </button>
                <h3 className="font-black text-[10px] uppercase tracking-[0.2em] text-white">
                  Select Year
                </h3>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentMonth(setYear(currentMonth, currentYear + 10));
                  }}
                  className="p-2 hover:bg-white/5 rounded-xl text-gray-400"
                >
                  <ChevronRightIcon className="w-5 h-5" />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2 max-h-60 overflow-y-auto scrollbar-hide pr-1">
                {years.map((y) => (
                  <button
                    key={y}
                    onClick={(e) => {
                      e.stopPropagation();
                      setCurrentMonth(setYear(currentMonth, y));
                      setView("month");
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
          )}

          <div className="mt-6 flex justify-between items-center px-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onChange(format(new Date(), "yyyy-MM-dd"));
                setIsOpen(false);
              }}
              className="text-[10px] font-black text-indigo-400 uppercase tracking-widest hover:text-indigo-300 transition-colors"
            >
              Today
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (view !== "calendar") {
                  setView("calendar");
                } else {
                  setIsOpen(false);
                }
              }}
              className="text-[10px] font-black text-gray-500 uppercase tracking-widest hover:text-white transition-colors"
            >
              {view !== "calendar" ? "Back" : "Close"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DatePicker;
