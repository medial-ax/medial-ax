import { useAtomValue } from "jotai";
import styled from "styled-components";
import { showGridAtom, showMAAtom, showObjectAtom } from "./state";
import { dim2color } from "./constants";

const Item = styled.div`
  display: flex;
  gap: 6px;
  align-items: center;

  div {
    height: 16px;
    width: 16px;
    background: black;
    border: 1px solid #333;
  }
  span {
  }
`;

const Complex = () => {
  const show = useAtomValue(showObjectAtom);
  if (!show) return null;
  return (
    <Item>
      <div
        style={{
          background: "#4367ea",
          opacity: 0.8,
        }}
      />
      <span>Complex</span>
    </Item>
  );
};

const Grid = () => {
  const show = useAtomValue(showGridAtom);
  if (!show) return null;
  return (
    <Item>
      <div
        style={{
          borderRadius: "50%",
          background: "linear-gradient(0, #333, #777)",
        }}
      />
      <span>Grid</span>
    </Item>
  );
};

const MA0 = () => {
  const show = useAtomValue(showMAAtom)[0];
  if (!show) return null;
  return (
    <Item>
      <div style={{ background: dim2color[0] }} />
      <span>Axis 0</span>
    </Item>
  );
};

const MA1 = () => {
  const show = useAtomValue(showMAAtom)[1];
  if (!show) return null;
  return (
    <Item>
      <div style={{ background: dim2color[1] }} />
      <span>Axis 1</span>
    </Item>
  );
};

const MA2 = () => {
  const show = useAtomValue(showMAAtom)[2];
  if (!show) return null;
  return (
    <Item>
      <div style={{ background: dim2color[2] }} />
      <span>Axis 2</span>
    </Item>
  );
};

const Legend_ = styled.div`
  position: absolute;
  bottom: 0;
  right: 0;
  margin: 10px;

  display: flex;
  flex-direction: column;
  gap: 8px;

  background: white;
  padding: 8px 16px;
  border-radius: 4px;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.17);
  border: 1px solid #ccc;
`;
export const Legend = () => {
  return (
    <Legend_>
      <h4>Legend</h4>
      <Complex />
      <Grid />
      <MA0 />
      <MA1 />
      <MA2 />
    </Legend_>
  );
};
