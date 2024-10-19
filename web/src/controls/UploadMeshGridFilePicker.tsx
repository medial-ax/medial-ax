import { toast } from "../Toast";

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
            .then((text) => {
              window.alert("TODO");
            })
            .catch((err: string) => {
              toast("error", `Failed to parse .obj: ${err}`, 3);
            });
        }}
      />
    </label>
  );
};
