import { useRef, useState } from "react";

export const CollapseH4 = ({
  title,
  children,
}: React.PropsWithChildren<{ title: string }>) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number>(0);
  return (
    <div className="collapse">
      <h4
        onClick={() => {
          if (!ref.current) return;
          const { height } = ref.current.getBoundingClientRect();
          if (open) setHeight(Math.ceil(height));
          setTimeout(() => {
            setOpen((c) => !c);
          }, 10);
        }}
      >
        {title}
      </h4>
      <div
        aria-hidden={!open}
        ref={ref}
        style={{
          maxHeight: open ? (height ? height : "initial") : "0",
        }}
      >
        {children}
      </div>
    </div>
  );
};
