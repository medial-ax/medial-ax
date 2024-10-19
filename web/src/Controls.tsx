import { useAtom, useAtomValue } from "jotai";
import {
  Dim,
  allSettingsAtom,
  complexAtom,
  gridAtom,
  gridRadiusAtom,
  keypointRadiusAtom,
  maWireframeAtom,
  menuOpenAtom,
  showGridAtom,
  showMAAtom,
  showObjectAtom,
  swapsAtom,
  wireframeAtom,
} from "./state";
import { useCallback, useState } from "react";
import { dualFaceQuad } from "./medialaxes";
import { downloadText } from "./utils";
import "./Controls.css";
import { HoverTooltip } from "./HoverTooltip";
import { BuiltinMeshes } from "./controls/BuiltinMeshes";
import { UploadMeshGridFilePicker } from "./controls/UploadMeshGridFilePicker";
import { UploadObjFilePicker } from "./controls/UploadComplexFilePicker";
import { UploadStateFilePicker } from "./controls/UploadStateFilePicker";
import { GridControls } from "./controls/GridControls";
import { MedialAxes } from "./controls/MedialAxes";
import { medialAxesPositions } from "./useMars";

const RenderOptions = () => {
  const maPositions = useAtomValue(medialAxesPositions);

  const [keypointRadius, setKeypointRadius] = useAtom(keypointRadiusAtom);
  const [gridRadius, setGridRadius] = useAtom(gridRadiusAtom);
  const [showObject, setShowObject] = useAtom(showObjectAtom);
  const [wireframe, setWireframe] = useAtom(wireframeAtom);
  const [showMA, setShowMa] = useAtom(showMAAtom);
  const [showGrid, setShowGrid] = useAtom(showGridAtom);

  const [maWireframe, setMaWireframe] = useAtom(maWireframeAtom);

  return (
    <>
      <h3>Render options</h3>
      <label>
        <input
          type="checkbox"
          checked={showObject}
          onChange={(e) => setShowObject(e.target.checked)}
        />
        <p>Show object</p>
      </label>
      <label>
        <input
          type="checkbox"
          checked={showGrid}
          onChange={(e) => {
            setShowGrid(e.target.checked);
          }}
        />
        <p>Show grid</p>
      </label>
      <label>
        <input
          type="checkbox"
          checked={wireframe}
          onChange={(e) => setWireframe(e.target.checked)}
        />
        <p>Wireframe</p>
      </label>
      <fieldset className="ranges-with-number">
        <p>Grid point size</p>
        <input
          type="range"
          min={0.001}
          max={0.1}
          step={0.001}
          value={gridRadius}
          onChange={(e) => {
            setGridRadius(Number(e.target.value));
          }}
        />
        <p>{gridRadius.toFixed(3)}</p>
        <p>Keypoint radius</p>
        <input
          type="range"
          min={0.01}
          max={0.5}
          step={0.001}
          value={keypointRadius}
          onChange={(e) => setKeypointRadius(Number(e.target.value))}
        />
        <p>{keypointRadius.toFixed(3)}</p>
      </fieldset>

      <label>
        <input
          type="checkbox"
          checked={maWireframe}
          onChange={(e) => setMaWireframe(e.target.checked)}
        />
        <p>Medial axes wireframe</p>
      </label>

      <fieldset>
        <legend>Show medial axes</legend>
        <label>
          <input
            type="checkbox"
            checked={showMA[0]}
            onChange={(e) => {
              setShowMa((c) => ({ ...c, 0: e.target.checked }));
            }}
            disabled={maPositions[0].length === 0}
          />
          <p>Zeroth</p>
        </label>
        <label>
          <input
            type="checkbox"
            checked={showMA[1]}
            onChange={(e) => {
              setShowMa((c) => ({ ...c, 1: e.target.checked }));
            }}
            disabled={maPositions[1].length === 0}
          />
          <p> First </p>
        </label>
        <label>
          <input
            type="checkbox"
            checked={showMA[2]}
            onChange={(e) => {
              setShowMa((c) => ({ ...c, 2: e.target.checked }));
            }}
            disabled={maPositions[2].length === 0}
          />
          <p> Second </p>
        </label>
      </fieldset>
    </>
  );
};

