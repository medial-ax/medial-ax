import styled, { CSSProperties } from "styled-components";
import { BirthDeathPair, Index } from "./types";
import { barcodeAtom, selectedBirthDeathPair } from "./state";
import { useAtom, useSetAtom } from "jotai";
import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { timelinePositionAtom } from "./state";
import { clamp, max } from "./utils";
import { colors } from "./constants";
import { wasmWorker } from "./App";

const _width = 4;
const barSpacing = 20;
const barcodePaddingPx = 40;

const dim2label: Record<number, string> = {
  "-1": "ø",
  0: "v",
  1: "e",
  2: "t",
};

const HoverPopup = styled.div`
  background: white;
  border-radius: 2px;
  position: absolute;
  bottom: 0;
  margin-bottom: 1rem;
  padding: 0 0.25rem;
  left: -50%;
  white-space: nowrap;
  font-size: 10px;
  pointer-events: none;
`;

const BarDiv = styled.div<{ color: string }>`
  position: absolute;
  border-radius: ${_width * 2}px;

  & > ${HoverPopup} {
    opacity: 0;
  }

  margin: 0px;
  &:not(:hover) {
    margin: 1px;
    border: none;
  }
  &:hover {
    border: 1px solid color-mix(in srgb, ${(p) => p.color} 80%, red);
    cursor: pointer;
    & > ${HoverPopup} {
      opacity: 1;
    }
    z-index: 1;
  }
`;

const time2px = (time: number, xmax: number, width: number): number =>
  (time / xmax) * width;
const px2time = (px: number, xmax: number, width: number): number =>
  (px / width) * xmax;

const Bar = ({
  width,
  xmax,
  pair,
  top,
  color,
  label,
  dim,
}: {
  width: number;
  xmax: number;
  pair: BirthDeathPair;
  top: number;
  color: string;
  label: string;
  dim: number;
}) => {
  const left = time2px(pair.birth == null ? 0 : pair.birth[0], xmax, width);
  const right =
    width - time2px(pair.death == null ? xmax : pair.death[0], xmax, width);

  const isTrivial =
    pair.birth != null && pair.death != null && pair.birth[0] == pair.death[0];
  const topPx = isTrivial ? 0 : top * barSpacing;

  const style: CSSProperties = isTrivial
    ? {
        left: `calc(${left}px - ${_width / 2}px)`,
        width: `${_width}px`,
        height: `${_width}px`,
      }
    : {
        left: `${left}px`,
        right: `${right}px`,
        height: `${2 * _width}px`,
      };

  if (pair.birth == null) {
    style.borderTopLeftRadius = "initial";
    style.borderBottomLeftRadius = "initial";
    style.marginLeft = "0";
  }

  if (pair.death == null) {
    style.borderTopRightRadius = "initial";
    style.borderBottomRightRadius = "initial";
    style.marginRight = "0";
  }

  const setSelectedBDPair = useSetAtom(selectedBirthDeathPair);

  return (
    <BarDiv
      color={dim2color[dim]}
      onClick={(e) => {
        setSelectedBDPair(pair);
        e.stopPropagation();
      }}
      style={{
        ...style,
        top: `${topPx}px`,
        background: color,
      }}
    >
      {isTrivial ? (
        <HoverPopup>
          {`[${dim2label[dim]}${pair.birth == null ? " " : pair.birth[1]}, ${
            dim2label[dim]
          }${pair.death == null ? " " : pair.death[1]})`}
        </HoverPopup>
      ) : (
        <>
          {pair.birth != null && (
            <BarcodeLabels
              style={{
                right: `100%`,
              }}
            >
              {label}
              {pair.birth[1]}
            </BarcodeLabels>
          )}
          {pair.death != null && (
            <BarcodeLabels
              style={{
                left: `100%`,
              }}
            >
              {label}
              {pair.death[1]}
            </BarcodeLabels>
          )}
        </>
      )}
    </BarDiv>
  );
};

const BarcodePlot = styled.div`
  margin: 0 ${barcodePaddingPx}px;
  border-left: 1px solid black;

  hr {
    background: black;
    opacity: 0.2;
    height: 1px;
    border: none;
  }
`;

const dim2color: Record<number, string> = {
  "-1": "gray",
  0: "orange",
  1: "pink",
  2: "blue",
};

