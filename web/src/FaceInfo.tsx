import { useAtomValue, useSetAtom } from "jotai";
import { Swap } from "./types";
import styled from "styled-components";
import { colors } from "./constants";
import { Center } from "./Diagram";
import { swapsResponsibleForMAFace } from "./useMars";
import { useAtom } from "jotai";
import { selectedFaceInfoSwaps } from "./state";
import { useEffect } from "react";

type SwapItem = Swap["v"][number];

const SwapLine_ = styled.li<{ selected: boolean }>`
  padding: 4px 8px;
  cursor: pointer;
  ${(p) => p.selected && `background: ${colors.surfaceSelected};`}
`;
const SwapLine = ({ s }: { s: SwapItem }) => {
  const [selected, setSelected] = useAtom(selectedFaceInfoSwaps);

  const sel = selected.includes(s);

  return (
    <SwapLine_
      selected={sel}
      onClick={() => {
        if (sel) setSelected((curr) => curr.filter((c) => c !== s));
        else setSelected((curr) => curr.concat(s));
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
  const swaps = useAtomValue(swapsResponsibleForMAFace);
  const setSelected = useSetAtom(selectedFaceInfoSwaps);
  useEffect(() => {
    return () => {
      setSelected([]);
    };
  }, [setSelected, swaps]);

  if (!swaps)
    return (
      <Center>
        <p>Select a face to show the swaps contributing to the face.</p>
      </Center>
    );
  return (
    <div style={{ padding: "1rem" }}>
      <p>
        This list shows the interchanges responsible for the selected face being
        part of the medial axis. Click to highlight simplices.
      </p>
      <FaceInfo_>
        <ul>
          {swaps[2].map((s, i) => (
            <SwapLine key={i} s={s} />
          ))}
        </ul>
      </FaceInfo_>
    </div>
  );
};
