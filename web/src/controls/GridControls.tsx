import { useAtomValue, useSetAtom } from "jotai";
import { complexAtom, gridAtom } from "../state";
import { defaultVineyardsGrid } from "../types";
import { BasicGridControls } from "./BasicGridControls";
import { MeshGridControls } from "./MeshGridControls";

export const GridControls = () => {
  const grid = useAtomValue(gridAtom);
  const setGrid = useSetAtom(gridAtom);
  const cplx = useAtomValue(complexAtom);

  if (!grid)
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
            setGrid(defaultVineyardsGrid(cplx.complex));
          }}
        >
          Make grid
        </button>
      </>
    );

  if (grid.type === "grid") return <BasicGridControls grid={grid} />;
  if (grid.type === "meshgrid") return <MeshGridControls grid={grid} />;
  return null;
};
