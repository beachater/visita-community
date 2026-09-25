import type * as PC from "playcanvas";

// Walking, not flying: look anywhere, but movement stays on the level plane,
// so eye height never drifts toward the floor or ceiling. Identical to the
// engine's FlyController except that forward/right use yaw only and the
// vertical move axis (Q/E) is ignored.

type FlyUpdate = PC.FlyController["update"];
interface PoseInternals {
  _pose: PC.Pose;
  _targetPose: PC.Pose;
}

const damp = (damping: number, dt: number) => 1 - Math.pow(damping, dt * 1000);

export function createWalkController(pc: typeof PC): PC.FlyController {
  const offset = new pc.Vec3();
  const angles = new pc.Vec3();
  const forward = new pc.Vec3();
  const right = new pc.Vec3();
  const rotation = new pc.Quat();

  class WalkController extends pc.FlyController {
    override update(frame: Parameters<FlyUpdate>[0], dt: number): ReturnType<FlyUpdate> {
      const self = this as unknown as PoseInternals;
      const { move, rotate } = frame.read();
      self._targetPose.rotate(angles.set(-rotate[1], -rotate[0], 0));

      rotation.setFromEulerAngles(0, self._pose.angles.y, 0);
      rotation.transformVector(pc.Vec3.FORWARD, forward);
      rotation.transformVector(pc.Vec3.RIGHT, right);
      offset.set(0, 0, 0);
      offset.add(forward.mulScalar(move[2]));
      offset.add(right.mulScalar(move[0]));
      self._targetPose.move(offset);

      return self._pose.lerp(self._pose, self._targetPose, damp(this.moveDamping, dt), damp(this.rotateDamping, dt));
    }
  }

  return new WalkController();
}
