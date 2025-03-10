import squished_cylinder from "../../inputs/squished_cylinder.obj?raw";
import extruded_ellipse from "../../inputs/extruded_ellipse.obj?raw";
import cube_subdiv_2 from "../../inputs/cube-subdiv-2.obj?raw";
import maze_2 from "../../inputs/maze_2.obj?raw";
import { mars } from "../global";

const EXAMPLE_OBJS = [
  { name: "Squished cylinder", string: squished_cylinder },
  { name: "Extruded ellipse", string: extruded_ellipse },
  { name: "Cube", string: cube_subdiv_2 },
  { name: "Maze", string: maze_2 },
];

export const BuiltinMeshes = () => {
  return (
    <ul className="predef-files-list">
      {EXAMPLE_OBJS.map((obj, i) => (
        <li
          key={i}
          onClick={() => {
            mars().load_complex(obj.string);
          }}
        >
          {obj.name}
        </li>
      ))}
    </ul>
  );
};
