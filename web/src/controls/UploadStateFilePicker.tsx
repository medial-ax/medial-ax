import { mars } from "../global";

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
    </label>
  );
};