export const Menu = () => {
  const [cplx] = useAtom(complexAtom);
  const [grid] = useAtom(gridAtom);
  const [swaps] = useAtom(swapsAtom);

  const [open, setOpen] = useAtom(menuOpenAtom);
  const shownMA = useAtomValue(showMAAtom);
  const [exportVisible, setExportVisible] = useState(true);

  const [allSettings, setAllSettings] = useAtom(allSettingsAtom);

  const exportMAtoObj = useCallback(() => {
    if (!grid) return;
    if (grid.type === "meshgrid") {
      window.alert("Cannot export using meshgrid yet");
      return;
    }
    let obj = "";
    let v = 1;
    for (const ma of [0, 1, 2] satisfies Dim[]) {
      if (exportVisible && !shownMA[ma]) continue;
      obj += `o MA-${ma}\n`;
      for (const swap of swaps[ma]) {
        const hasAnySwaps = swap[2].v.find((s) => s.dim === ma);
        if (!hasAnySwaps) continue;
        const [p, q] = swap;
        const [a, b, c, d] = dualFaceQuad(grid, p, q);
        obj += `\
v ${a[0]} ${a[1]} ${a[2]}
v ${b[0]} ${b[1]} ${b[2]}
v ${c[0]} ${c[1]} ${c[2]}
v ${d[0]} ${d[1]} ${d[2]}
f ${v + 0} ${v + 1} ${v + 2} ${v + 3}
`;
        v += 4;
      }
    }

    const filename = cplx?.filename ?? "complex";
    downloadText(obj, `export-${filename}`);
  }, [cplx?.filename, exportVisible, grid, shownMA, swaps]);

  return (
    <div id="controls">
      <button
        id="open-menu-button"
        aria-hidden={!!open}
        onClick={() => {
          setOpen(true);
        }}
      >
        Open menu
      </button>
      <div
        id="menu-container"
        style={{
          transform: open
            ? "translateX(0)"
            : "translateX(calc(-100% - 1.2rem))",
        }}
      >
        <div>
          <h2>Controls</h2>
          <button
            onClick={() => {
              setOpen(false);
            }}
          >
            Close
          </button>
        </div>

        <h3>Import / Export</h3>

        <h4>Import</h4>
        <UploadObjFilePicker />
        <UploadMeshGridFilePicker />
        <UploadStateFilePicker />

        <BuiltinMeshes />
        <label className="file">
          <p>Import settings</p>
          <input
            type="file"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              f.text().then((text) => {
                const j = JSON.parse(text);
                setAllSettings(j);
              });
            }}
          />
        </label>

        <h4>Export</h4>
        <label>
          <input
            type="checkbox"
            checked={exportVisible}
            onChange={(e) => setExportVisible(e.target.checked)}
          />
          <p>Only export visible medial axes</p>
        </label>

        <button
          style={{ alignSelf: "start" }}
          disabled={
            swaps[0].length === 0 &&
            swaps[1].length === 0 &&
            swaps[2].length === 0
          }
          onClick={() => {
            exportMAtoObj();
          }}
        >
          Export <code>.obj</code>
        </button>

        <div className="row">
          <button
            onClick={() => {
              downloadText(JSON.stringify(allSettings), "settings.json");
            }}
          >
            Export settings
          </button>
          <HoverTooltip right>
            Export the selected visualization, grid, and pruning settings to a{" "}
            <code>.json</code> file.
          </HoverTooltip>
        </div>

        <GridControls />

        <MedialAxes />

        <RenderOptions />
      </div>
    </div>
  );
};
