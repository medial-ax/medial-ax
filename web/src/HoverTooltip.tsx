import { PropsWithChildren, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CSSProperties } from "styled-components";

export const HoverTooltip = ({
  style,
  right,
  children,
}: PropsWithChildren<{ right?: boolean; style?: CSSProperties }>) => {
  const [mount, setMount] = useState(false);
  const [hide, setHide] = useState(false);
  const [pos, setPos] = useState<undefined | { x: number; y: number }>(
    undefined,
  );
  const ref = useRef<HTMLSpanElement>(null);
  const hideTimeout = useRef<number | null>(null);
  const rmTimeout = useRef<number | null>(null);

  return (
    <span
      className="tooltip"
      style={style}
      ref={ref}
      onMouseEnter={() => {
        if (!ref.current) return;
        if (hideTimeout.current !== null) clearTimeout(hideTimeout.current);
        if (rmTimeout.current !== null) clearTimeout(rmTimeout.current);
        setMount(true);
        setHide(false);
        const { x, y } = ref.current.getBoundingClientRect();
        setPos({ x, y });
      }}
      onMouseLeave={() => {
        if (hideTimeout.current !== null) clearTimeout(hideTimeout.current);
        if (rmTimeout.current !== null) clearTimeout(rmTimeout.current);

        hideTimeout.current = setTimeout(() => {
          setHide(true);
          rmTimeout.current = setTimeout(() => {
            setMount(false);
          }, 150);
        }, 100);
      }}
    >
      ?
      {mount &&
        pos &&
        createPortal(
          <div
            className={"tooltip-popup" + (hide ? " close" : "")}
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
