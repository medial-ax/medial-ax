import { useAtom, useAtomValue } from "jotai";
import { maFaceSelection, maFaceSelectionSwaps } from "./state";
import { Swap } from "./types";
import styled from "styled-components";
import { colors } from "./constants";

type SwapItem = Swap["v"][number];

const SwapLine_ = styled.li<{ selected: boolean }>`
  padding: 4px 8px;
  cursor: pointer;
  ${(p) => p.selected && `background: ${colors.surfaceSelected};`}
`;
const SwapLine = ({ s }: { s: SwapItem }) => {
  const [maFace, setMaFace] = useAtom(maFaceSelection);
  const selected = maFace?.selection?.includes(s) ?? false;
  if (!maFace) return null;
  return (
    <SwapLine_
      selected={selected}
      onClick={(e) => {
        if (e.ctrlKey || e.metaKey) {
          if (selected)
            setMaFace({
              ...maFace,
              selection: maFace.selection.filter((el) => el !== s),
            });
          else
            setMaFace({
              ...maFace,
              selection: maFace.selection.concat([s]),
            });
        } else {
          if (selected) setMaFace({ ...maFace, selection: [] });
          else setMaFace({ ...maFace, selection: [s] });
        }
      }}
    >
      <span>
        dim={s.dim} i={s.i} j={s.j}
      </span>
    </SwapLine_>
  );
};

const FaceInfo_ = styled.div`
  ul {
    list-style: none;
    padding: 0;
  }
`;
export const FaceInfo = () => {
  const swapsss = useAtomValue(maFaceSelectionSwaps);
  if (!swapsss)
    return (
      <div>
        <span>Select a face to show the swaps contributing to the face.</span>
      </div>
    );
  return (
    <FaceInfo_>
      <ul>
        {swapsss.flatMap((sps, j) =>
          sps[2].v.map((s, i) => <SwapLine key={`${j}-${i}`} s={s} />),
        )}
      </ul>
    </FaceInfo_>
  );
};
