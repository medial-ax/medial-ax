import { mars } from "../global";
import { HoverTooltip } from "../HoverTooltip";

export const UploadStateFilePicker = () => {
  return (
    <label className="file">
      <p>Import state from file</p>
      <input
        type="file"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          const bytes = await f.arrayBuffer();
          mars().deserialize_from_cli(new Uint8Array(bytes));
        }}
      />
      <HoverTooltip>
        <p>Upload a state file computed from the CLI.</p>
      </HoverTooltip>
    </label>
  );
};
