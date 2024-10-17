import { useSetAtom } from "jotai";
import { gridAtom } from "../state";
import { make_meshgrid_from_obj } from "mars_wasm";
import { toast } from "../Toast";

export const UploadMeshGridFilePicker = () => {
  const setGrid = useSetAtom(gridAtom);
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
            .then((text) => {
              const value = make_meshgrid_from_obj(text);
              setGrid({ type: "meshgrid", ...value });
            })
            .catch((err: string) => {
              toast("error", `Failed to parse .obj: ${err}`, 3);
            });
        }}
      />
    </label>
  );
};
