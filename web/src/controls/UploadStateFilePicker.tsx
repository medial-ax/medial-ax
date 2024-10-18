import { ExtractAtomValue, useAtom, useAtomValue, useSetAtom } from "jotai";
import {
  allPruningParamsAtom,
  complexAtom,
  gridAtom,
  gridForSwapsAtom,
  swapsAtom,
} from "../state";
import { run } from "../work";

export const UploadStateFilePicker = () => {
  const grid = useAtomValue(gridAtom);
  const complex = useAtomValue(complexAtom);
  const allPruningParams = useAtomValue(allPruningParamsAtom);
  const [_, setSwaps] = useAtom(swapsAtom);
  const setGridForSwaps = useSetAtom(gridForSwapsAtom);

  return (
    <label className="file">
      <p>Import state from file</p>
      <input
        type="file"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          const bytes = await f.arrayBuffer();
          await run(
            "create-empty-state",
            {
              grid,
              complex: complex?.complex,
            },
            () => {},
          );

          await run(
            "load-state",
            {
              bytes,
              index: [0, 0, 0],
            },
            () => {},
          );

          const pruned: ExtractAtomValue<typeof swapsAtom> = {
            0: await run(
              "prune-dimension",
              {
                dim: 0,
                params: allPruningParams[0],
              },
              () => {},
            ),
            1: await run(
              "prune-dimension",
              {
                dim: 1,
                params: allPruningParams[1],
              },
              () => {},
            ),
            2: await run(
              "prune-dimension",
              {
                dim: 2,
                params: allPruningParams[2],
              },
              () => {},
            ),
          };

          setSwaps(pruned);
          setGridForSwaps(grid);
        }}
      />
    </label>
  );
};
