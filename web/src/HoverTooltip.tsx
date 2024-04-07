import { PropsWithChildren, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CSSProperties } from "styled-components";

export const HoverTooltip = ({
  style,
  right,
  children,
}: PropsWithChildren<{ right?: boolean; style?: CSSProperties }>) => {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<undefined | { x: number; y: number }>(
    undefined,
  );
  const ref = useRef<HTMLSpanElement>(null);

  return (
    <span
      className="tooltip"
      style={style}
      ref={ref}
      onMouseEnter={() => {
        if (!ref.current) return;
        setOpen(true);
        const { x, y } = ref.current.getBoundingClientRect();
        setPos({ x, y });
      }}
      onMouseLeave={() => {
        setOpen(false);
      }}
    >
      ?
      {open &&
        pos &&
        createPortal(
          <div
            className="tooltip-popup"
            style={{
              top: pos.y,
              left: pos.x,
              transform: `translateX(${
                right ? "0" : "-50%"
              }) translateY(-100%)`,
            }}
          >
            {children}
          </div>,
          document.body,
        )}
    </span>
  );
};
