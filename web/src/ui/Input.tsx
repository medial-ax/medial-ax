import { ComponentProps, useEffect, useRef } from "react";

export const Input = ({
  onChange,
  onBlur,
  value,
  ...props
}: ComponentProps<"input">) => {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) {
      ref.current.value = String(value);
    }
  }, [value]);

  return (
    <input
      ref={ref}
      defaultValue={value}
      {...props}
      onChange={(e) => {
        if (!isNaN(parseFloat(e.target.value)) && e.target.value !== "")
          onChange?.(e);
      }}
      onBlur={(e) => {
        if (isNaN(parseFloat(e.target.value)) || e.target.value === "")
          e.target.value = String(value);
      }}
    />
  );
};
