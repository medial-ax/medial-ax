import styled from "styled-components";
import { BirthDeathPair, Json } from "./App";

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

const _width = 8;
const barSpacing = 20;
const bufferSpaceFactor = 0.1;

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
  box-sizing: border-box;
  position: absolute;
  border-radius: ${_width}px;

  & > ${HoverPopup} {
    opacity: 0;
  }

  &:hover {
    border: 2px solid color-mix(in srgb, ${(p) => p.color} 80%, red);
    cursor: pointer;
    & > ${HoverPopup} {
      opacity: 1;
    }
    z-index: 1;
  }
`;

const Bar = ({
  xmin,
  xmax,
  pair,
  top,
  color,
  label,
  dim,
}: {
  xmin: number;
  xmax: number;
  pair: BirthDeathPair;
  top: number;
  color: string;
  label: string;
  dim: number;
}) => {
  const padding = (xmax - xmin) * bufferSpaceFactor;
  const xrange = xmax - xmin + 2 * padding;

  const leftEnd = xmin - padding;
  const rightEnd = xmax + padding;

  const left = pair.birth == null ? leftEnd : pair.birth[0];
  const right = pair.death == null ? rightEnd : pair.death[0];
  const width = right - left;

  const leftPercent = ((left - leftEnd) / xrange) * 100;

  const isTrivial =
    pair.birth != null && pair.death != null && pair.birth[0] == pair.death[0];

  const topPx = isTrivial ? 0 : top * barSpacing;

  const width2 = isTrivial ? `${_width}px` : `${(width / xrange) * 100}%`;

  return (
    <BarDiv
      color={dim2color[dim]}
      style={{
        left: `${leftPercent}%`,
        width: width2,
        height: `${_width}px`,
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
  padding: 2rem;
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
}: {
  pairs: BirthDeathPair[];
  dim: number;
  xmin: number;
  xmax: number;
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

export const Barcode = ({ json }: { json: Json | undefined }) => {
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
  const xmax = max(
    allPairs.flatMap((x) => {
      if (x.death == null) return [];
      return [x.death[0]];
    })
  );

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        flex: 1,
      }}
    >
      <BarcodeDim
        xmin={xmin}
        xmax={xmax}
        pairs={json.triangle_barcode}
        dim={2}
      />
      <BarcodeDim xmin={xmin} xmax={xmax} pairs={json.edge_barcode} dim={1} />
      <BarcodeDim xmin={xmin} xmax={xmax} pairs={json.vertex_barcode} dim={0} />
      <BarcodeDim xmin={xmin} xmax={xmax} pairs={json.empty_barcode} dim={-1} />
    </div>
  );
};