const BarcodeDimDiv = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  font-family: monospace;

  h4 {
    position: fixed;
    transform: translateX(-150%);
    padding: 0;
    margin: 0;
  }
  gap: 1rem;
`;

const BarcodeLabels = styled.div`
  position: absolute;
  transform: translateY(-40%);
  font-size: 10px;
  margin: 0 2px;
  font-family: monospace;
  pointer-events: none;
`;

const BarcodeDim = ({
  pairs,
  dim,
  xmax,
  width,
}: {
  pairs: BirthDeathPair[];
  dim: number;
  xmax: number;
  width: number;
}) => {
  const trivials = [];
  const nontrivials = [];
  for (const pair of pairs) {
    if (
      pair.birth == null ||
      pair.death == null ||
      pair.birth[0] != pair.death[0]
    )
      nontrivials.push(pair);
    else trivials.push(pair);
  }

  return (
    <BarcodeDimDiv>
      <h4>
        H<sub>{dim}</sub>
      </h4>
      <div style={{ position: "relative", height: "4rem" }}>
        {trivials.map((x, i) => (
          <Bar
            key={i}
            width={width}
            xmax={xmax}
            pair={x}
            top={0}
            color={dim2color[dim]}
            label={dim2label[dim]}
            dim={dim}
          />
        ))}
        {nontrivials.map((x, i) => (
          <Bar
            width={width}
            key={i}
            xmax={xmax}
            pair={x}
            top={i + 1}
            color={dim2color[dim]}
            label={dim2label[dim]}
            dim={dim}
          />
        ))}
      </div>
    </BarcodeDimDiv>
  );
};

const BarcodeXAxis = ({ xmax, width }: { xmax: number; width: number }) => {
  const left = time2px(0, xmax, width);
  const right = width - time2px(xmax, xmax, width);

  // Compute the number of ticks so that we have at least 10px between each tick
  // and the ticks is either an integer, or 1/ an integer:

  const numTicks = 10;
  const tickFloat = xmax / numTicks;
  let tickRounded = Math.round(tickFloat);
  if (tickRounded === 0) tickRounded = 1 / Math.round(numTicks / xmax);

  const actualNumberOfTicks = Math.floor(xmax / tickRounded) + 1;

  return (
    <div
      style={{
        position: "relative",
        margin: `0 ${barcodePaddingPx}px`,
        height: "10px",
        marginBottom: "30px",
      }}
    >
      <div
        style={{
          position: "absolute",
          height: "1px",
          background: "black",
          left: `${left}px`,
          right: `${right}px`,
        }}
      />
      {new Array(actualNumberOfTicks).fill(0).map((_, i) => {
        const left = time2px(i * tickRounded, xmax, width);
        return (
          <Fragment key={i}>
            <div
              style={{
                position: "absolute",
                left: `${left}px`,
                transform: `translateX(-50%) translateY(50%) rotate(30deg)`,
              }}
            >
              {(i * tickRounded).toFixed(2)}
            </div>
            <div
              style={{
                position: "absolute",
                left: `${left}px`,
                height: "100%",
                width: "2px",
                background: "black",
              }}
            />
          </Fragment>
        );
      })}
    </div>
  );
};

const TimelineBarDiv = styled.div<{ $dragging: boolean }>`
  position: absolute;
  height: 100%;
  width: 2px;
  margin-left: -4px;
  padding: 4px;
  z-index: 1;

  & > div {
    height: 100%;
    width: 2px;
    background: black;
  }

  transition: opacity 0.2s ease-in-out;
  opacity: ${(p) => (p.$dragging ? 0.75 : 0.3)};

  cursor: ew-resize;
`;

const TimelinePositionLabel = styled.div`
  position: absolute;
  display: flex;
  width: auto;

  bottom: 0;
  margin-bottom: 200px;
  padding: 2px 8px;

  color: #333;
  background: ${colors.sliderBackground};
  border: 1px solid #aaa;

  transform: translateX(-50%);
  z-index: 2;
  pointer-events: none;
