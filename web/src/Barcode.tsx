import styled, { CSSProperties } from "styled-components";
import { BirthDeathPair, Index } from "./types";
import {
  BarcodeType,
  barcodeAtom,
  gridForSwapsAtom,
  gridOutOfSync,
  selectedBirthDeathPair,
  selectedGridIndex,
  swapsAtom,
  timelinePositionAtom,
} from "./state";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { clamp, max } from "./utils";
import { colors } from "./constants";
import { Tabs } from "./Tab";
import "./Barcode.css";
import { run } from "./work";
import { HoverTooltip } from "./HoverTooltip";

const _width = 4;
const barSpacing = 20;
const barcodePaddingPx = 40;

const dim2label: Record<number, string> = {
  "-1": "ø",
  0: "v",
  1: "e",
  2: "t",
};

const Center = styled.div`
  flex: 1;
  margin: 1rem;
  text-align: center;
  align-self: center;
  margin-bottom: 50%;
  p {
    color: #888;
  }
`;

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
  dim,
}: {
  width: number;
  xmax: number;
  pair: BirthDeathPair;
  top: number;
  color: string;
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

  const [timeline, setTimeline] = useAtom(timelinePositionAtom);
  const setSelectedBDPair = useSetAtom(selectedBirthDeathPair);

  return (
    <BarDiv
      color={dim2color[dim]}
      onClick={(e) => {
        e.stopPropagation();
        setSelectedBDPair(pair);

        if (pair.birth) {
          const f = pair.birth[0];
          if (2e-3 < Math.abs(timeline - f)) {
            setTimeline(f + 0.001);
            return;
          }
        }
        if (pair.death) {
          const f = pair.death[0];
          if (2e-3 < Math.abs(timeline - f)) {
            setTimeline(f + 0.001);
            return;
          }
        }
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
              {dim2label[dim]}
              {pair.birth[1]}
            </BarcodeLabels>
          )}
          {pair.death != null && (
            <BarcodeLabels
              style={{
                left: `100%`,
              }}
            >
              {dim2label[dim + 1]}
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
  background: white;
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
      <div
        style={{
          position: "relative",
          height: `${(0.5 + nontrivials.length) * barSpacing}px`,
        }}
      >
        {trivials.map((x, i) => (
          <Bar
            key={i}
            width={width}
            xmax={xmax}
            pair={x}
            top={0}
            color={dim2color[dim]}
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
        setTimelinePosition(clamp(pos, 0, xmax));
      }
    },
    [isDragging, setTimelinePosition, xmax],
  );

  const { width } = redRef.current?.getBoundingClientRect() ?? { width: 0 };
  const x = useMemo(() => {
    const px = time2px(timelinePosition, xmax, width - 2 * barcodePaddingPx);
    return px + barcodePaddingPx;
  }, [timelinePosition, width, xmax]);

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
  useEffect(() => {
    return () => {
      setSelectedBDPair(undefined);
    };
  }, [setSelectedBDPair]);

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

  const allPairs = (barcodes[-1] ?? [])
    .concat(barcodes[0] ?? [])
    .concat(barcodes[1] ?? [])
    .concat(barcodes[2] ?? []);

  const xmax =
    max(
      allPairs.flatMap((x) => {
        if (x.death == null) return [];
        return [x.death[0]];
      }),
    ) * 1.2;

  return (
    <div
      className="barcode-wrapper"
      onClick={() => {
        setSelectedBDPair(undefined);
      }}
      ref={ref}
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
      <div style={{ display: "flex", justifyContent: "center", gap: "0.3rem" }}>
        <span>Distance squared</span>
        <HoverTooltip>
          The distance square function is everywhere differentiable so we use it
          as the filtration function.
        </HoverTooltip>
      </div>
    </div>
  );
};

export const Barcode = ({
  index,
  barcodes,
}: {
  index: Index | undefined;
  barcodes: BarcodeType | undefined;
}) => {
  const haveComputed = useAtomValue(gridForSwapsAtom) !== undefined;
  const gridIsOutOfSync = useAtomValue(gridOutOfSync);

  if (!haveComputed)
    return (
      <Center>
        <p>
          Compute the medial axes from the Controls panel to see the barcode.
        </p>
      </Center>
    );

  if (gridIsOutOfSync)
    return (
      <Center>
        <p>
          Grid was changed after computing the medial axes.{" "}
          <strong>Recompute</strong> to see barcode.
        </p>
      </Center>
    );

  if (!index)
    return (
      <Center>
        <p>Click on a grid point to see the barcode</p>
      </Center>
    );

  if (!barcodes)
    return (
      <Center>
        <p>No barcode</p>
      </Center>
    );

  return <BarcodeInner key={String(index)} barcodes={barcodes} />;
};

const triangle = {
  up: {
    filled: "▲",
    empty: "△",
  },
  down: {
    filled: "▼",
    empty: "▽",
  },
} as const;

const Sort = ({
  dir,
  onClick,
}: {
  dir: undefined | keyof typeof triangle;
  onClick: () => void;
}) => {
  const ch = !dir
    ? triangle.down.empty
    : dir === "up"
      ? triangle.up.filled
      : triangle.down.filled;
  return (
    <span onClick={onClick} className="sort-icon">
      {ch}
    </span>
  );
};

const Table = () => {
  const [hideZero, setHideZero] = useState<boolean>(false);
  const [dim, setDim] = useState<0 | 1 | 2>(0);
  const fullBarcode = useAtomValue(barcodeAtom)?.[dim];
  const [timeline, setTimeline] = useAtom(timelinePositionAtom);

  const [sortmode, setSortmode] = useState<
    | {
        key: string;
        value: "up" | "down";
      }
    | undefined
  >(undefined);

  const barcode = hideZero
    ? (fullBarcode ?? []).filter(
        (b) => !b.death || !b.birth || 0 < Math.abs(b.death[0] - b.birth[0]),
      )
    : [...(fullBarcode ?? [])];

  const sortedBarcode = (() => {
    if (sortmode === undefined) return barcode;
    if (sortmode.key === "birth")
      barcode.sort(
        (a, b) => (a.birth?.[0] as number) - (b.birth?.[0] as number),
      );
    if (sortmode.key === "death")
      barcode.sort(
        (a, b) => (a.death?.[0] as number) - (b.death?.[0] as number),
      );
    if (sortmode.key === "s1")
      barcode.sort(
        (a, b) => (a.birth?.[1] as number) - (b.birth?.[1] as number),
      );
    if (sortmode.key === "s2")
      barcode.sort(
        (a, b) => (a.death?.[1] as number) - (b.death?.[1] as number),
      );
    if (sortmode.value == "up") barcode.reverse();
    return barcode;
  })();

  const toggleSort = useCallback(
    (key: string) => {
      if (sortmode === undefined || sortmode?.key !== key) {
        setSortmode({ key, value: "down" });
      } else if (sortmode.value === "down") {
        setSortmode({ key, value: "up" });
      } else {
        setSortmode(undefined);
      }
    },
    [sortmode],
  );

  if (!barcode) return <h3>No barcode</h3>;

  return (
    <div className="persistence-pairs-table">
      <label>
        <p>Dimension:</p>
        <select
          value={dim}
          onChange={(e) => {
            setDim(parseInt(e.target.value) as 0 | 1 | 2);
          }}
        >
          <option value={-1}>-1</option>
          <option value={0}>0</option>
          <option value={1}>1</option>
          <option value={2}>2</option>
        </select>
      </label>
      <h3>Persistence pairs for dim {dim}</h3>
      <label>
        <input
          type="checkbox"
          checked={hideZero}
          onChange={(e) => {
            setHideZero(e.target.checked);
          }}
        />
        <p>Hide trivial persistence</p>
      </label>
      <div>
        <table>
          <thead>
            <tr>
              <th scope="col">
                <Sort
                  onClick={() => toggleSort("birth")}
                  dir={sortmode?.key === "birth" ? sortmode.value : undefined}
                />
                Birth
              </th>
              <th scope="col">
                <Sort
                  onClick={() => toggleSort("death")}
                  dir={sortmode?.key === "death" ? sortmode.value : undefined}
                />
                Death
              </th>
              <th scope="col">
                <Sort
                  onClick={() => toggleSort("s1")}
                  dir={sortmode?.key === "s1" ? sortmode.value : undefined}
                />
                <code>s1</code>
              </th>
              <th scope="col">
                <Sort
                  onClick={() => toggleSort("s2")}
                  dir={sortmode?.key === "s2" ? sortmode.value : undefined}
                />
                <code>s2</code>
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedBarcode.map((s, i) => {
              const birth = s.birth ? s.birth[0].toFixed(3) : "-";
              const death = s.death ? s.death[0].toFixed(3) : "-";
              const birthI = s.birth ? s.birth[1] : "-";
              const deathI = s.death ? s.death[1] : "-";
              return (
                <tr
                  key={i}
                  onClick={() => {
                    if (s.birth) {
                      const f = s.birth[1];
                      if (1e-3 < Math.abs(timeline - f)) setTimeline(f);
                    }
                    if (s.death) {
                      const f = s.death[1];
                      if (1e-3 < Math.abs(timeline - f)) setTimeline(f);
                    }
                  }}
                >
                  <td>{birth}</td>
                  <td>{death}</td>
                  <td>{birthI}</td>
                  <td>{deathI}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export const BarcodeTabs = ({ live }: { live: boolean }) => {
  const index = useAtomValue(selectedGridIndex);
  const [barcodes, setBarcodes] = useAtom(barcodeAtom);
  const [loading, setLoading] = useState(false);
  const swaps = useAtomValue(swapsAtom);
  const haveSwaps =
    swaps[0].length > 0 || swaps[1].length > 0 || swaps[2].length > 0;

  useEffect(() => {
    if (!index || !live) return;
    if (!haveSwaps) return;

    let stop = false;
    setLoading(true);
    run("get-barcode-for-point", {
      grid_point: index,
    })
      .then((arr) => {
        if (!stop)
          setBarcodes({
            "-1": arr[0],
            0: arr[1],
            1: arr[2],
            2: arr[3],
          });
      })
      .catch((e) => {
        window.alert(`bad: ${e.message}`);
      })
      .finally(() => {
        setLoading(false);
      });

    return () => {
      stop = true;
    };
  }, [haveSwaps, index, live, setBarcodes, setLoading]);

  if (loading) return null;

  return (
    <Tabs titles={["Barcodes", "Diagram", "Vineyards", "Table"]}>
      <Barcode index={index} barcodes={barcodes} />
      <div>
        <p>hello</p>
      </div>
      <div>
        <p>Sånn er det {`\u{1F377}`}</p>
      </div>
      <div>
        <h2>Table</h2>
        <Table />
      </div>
    </Tabs>
  );
};
