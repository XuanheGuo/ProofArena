import { AbsoluteFill } from "remotion";
import { AnimatedConnector } from "../components/AnimatedConnector";
import { ArenaRings } from "../components/ArenaRings";
import { Caption } from "../components/Caption";
import { CommentBubble } from "../components/CommentBubble";
import { FormulaParticleField } from "../components/FormulaParticleField";
import { ProblemNode } from "../components/ProblemNode";
import { SolutionRouteCard } from "../components/SolutionRouteCard";
import { SubtleGrid } from "../components/SubtleGrid";
import { captions } from "../data/promoCopy";

export function SceneChaosToArena() {
  return (
    <AbsoluteFill className="scene">
      <SubtleGrid />
      <FormulaParticleField mode="gather" />
      <ArenaRings />
      <ProblemNode />
      <AnimatedConnector top={434} rotate={-12} />
      <AnimatedConnector top={520} />
      <AnimatedConnector top={606} rotate={12} />
      <SolutionRouteCard index={0} x={1130} y={315} />
      <SolutionRouteCard index={1} x={1190} y={485} />
      <SolutionRouteCard index={2} x={1130} y={655} />
      <CommentBubble index={0} left={290} top={260} />
      <CommentBubble index={1} left={1440} top={230} />
      <CommentBubble index={2} left={310} top={750} />
      <CommentBubble index={3} left={1390} top={790} />
      <Caption delay={145}>{captions.arena}</Caption>
    </AbsoluteFill>
  );
}
