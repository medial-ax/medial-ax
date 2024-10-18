import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { complexAtom, gridAtom, showGridAtom } from "../state";
import { VineyardsGrid } from "mars_wasm";
import { useCallback, useState } from "react";
import { downloadText } from "../utils";
import { defaultVineyardsGrid } from "../types";
import { Input } from "../ui/Input";

export const BasicGridControls = ({ grid }: { grid: VineyardsGrid }) => {
  const setGrid = useSetAtom(gridAtom);
  const [showGrid] = useAtom(showGridAtom);

  const cplx = useAtomValue(complexAtom);
  const [numDots, setNumDots] = useState(5);

  const exportGridToObj = useCallback((grid: VineyardsGrid) => {
    let obj = "o grid\n";

    const [x0, y0, z0] = grid.corner;
    const s = grid.size;
    const [X, Y, Z] = grid.shape;

    const coord2ind = new Map<string, number>();
    let ind = 1;
    for (let i = 0; i < X; i++) {
      for (let j = 0; j < Y; j++) {
        for (let k = 0; k < Z; k++) {
          obj += `v ${x0 + i * s} ${y0 + j * s} ${z0 + k * s}\n`;
          coord2ind.set(`${i}-${j}-${k}`, ind);
          ind++;
        }
      }
    }

    for (let i = 0; i < X; i++) {
      for (let j = 0; j < Y; j++) {
        for (let k = 0; k < Z; k++) {
          const us = coord2ind.get(`${i}-${j}-${k}` as const);
          if (us === undefined) throw new Error("should not be here us");

          if (i != X - 1) {
            const adj = coord2ind.get(`${i + 1}-${j}-${k}` as const);
            if (adj === undefined) throw new Error("should not be here x");
            obj += `l ${us} ${adj}\n`;
          }
          if (j != Y - 1) {
            const adj = coord2ind.get(`${i}-${j + 1}-${k}` as const);
            if (adj === undefined) throw new Error("should not be here y");
            obj += `l ${us} ${adj}\n`;
          }
          if (k != Z - 1) {
            const adj = coord2ind.get(`${i}-${j}-${k + 1}` as const);
            if (adj === undefined) throw new Error("should not be here z");
            obj += `l ${us} ${adj}\n`;
          }
        }
      }
    }

    downloadText(obj, "grid.obj");
  }, []);

  if (!grid || grid.type !== "grid")
    return (
      <>
        <h3>Grid controls</h3>
        <button
          disabled={!cplx}
          title={
            cplx
              ? undefined
              : "You need a complex before you can make the grid."
          }
          style={{ width: "fit-content", alignSelf: "center" }}
          onClick={() => {
            if (!cplx) return;
            setGrid(defaultVineyardsGrid(cplx.complex, numDots));
          }}
        >
          Make grid
        </button>
      </>
    );

  return (
    <>
      <h3>Grid controls</h3>
      <div className="row">
        <button
          disabled={!showGrid}
          style={{ width: "fit-content" }}
          onClick={() => {
            if (!cplx) return;
            setGrid(defaultVineyardsGrid(cplx.complex, numDots));
          }}
        >
          Reset grid
        </button>

        <button
          disabled={!showGrid}
          style={{ width: "fit-content" }}
          onClick={() => {
            exportGridToObj(grid);
          }}
        >
          Download grid
        </button>
      </div>

      <fieldset className="ranges-with-number">
        <p>Density</p>
        <input
          disabled={!showGrid}
          type="range"
          min={1}
          max={20}
          value={numDots}
          onChange={(e) => {
            const n = Number(e.target.value);
            setNumDots(n);
            setGrid(defaultVineyardsGrid(cplx!.complex, n));
          }}
        />
        <span>{numDots}</span>

        <p>Grid corner x</p>
        <input
          type="range"
          min={-2}
          max={2}
          step={0.01}
          value={grid.corner[0]}
          onChange={(e) => {
            const x = Number(e.target.value);
            setGrid({ ...grid, corner: [x, grid.corner[1], grid.corner[2]] });
          }}
          disabled={!showGrid}
        />
        <Input
          type="number"
          step={0.01}
          style={{ width: "5rem" }}
          value={grid.corner[0]}
          onChange={(e) => {
            const x = parseFloat(e.target.value);
            setGrid({ ...grid, corner: [x, grid.corner[1], grid.corner[2]] });
          }}
        />

        <p>Grid corner y</p>
        <input
          type="range"
          min={-2}
          max={2}
          step={0.01}
          value={grid.corner[1]}
          onChange={(e) => {
            const y = Number(e.target.value);
            setGrid({ ...grid, corner: [grid.corner[0], y, grid.corner[2]] });
          }}
          disabled={!showGrid}
        />
        <Input
          type="number"
          step={0.01}
          style={{ width: "5rem" }}
          value={grid.corner[1]}
          onChange={(e) => {
            const y = parseFloat(e.target.value);
            setGrid({ ...grid, corner: [grid.corner[0], y, grid.corner[2]] });
          }}
        />

        <p>Grid corner z</p>
        <input
          type="range"
          min={-2}
          max={2}
          step={0.01}
          value={grid.corner[2]}
          onChange={(e) => {
            const z = Number(e.target.value);
            setGrid({ ...grid, corner: [grid.corner[0], grid.corner[1], z] });
          }}
          disabled={!showGrid}
        />
        <Input
          type="number"
          step={0.01}
          style={{ width: "5rem" }}
          value={grid.corner[2]}
          onChange={(e) => {
            const z = parseFloat(e.target.value);
            setGrid({ ...grid, corner: [grid.corner[0], grid.corner[1], z] });
          }}
        />

        <p>Grid size</p>
        <input
          type="range"
          min={0.01}
          max={1}
          step={0.01}
          value={grid?.size}
          onChange={(e) => setGrid({ ...grid, size: Number(e.target.value) })}
          disabled={!showGrid}
        />
        <span>{grid.size.toFixed(3)}</span>
      </fieldset>

      <div className="row">
        <button
          onClick={() => {
            setGrid({
              ...grid,
              size: grid.size / 2,
              shape: [
                grid.shape[0] + grid.shape[0] - 1,
                grid.shape[1] + grid.shape[1] - 1,
                grid.shape[2] + grid.shape[2] - 1,
              ],
            });
          }}
          disabled={!showGrid}
        >
          Split grid
        </button>
        <button
          onClick={() => {
            setGrid({
              ...grid,
              size: grid.size * 2,
              shape: [
                Math.ceil(grid.shape[0] / 2),
                Math.ceil(grid.shape[1] / 2),
                Math.ceil(grid.shape[2] / 2),
              ],
            });
          }}
          disabled={!showGrid}
        >
          Merge grid
        </button>
      </div>

      <fieldset className="ranges-with-number">
        <p>Grid shape x</p>
        <input
          type="range"
          min={1}
          max={50}
          value={grid.shape[0]}
          onChange={(e) => {
            const x = Number(e.target.value);
            setGrid({ ...grid, shape: [x, grid.shape[1], grid.shape[2]] });
          }}
          disabled={!showGrid}
        />
        <p>{grid.shape[0]}</p>
        <p>Grid shape y</p>
        <input
          type="range"
          min={1}
          max={50}
          value={grid.shape[1]}
          onChange={(e) => {
            const y = Number(e.target.value);
            setGrid({ ...grid, shape: [grid.shape[0], y, grid.shape[2]] });
          }}
          disabled={!showGrid}
        />
        <p>{grid.shape[1]}</p>
        <p>Grid shape z</p>
        <input
          type="range"
          min={1}
          max={50}
          value={grid.shape[2]}
          onChange={(e) => {
            const z = Number(e.target.value);
            setGrid({ ...grid, shape: [grid.shape[0], grid.shape[1], z] });
          }}
          disabled={!showGrid}
        />
        <p>{grid.shape[2]}</p>
      </fieldset>
    </>
  );
};
