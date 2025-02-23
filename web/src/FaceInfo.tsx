import { useAtomValue } from "jotai";
import styled from "styled-components";
import { Center } from "./Diagram";
import { swapsResponsibleForMAFace } from "./useMars";
import { useAtom } from "jotai";
import { selectedFaceInfoSwaps } from "./state";
import { useEffect } from "react";
import { colors } from "./constants";

const FaceInfo_ = styled.div`
  table {
    border-collapse: collapse;

    tr {
      border-bottom: 1px solid #aaa;
      cursor: pointer;
    }
    tr:has(th) {
      border-color: #333;
      border-width: 2px;
      position: sticky;
      top: 0;
      box-shadow: 0 2px 2px -1px rgba(0, 0, 0, 0.4);
      background: white;
    }
    tr:not(:has(th)):hover {
      background: ${colors.surfaceSelected};
    }

    tr[data-selected="true"] {
      background: ${colors.surfaceSelected}a0;
    }

    td,
    th {
      min-width: 44px;
      text-align: end;
      padding: 1px 0.8rem;
      font-variant-numeric: tabular-nums;
    }
  }

  ul {
    list-style: none;
    padding: 0;
  }
`;
export const FaceInfo = () => {
  const swaps = useAtomValue(swapsResponsibleForMAFace);
  const [selected, setSelected] = useAtom(selectedFaceInfoSwaps);

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
        <table>
          <thead>
            <tr>
              <th>dim</th>
              <th>i</th>
              <th>j</th>
            </tr>
          </thead>
          <tbody>
            {swaps[2].map((s, i) => {
              const sel = selected.includes(s);
              return (
                <tr
                  key={i}
                  data-selected={sel}
                  onClick={() => {
                    if (sel) setSelected((curr) => curr.filter((c) => c !== s));
                    else setSelected((curr) => curr.concat(s));
                  }}
                >
                  <td>{s.dim}</td>
                  <td>{s.i}</td>
                  <td>{s.j}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </FaceInfo_>
    </div>
  );
};
