import styled from "styled-components";
import { BirthDeathPair, Json, selectedBirthDeathPair } from "./App";
import { atom, useAtomValue, useSetAtom } from "jotai";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

const min = (array: number[]): number => {
  let min = Infinity;
  for (const x of array) if (x < min) min = x;
  return min;
};

const max = (array: number[]): number => {
  let max = -Infinity;
  for (const x of array) if (max < x) max = x;
  return max;
};
// const xrangeAtom = atom<undefined | number[]>(undefined);

const _width = 4;
const barSpacing = 20;
const barcodePaddingPx = 20;

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
  xmin: number;
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
  // const watWidth = isTrivial ? `${_width}px` : `${(ourWidth / xrange) * 100}%`;

  const style = isTrivial
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

  const setSelectedBDPair = useSetAtom(selectedBirthDeathPair);

  return (
    <BarDiv
      color={dim2color[dim]}
      onClick={() => {
        setSelectedBDPair(pair);
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
  padding: 20px ${barcodePaddingPx}px;
  font-family: monospace;

  h4 {
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
  xmin,
  xmax,
  width,
}: {
  pairs: BirthDeathPair[];
  dim: number;
  xmin: number;
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
            xmin={xmin}
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
            xmin={xmin}
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

const TimelineBarDiv = styled.div`
  position: absolute;
  height: 100%;
  background: black;
  width: 2px;
  opacity: 0.5;

  cursor: ew-resize;
`;

const timelinePositionAtom = atom<number>(0);

const TimelineBar = ({ xmax }: { xmin: number; xmax: number }) => {
  const setTimelinePosition = useSetAtom(timelinePositionAtom);
  const [x, setX] = useState<number>(20);

  const ref = useRef<HTMLDivElement>(null);
  const onMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const [isDragging, setIsDragging] = useState(false);

  const onMoveCallback = useCallback(
    (e: MouseEvent) => {
      if (e.target === ref.current) return;
      if (isDragging) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { layerX } = e as any;
        setX(layerX);
        const bounds = (e.target as HTMLDivElement).getBoundingClientRect();
        const width = bounds.width;
        const widthMinusPadding = width - 2 * barcodePaddingPx;
        setTimelinePosition(
          px2time(layerX - barcodePaddingPx, xmax, widthMinusPadding)
        );
      }
    },
    [isDragging, setTimelinePosition, xmax]
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
      <div
        style={{
          position: "absolute",
          zIndex: isDragging ? 99 : -99,
          width: "100%",
          height: "100%",
          cursor: "ew-resize",
        }}
      />
      <TimelineBarDiv
        ref={ref}
        style={{ left: x, zIndex: 100 }}
        onMouseDown={(e) => {
          setIsDragging(true);
          e.preventDefault();
        }}
        onMouseUp={() => {
          console.log("timeline mouse up");
          setIsDragging(false);
        }}
      />
    </>
  );
};

export const Barcode = ({ json }: { json: Json | undefined }) => {
  const ref = useRef<HTMLDivElement>(null);
  const timelinePosition = useAtomValue(timelinePositionAtom);

  const [width, setWidth] = useState<number>(0);

  // TODO: listen to resize somehow here
  useLayoutEffect(() => {
    if (!ref.current) return;
    setWidth(ref.current.getBoundingClientRect().width - 2 * barcodePaddingPx);
  }, []);

  if (!json) return <div>hello</div>;

  const allPairs = json.empty_barcode
    .concat(json.vertex_barcode)
    .concat(json.edge_barcode)
    .concat(json.triangle_barcode);

  const xmin = min(
    allPairs.flatMap((x) => {
      if (x.birth == null) return [];
      return [x.birth[0]];
    })
  );
  const xmax =
    max(
      allPairs.flatMap((x) => {
        if (x.death == null) return [];
        return [x.death[0]];
      })
    ) * 1.2;

  return (
    <div
      ref={ref}
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        flex: 1,
        position: "relative",
      }}
    >
      <BarcodeDim
        width={width}
        xmin={xmin}
        xmax={xmax}
        pairs={json.triangle_barcode}
        dim={2}
      />
      <BarcodeDim
        width={width}
        xmin={xmin}
        xmax={xmax}
        pairs={json.edge_barcode}
        dim={1}
      />
      <BarcodeDim
        width={width}
        xmin={xmin}
        xmax={xmax}
        pairs={json.vertex_barcode}
        dim={0}
      />
      <BarcodeDim
        width={width}
        xmin={xmin}
        xmax={xmax}
        pairs={json.empty_barcode}
        dim={-1}
      />

      <div style={{ textAlign: "center", width: "100%" }}>
        {timelinePosition.toFixed(3)}
      </div>
      <TimelineBar xmin={xmin} xmax={xmax} />
    </div>
  );
};
