import { useAtomValue } from "jotai";
import { gridAtom } from "../state";
import { defaultVineyardsGrid } from "../types";
import { BasicGridControls } from "./BasicGridControls";
import { MeshGridControls } from "./MeshGridControls";
import { mars } from "../global";
import { marsComplexTick } from "../useMars";
import { useMemo } from "react";

export const GridControls = () => {
  const grid = useAtomValue(gridAtom);
  const _c = useAtomValue(marsComplexTick);

  const complex = useMemo(() => {
    _c; // reload at need
    return mars().complex;
  }, [_c]);

  if (!grid)
    return (
      <>
        <h3>Grid controls</h3>
        <button
          disabled={!complex}
          title={
            complex
              ? undefined
              : "You need a complex before you can make the grid."
          }
          style={{ width: "fit-content", alignSelf: "center" }}
          onClick={() => {
            mars().grid = defaultVineyardsGrid(complex);
          }}
        >
          Make grid
        </button>
        <button
          onClick={() => {
            console.log(complex);
            console.log(mars().grid);
          }}
        >
          DEBUG
        </button>
      </>
    );

  if (grid.type === "grid") return <BasicGridControls grid={grid} />;
  if (grid.type === "meshgrid") return <MeshGridControls grid={grid} />;
  return null;
};
