import { HoverTooltip } from "../HoverTooltip";
import { toast } from "../Toast";
import { mars } from "../global";

export const UploadObjFilePicker = () => {
  return (
    <label className="file">
      <p>
        Import <code>.obj</code>
      </p>
      <input
        type="file"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          f.text()
            .then((text) => mars().load_complex(text))
            .catch((err: string) => {
              toast("error", `Failed to parse .obj: ${err}`, 3);
            });
        }}
      />
      <HoverTooltip right>
        <p>
          Upload a complex from an <code>.obj</code> file.
        </p>
      </HoverTooltip>
    </label>
  );
};
