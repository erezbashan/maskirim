"use client";

import React from "react";
import DatePicker, { registerLocale } from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { he } from "date-fns/locale/he";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

registerLocale("he", he);

interface HebrewDatePickerProps {
  selected?: Date | null;
  onChange: (date: Date | null) => void;
  className?: string;
  id?: string;
  name?: string;
  required?: boolean;
}

export function HebrewDatePicker({ selected, onChange, className, id, name, required }: HebrewDatePickerProps) {
  return (
    <div className={cn("w-full", className)}>
      <DatePicker
        id={id}
        name={name}
        selected={selected}
        onChange={onChange}
        locale="he"
        dateFormat="dd/MM/yyyy"
        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        required={required}
        autoComplete="off"
      />
    </div>
  );
}
