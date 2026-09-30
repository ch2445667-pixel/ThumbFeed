"use client";

import {
  forwardRef,
  useState,
  type ChangeEvent,
  type ComponentPropsWithoutRef,
} from "react";
import { Sun, Moon } from "lucide-react";
import { cn } from "@/lib/cn";

export type SlateChipSwitchProps = Readonly<
  {
    checked?: boolean;
    defaultChecked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
    label?: string;
    showIcons?: boolean;
  } & Omit<
    ComponentPropsWithoutRef<"input">,
    "type" | "checked" | "defaultChecked" | "onChange"
  >
>;

/* Geometry only. All colour comes from the token layer, so the switch follows
   the theme instead of carrying its own blue. */
const CHIP_FRAME =
  "relative inline-flex items-center rounded-full border border-line bg-surface-raised p-0.5";

const CHIP_TRACK =
  "relative h-[1.5em] w-[2.9em] rounded-full bg-line-strong transition-colors duration-300 ease-fluid motion-reduce:transition-none peer-checked:bg-accent peer-checked:[&>span]:translate-x-[1.36em]";

const CHIP_THUMB =
  "absolute left-[0.1em] top-1/2 grid h-[1.24em] w-[1.24em] -translate-y-1/2 place-items-center rounded-full bg-accent-on text-accent shadow-card transition-transform duration-300 ease-fluid motion-reduce:transition-none pointer-events-none select-none";

export const SlateChipSwitch = forwardRef<
  HTMLInputElement,
  SlateChipSwitchProps
>(
  (
    {
      className,
      checked,
      defaultChecked = false,
      onCheckedChange,
      label = "Enable mode",
      showIcons = true,
      disabled,
      id,
      ...props
    },
    ref,
  ) => {
    const [internalChecked, setInternalChecked] = useState(defaultChecked);
    const isControlled = checked !== undefined;
    const isOn = isControlled ? checked : internalChecked;

    const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
      const next = event.target.checked;
      if (!isControlled) {
        setInternalChecked(next);
      }
      onCheckedChange?.(next);
    };

    return (
      <label
        data-slot="slate-chip-switch"
        data-state={isOn ? "on" : "off"}
        className={cn(
          CHIP_FRAME,
          "group/chip",
          disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
          className,
        )}
      >
        <input
          ref={ref}
          id={id}
          type="checkbox"
          checked={isControlled ? checked : undefined}
          defaultChecked={isControlled ? undefined : defaultChecked}
          disabled={disabled}
          aria-label={label}
          onChange={handleChange}
          onClick={(e) => e.stopPropagation()}
          className="peer absolute inset-0 z-10 h-full w-full cursor-pointer appearance-none opacity-0 ring-0 outline-none focus:ring-0 disabled:cursor-not-allowed"
          {...props}
        />

        <span aria-hidden="true" data-layer="chip-track" className={CHIP_TRACK}>
          <span data-layer="chip-thumb" className={CHIP_THUMB}>
            {showIcons &&
              (isOn ? (
                <Moon className="h-[0.7em] w-[0.7em]" strokeWidth={2.2} />
              ) : (
                <Sun className="h-[0.74em] w-[0.74em]" strokeWidth={2.2} />
              ))}
          </span>
        </span>
      </label>
    );
  },
);

SlateChipSwitch.displayName = "SlateChipSwitch";
