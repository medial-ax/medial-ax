import React from "react";
import styled, { CSSProperties } from "styled-components";

const Frame = styled.div`
  display: flex;
  flex: 1;
  border: 1px solid #ccc;
  border-radius: 6px;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.17);
  background: white;
`;

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
`;

const Headers = styled.div`
  display: flex;
  flex-direction: row;
  gap: 0.4rem;
  margin: 0 0.6rem;
  margin-bottom: -1px;
  z-index: 1;

  span {
    padding: 0 0.6rem;
    cursor: pointer;
    background: #eee;
    border-radius: 4px 4px 0 0;
    border: 1px solid #ccc;
  }

  span[aria-selected="true"] {
    background: #ffffff;
    border-radius: 4px 4px 0 0;
    border: 1px solid #ccc;
    border-bottom: 1px solid white;
  }
`;

export const Tabs = ({
  tab,
  setTab,
  titles,
  style,
  children,
}: React.PropsWithChildren<{
  tab: number;
  setTab: (n: number) => void;
  titles: string[];
  style?: CSSProperties;
}>) => {
  const array = React.Children.toArray(children);
  const child = array[tab];
  return (
    <Wrapper style={style}>
      <Headers>
        {array.map((_, i) => (
          <span
            key={titles[i]}
            aria-selected={tab === i}
            onClick={() => {
              setTab(i);
            }}
          >
            {titles[i] ?? "Undefined"}
          </span>
        ))}
      </Headers>
      <Frame className="tabs-content">{child}</Frame>
    </Wrapper>
  );
};
