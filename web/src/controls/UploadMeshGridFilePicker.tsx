import { HoverTooltip } from "../HoverTooltip";
import { toast } from "../Toast";
import { mars } from "../global";

export const UploadMeshGridFilePicker = () => {
  return (
    <label className="file">
      <p>
        Import grid from <code>.obj</code>
      </p>
      <input
        type="file"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          f.text()
            .then((text) => mars().load_mesh_grid(text))
            .catch((err: string) => {
              toast("error", `Failed to parse .obj: ${err}`, 3);
            });
        }}
      />
      <HoverTooltip right>
        <p>
          Upload a grid from an <code>.obj</code> file. Only edges will be used.
        </p>
      </HoverTooltip>
    </label>
  );
};
