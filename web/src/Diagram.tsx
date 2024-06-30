import { useRef, useState } from "react";
import { BarcodeType, gridForSwapsAtom, gridOutOfSync } from "./state";
import { BirthDeathPair, Index } from "./types";
import { max, range } from "./utils";
import React from "react";
import styled from "styled-components";
import { colors } from "./constants";
import { useAtomValue } from "jotai";

const Svg = styled.svg<{ scale: number }>`
  .point {
    &[data-selected="true"] {
      stroke: #444;
      stroke-width: ${(p) => p.scale * 2};
      z-index: 2;
    }

    &.dim-0 {
      fill: ${colors.dim0};
    }
    &.dim-1 {
      fill: ${colors.dim1};
    }
    &.dim-2 {
      fill: ${colors.dim2};
    }

    &:hover {
      cursor: pointer;
      stroke: #444;
      stroke-width: ${(p) => p.scale * 3};
    }
  }
`;

const Inner = ({ barcodes }: { index: Index; barcodes: BarcodeType }) => {
  const [selected, setSelected] = useState<BirthDeathPair[]>([]);

  const allPairs = (barcodes[-1] ?? [])
    .concat(barcodes[0] ?? [])
    .concat(barcodes[1] ?? [])
    .concat(barcodes[2] ?? []);

  const xmax = max(
    allPairs.flatMap((x) => {
      if (x.death == null) return [];
      return [x.death[0]];
    }),
  );
  const xmax2 = xmax * 1.1;

  const [width, setWidth] = useState(1);

  // const t2px = (t: number): number => (t / xmax) * width;
  const px2t = (px: number): number => (px / width) * xmax2;

  const padding = px2t(50); // space around the diagram for legend and ticks

  const numTicks = 10;
  const tickFloat = xmax / numTicks;
  let tickRounded = Math.round(tickFloat);
  if (tickRounded === 0) tickRounded = 1 / Math.round(numTicks / xmax);
  const actualNumberOfTicks = Math.floor(xmax / tickRounded) + 1;
  const tickheight = px2t(4);

  return (
    <div style={{ padding: "1rem" }}>
      <h3>Persistence diagram</h3>
      <Svg
        scale={px2t(1)}
        ref={(r) => {
          if (r) setWidth(r.getBoundingClientRect()?.width ?? 0);
        }}
        viewBox={`${-padding} ${-padding} ${xmax2 + 2 * padding} ${xmax2 + 2 * padding}`}
        onClick={() => setSelected([])}
      >
        <g transform={`translate(0, ${xmax2}) scale(1, -1)`}>
          <line
            x1="0"
            x2={xmax2}
            y1="0"
            y2={xmax2}
            stroke="#444444"
            strokeWidth={px2t(2)}
          />
          <rect
            x="0"
            y="0"
            width={xmax2}
            height={xmax2}
            fill="none"
            stroke="#444444"
            strokeWidth={px2t(2)}
          />

          {range(0, actualNumberOfTicks).map((i) => {
            const x = i * tickRounded;
            return (
              <React.Fragment key={i}>
                <line
                  x1={-tickheight}
                  y1={x}
                  x2={tickheight}
                  y2={x}
                  stroke="#444444"
                  strokeWidth={px2t(2)}
                />
                <g
                  transform={`translate(${-2 * tickheight}, ${x - tickRounded / 3.3})`}
                >
                  <text
                    transform={`scale(1, -1)`}
                    fontSize={px2t(14)}
                    textAnchor="end"
                    x={0}
                    y={-px2t(14)}
                  >
                    {x.toFixed(2)}
                  </text>
                </g>
                <line
                  x1={x}
                  y1={tickheight}
                  x2={x}
                  y2={-tickheight}
                  stroke="#444444"
                  strokeWidth={px2t(2)}
                />
                <g transform={`translate(${x}, ${-9 * tickheight})`}>
                  <text
                    transform={`rotate(-30) scale(1, -1)`}
                    fontSize={px2t(14)}
                    textAnchor="middle"
                    x={0}
                    y={-px2t(14)}
                  >
                    {x.toFixed(2)}
                  </text>
                </g>
              </React.Fragment>
            );
          })}

          {allPairs.map((b, i) => (
            <circle
              key={i}
              className={`point dim-${b.dim}`}
              cx={b.birth?.[0] ?? 0}
              cy={b.death?.[0] ?? xmax2}
              r={px2t(7)}
              data-selected={selected.includes(b)}
              onClick={(e) => {
                e.stopPropagation();
                if (e.shiftKey) {
                  if (selected.includes(b)) {
                    setSelected(selected.filter((bb) => bb != b));
                  } else {
                    setSelected(selected.concat([b]));
                  }
                } else {
                  setSelected([b]);
                }
              }}
            />
          ))}
          {selected.map((b, i) => {
            const x = b.birth?.[0] ?? 0;
            const y = b.death?.[0] ?? xmax2;
            return (
              <React.Fragment key={i}>
                <line
                  x1={x}
                  x2={x}
                  y1="0"
                  y2={y}
                  stroke="#444444"
                  strokeWidth={px2t(2)}
                  strokeDasharray={`${px2t(7)}`}
                />
                <line
                  x1={0}
                  x2={x}
                  y1={y}
                  y2={y}
                  stroke="#444444"
                  strokeWidth={px2t(2)}
                  strokeDasharray={`${px2t(7)}`}
                />
                <circle
                  key={i}
                  className={`point dim-${b.dim}`}
                  cx={x}
                  cy={y}
                  r={px2t(7)}
                  data-selected={selected.includes(b)}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (e.shiftKey) {
                      if (selected.includes(b)) {
                        setSelected(selected.filter((bb) => bb != b));
                      } else {
                        setSelected(selected.concat([b]));
                      }
                    } else {
                      setSelected([b]);
                    }
                  }}
                />
              </React.Fragment>
            );
          })}
        </g>
      </Svg>
      <span>hello</span>
    </div>
  );
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

export const Diagram = ({
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
          Compute the medial axes from the Controls panel to see the persistence
          diagram.
        </p>
      </Center>
    );

  if (gridIsOutOfSync)
    return (
      <Center>
        <p>
          Grid was changed after computing the medial axes.{" "}
          <strong>Recompute</strong> to see the persistence diagram.
        </p>
      </Center>
    );

  if (!index)
    return (
      <Center>
        <p>Click on a grid point to see the persistence diagram</p>
      </Center>
    );

  if (!barcodes)
    return (
      <Center>
        <p>No persistence diagram</p>
      </Center>
    );
  return <Inner index={index} barcodes={barcodes} />;
};