`;

const TimelineBar = ({ xmax }: { xmax: number }) => {
  const [timelinePosition, setTimelinePosition] = useAtom(timelinePositionAtom);
  const [x, setX] = useState<number>(barcodePaddingPx);

  const redRef = useRef<HTMLDivElement>(null);
  const ref = useRef<HTMLDivElement>(null);

  const [isDragging, setIsDragging] = useState(false);

  const onMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const onMoveCallback = useCallback(
    (e: MouseEvent) => {
      if (e.target !== redRef.current) return;
      if (isDragging) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { layerX } = e as any;
        const bounds = (e.target as HTMLDivElement).getBoundingClientRect();
        const width = bounds.width;
        const widthMinusPadding = width - 2 * barcodePaddingPx;
        const pos = px2time(layerX - barcodePaddingPx, xmax, widthMinusPadding);

        const clampedX = clamp(
          layerX,
          barcodePaddingPx,
          width - barcodePaddingPx,
        );
        setX(clampedX);

        setTimelinePosition(clamp(pos, 0, xmax));
      }
    },
    [isDragging, setTimelinePosition, xmax],
  );

  useEffect(() => {
    if (!isDragging) return;
    window.addEventListener("mousemove", onMoveCallback);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMoveCallback);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [isDragging, onMouseUp, onMoveCallback]);

  return (
    <>
      <TimelinePositionLabel
        style={{
          left: x,
          opacity: isDragging ? 1 : 0,
        }}
      >
        {timelinePosition.toFixed(3)}
      </TimelinePositionLabel>

      <TimelineBarDiv
        $dragging={isDragging}
        ref={ref}
        style={{ left: x }}
        onMouseDown={(e) => {
          setIsDragging(true);
          e.preventDefault();
        }}
        onMouseUp={() => {
          setIsDragging(false);
        }}
      >
        <div />
      </TimelineBarDiv>

      <div
        ref={redRef}
        style={{
          position: "absolute",
          zIndex: isDragging ? 99 : -99,
          width: "100%",
          height: "100%",
          cursor: "ew-resize",
        }}
      />
    </>
  );
};

const BarcodeInner = ({
  barcodes,
}: {
  barcodes: {
    "-1": BirthDeathPair[];
    0: BirthDeathPair[];
    1: BirthDeathPair[];
    2: BirthDeathPair[];
  };
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const setSelectedBDPair = useSetAtom(selectedBirthDeathPair);

  const [width, setWidth] = useState<number>(0);

  useLayoutEffect(() => {
    if (!ref.current) return;
    const observer = new ResizeObserver((entries) => {
      setWidth(entries[0].contentRect.width - 2 * barcodePaddingPx);
    });
    observer.observe(ref.current);
    return () => {
      observer.disconnect();
    };
  }, []);

  const allPairs = barcodes[-1]
    .concat(barcodes[0])
    .concat(barcodes[1])
    .concat(barcodes[2]);

  const xmax =
    max(
      allPairs.flatMap((x) => {
        if (x.death == null) return [];
        return [x.death[0]];
      }),
    ) * 1.2;

  return (
    <div
      onClick={() => {
        setSelectedBDPair(undefined);
      }}
      ref={ref}
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        flex: 1,
        position: "relative",
      }}
    >
      <BarcodePlot>
        <BarcodeDim width={width} xmax={xmax} pairs={barcodes[2]} dim={2} />
        <hr />
        <BarcodeDim width={width} xmax={xmax} pairs={barcodes[1]} dim={1} />
        <hr />
        <BarcodeDim width={width} xmax={xmax} pairs={barcodes[0]} dim={0} />
        <hr />
        <BarcodeDim width={width} xmax={xmax} pairs={barcodes[-1]} dim={-1} />
      </BarcodePlot>
      <BarcodeXAxis width={width} xmax={xmax} />

      <TimelineBar xmax={xmax} />
    </div>
  );
};

export const Barcode = ({ index }: { index: Index | undefined }) => {
  const [barcodes, setBarcodes] = useAtom(barcodeAtom);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!index) return;
    let stop = false;
    wasmWorker.onmessage = (msg: any) => {
      if (stop) return;
      const array = msg.data.data;
      setBarcodes({
        "-1": array[0],
        0: array[1],
        1: array[2],
        2: array[3],
      });
      setLoading(false);
    };
    setLoading(true);
    wasmWorker.postMessage({
      fn: "get-barcode-for-point",
      args: {
        grid_point: index,
      },
    });
    return () => {
      stop = true;
    };
  }, [index, setBarcodes, setLoading]);

  if (!index) return <p>Click on a grid point to see the barcode</p>;
  if (loading) return <p>hello im loading</p>;
  if (!barcodes) return <p>no loading but also no barcode??</p>;

  return <BarcodeInner key={String(index)} barcodes={barcodes} />;
};
