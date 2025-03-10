import { ExtractAtomValue, useAtomValue } from "jotai";
import styled from "styled-components";
import { selectedGridIndex, timelinePositionAtom } from "./state";
import { selectedMAFaceAtom } from "./useMars";
import { Index } from "mars_wasm";
import { HoverTooltip } from "./HoverTooltip";

const Selection_ = styled.div`
  position: absolute;
  bottom: 20px;
  margin: 0 auto;
  transform: translateX(-50%);
  left: 50%;
  z-index: 10;

  display: flex;
  flex-direction: column;
  gap: 10px;
  background: white;
  padding: 8px 16px;
  border-radius: 4px;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.17);
  border: 1px solid #ccc;

  > div {
    display: flex;
    flex-direction: row;
    gap: 20px;

    > div {
    }
  }
`;

const GridIndex = ({ index }: { index: Index | undefined }) => {
  if (!index) return null;
  return (
    <div>
      Grid{" "}
      <code>
        {`${index[0]}`},{`${index[1]}`},{`${index[2]}`}
      </code>
      <HoverTooltip>
        <p>Grid-coordinates for the selected grid vertex.</p>
      </HoverTooltip>
    </div>
  );
};

const MaFace = ({
  face,
}: {
  face: ExtractAtomValue<typeof selectedMAFaceAtom> | undefined;
}) => {
  if (!face) return null;
  return (
    <div>
      Axis({face.dim}) <code>f{face.fi}</code>
      <HoverTooltip>
        <p>
          Face-index for the selected face of the medial axis. The index of the
          axis is in parenthesis.
        </p>
      </HoverTooltip>
    </div>
  );
};

const Timeline = ({ timeline }: { timeline: number }) => {
  if (timeline === 0) return null;
  return (
    <div>
      Timeline <code>{timeline.toFixed(2)}</code>
      <HoverTooltip>
        <p>
          Simplices with that are born before this time are highlighted. Adjust
          the timeline in the top right panel.
        </p>
      </HoverTooltip>
    </div>
  );
};

export const Selection = () => {
  const gridIndex = useAtomValue(selectedGridIndex);
  const maFace = useAtomValue(selectedMAFaceAtom);
  const timeline = useAtomValue(timelinePositionAtom);

  // NOTE: don't show timeline if we don't have a grid index.
  if (gridIndex === undefined && maFace === undefined) return null;
  return (
    <Selection_>
      <h4>Selection</h4>
      <div>
        <MaFace face={maFace} />
        <GridIndex index={gridIndex} />
        <Timeline timeline={timeline} />
      </div>
    </Selection_>
  );
};
