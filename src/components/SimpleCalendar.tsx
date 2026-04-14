"use client";

import React, { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export interface Day {
    year: number;
    month: number;
    day: number;
}

interface SimpleCalendarProps {
    value: Day | null;
    onChange: (day: Day) => void;
    minimumDate?: Day;
    maximumDate?: Day;
    colorPrimary?: string;
    colorPrimaryLight?: string;
}

export const SimpleCalendar: React.FC<SimpleCalendarProps> = ({
    value,
    onChange,
    minimumDate,
    maximumDate,
    colorPrimary = "#0fbcf9",
    colorPrimaryLight = "#e3f4fc",
}) => {
    const today = new Date();
    const [currentMonth, setCurrentMonth] = useState(value?.month || today.getMonth() + 1);
    const [currentYear, setCurrentYear] = useState(value?.year || today.getFullYear());

    const monthNames = [
        "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
        "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
    ];

    const getDaysInMonth = (month: number, year: number) => {
        return new Date(year, month, 0).getDate();
    };

    const getFirstDayOfMonth = (month: number, year: number) => {
        return new Date(year, month - 1, 1).getDay();
    };

    const isDateDisabled = (day: number) => {
        const date = { year: currentYear, month: currentMonth, day };

        if (minimumDate) {
            const minDate = new Date(minimumDate.year, minimumDate.month - 1, minimumDate.day);
            const checkDate = new Date(date.year, date.month - 1, date.day);
            if (checkDate < minDate) return true;
        }

        if (maximumDate) {
            const maxDate = new Date(maximumDate.year, maximumDate.month - 1, maximumDate.day);
            const checkDate = new Date(date.year, date.month - 1, date.day);
            if (checkDate > maxDate) return true;
        }

        return false;
    };

    const isSelected = (day: number) => {
        return value?.day === day && value?.month === currentMonth && value?.year === currentYear;
    };

    const handlePrevMonth = () => {
        if (currentMonth === 1) {
            setCurrentMonth(12);
            setCurrentYear(currentYear - 1);
        } else {
            setCurrentMonth(currentMonth - 1);
        }
    };

    const handleNextMonth = () => {
        if (currentMonth === 12) {
            setCurrentMonth(1);
            setCurrentYear(currentYear + 1);
        } else {
            setCurrentMonth(currentMonth + 1);
        }
    };

    const handleDayClick = (day: number) => {
        if (!isDateDisabled(day)) {
            onChange({ year: currentYear, month: currentMonth, day });
        }
    };

    const daysInMonth = getDaysInMonth(currentMonth, currentYear);
    const firstDay = getFirstDayOfMonth(currentMonth, currentYear);
    const days = [];

    // Empty cells for days before the first day of month
    for (let i = 0; i < firstDay; i++) {
        days.push(<div key={`empty-${i}`} className="p-2"></div>);
    }

    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
        const disabled = isDateDisabled(day);
        const selected = isSelected(day);

        days.push(
            <button
                key={day}
                onClick={() => handleDayClick(day)}
                disabled={disabled}
                className={`
                    p-2 text-sm rounded-lg transition-all
                    ${disabled ? "text-gray-300 cursor-not-allowed" : "hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"}
                    ${selected ? `font-bold text-white` : "text-gray-700 dark:text-gray-300"}
                `}
                style={selected ? { backgroundColor: colorPrimary } : {}}
            >
                {day}
            </button>
        );
    }

    return (
        <div className="w-full max-w-sm mx-auto bg-white dark:bg-gray-800 rounded-lg p-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <button
                    onClick={handlePrevMonth}
                    className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                >
                    <ChevronLeft size={20} className="text-gray-600 dark:text-gray-300" />
                </button>
                <div className="text-center">
                    <div className="font-bold text-gray-800 dark:text-gray-200">
                        {monthNames[currentMonth - 1]} {currentYear}
                    </div>
                </div>
                <button
                    onClick={handleNextMonth}
                    className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                >
                    <ChevronRight size={20} className="text-gray-600 dark:text-gray-300" />
                </button>
            </div>

            {/* Day names */}
            <div className="grid grid-cols-7 gap-1 mb-2">
                {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((day) => (
                    <div key={day} className="text-center text-xs font-semibold text-gray-500 dark:text-gray-400 p-2">
                        {day}
                    </div>
                ))}
            </div>

            {/* Days grid */}
            <div className="grid grid-cols-7 gap-1">
                {days}
            </div>
        </div>
    );
};
