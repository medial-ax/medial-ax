import { useAtomValue } from "jotai";
import { defaultVineyardsGrid } from "../types";
import { BasicGridControls } from "./BasicGridControls";
import { MeshGridControls } from "./MeshGridControls";
import { mars } from "../global";
import { marsComplex, marsGrid } from "../useMars";

export const GridControls = () => {
  const grid = useAtomValue(marsGrid);
  const complex = useAtomValue(marsComplex);

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
            if (!complex) return;
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
