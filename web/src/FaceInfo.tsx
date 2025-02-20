import { useAtomValue } from "jotai";
import { Swap } from "./types";
import styled from "styled-components";
import { colors } from "./constants";
import { Center } from "./Diagram";
import { swapsResponsibleForMAFace } from "./useMars";

type SwapItem = Swap["v"][number];

const SwapLine_ = styled.li<{ selected: boolean }>`
  padding: 4px 8px;
  cursor: pointer;
  ${(p) => p.selected && `background: ${colors.surfaceSelected};`}
`;
const SwapLine = ({ s }: { s: SwapItem }) => {
  return (
    <SwapLine_ selected={false}>
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
        part of the medial axis.
      </p>
      <FaceInfo_>
        <ul>
          {swaps[2].map((s) => (
            <SwapLine key={`${s.i}-${s.j}`} s={s} />
          ))}
        </ul>
      </FaceInfo_>
    </div>
  );
};
