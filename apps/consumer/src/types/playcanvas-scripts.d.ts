// The engine ships its ESM scripts without type declarations.
declare module "playcanvas/scripts/esm/camera-controls.mjs" {
  import type { Script } from "playcanvas";
  export class CameraControls extends Script {
    enableFly: boolean;
    enableOrbit: boolean;
    enablePan: boolean;
    moveSpeed: number;
    moveFastSpeed: number;
    moveSlowSpeed: number;
    rotateSpeed: number;
    zoomRange: import("playcanvas").Vec2;
    pitchRange: import("playcanvas").Vec2;
    mobileInputLayout: "joystick-joystick" | "joystick-touch" | "touch-joystick" | "touch-touch";
    joystickEventName: string;
  }
}
