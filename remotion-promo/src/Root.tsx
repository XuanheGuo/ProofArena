import { Composition } from "remotion";
import { ProofArenaPromo } from "./compositions/ProofArenaPromo";
import { DURATION_FRAMES, FPS, HEIGHT, WIDTH } from "./styles/theme";

export function Root() {
  return (
    <Composition
      id="ProofArenaPromo60"
      component={ProofArenaPromo}
      durationInFrames={DURATION_FRAMES}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
      defaultProps={{}}
    />
  );
}
