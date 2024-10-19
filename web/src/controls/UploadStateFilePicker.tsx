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
          window.alert("TODO 597de85d-fff3-4e73-8e68-d1132038e8d8");
        }}
      />
    </label>
  );
};
