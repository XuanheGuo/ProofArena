import { AbsoluteFill, Sequence } from "remotion";
import { SceneBookOpening } from "../scenes/SceneBookOpening";
import { SceneProofUnfolds } from "../scenes/SceneProofUnfolds";
import { SceneChaosToArena } from "../scenes/SceneChaosToArena";
import { SceneScoreMatrix } from "../scenes/SceneScoreMatrix";
import { SceneProofGraph } from "../scenes/SceneProofGraph";
import { SceneProductDemo } from "../scenes/SceneProductDemo";
import { SceneBrandEnding } from "../scenes/SceneBrandEnding";
import { TransitionVeil } from "../components/TransitionVeil";
import { scenes } from "../styles/theme";

export function ProofArenaPromo() {
  return (
    <AbsoluteFill className="promo-root">
      <Sequence
        from={scenes.book.start}
        durationInFrames={scenes.book.duration}
      >
        <SceneBookOpening />
      </Sequence>
      <Sequence
        from={scenes.unfold.start}
        durationInFrames={scenes.unfold.duration}
      >
        <SceneProofUnfolds />
      </Sequence>
      <Sequence
        from={scenes.arena.start}
        durationInFrames={scenes.arena.duration}
      >
        <SceneChaosToArena />
      </Sequence>
      <Sequence
        from={scenes.matrix.start}
        durationInFrames={scenes.matrix.duration}
      >
        <SceneScoreMatrix />
      </Sequence>
      <Sequence
        from={scenes.graph.start}
        durationInFrames={scenes.graph.duration}
      >
        <SceneProofGraph />
      </Sequence>
      <Sequence
        from={scenes.product.start}
        durationInFrames={scenes.product.duration}
      >
        <SceneProductDemo />
      </Sequence>
      <Sequence
        from={scenes.ending.start}
        durationInFrames={scenes.ending.duration}
      >
        <SceneBrandEnding />
      </Sequence>
      <TransitionVeil />
    </AbsoluteFill>
  );
}
