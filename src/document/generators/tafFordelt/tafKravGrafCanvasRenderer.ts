// Canvas-oversætteren for TAF-kravgrafens scene-model.
//
// Modulet indeholder BEVIDST ingen beslutninger: hvert scene-primitiv oversættes 1:1 til
// canvas-kald. Alt hvad der bestemmer grafens udseende – koordinater, farver, skrifter,
// rækkefølge – er afgjort i `tafKravGrafScene.ts` og dækket af test dér. Det er grunden
// til, at dette lag kan være utestet: det kan ikke træffe et forkert valg, kun oversætte
// et allerede truffet.
//
// Enhver ny visuel egenskab hører derfor i scene-modellen (som et nyt primitiv), ikke
// som en `if` her.

import type { SceneCommand, ScenePoint, SceneStroke, TafKravGrafScene } from './tafKravGrafScene';

const applyStroke = (ctx: CanvasRenderingContext2D, stroke: SceneStroke): void => {
  ctx.strokeStyle = stroke.color;
  ctx.lineWidth = stroke.width;
  ctx.setLineDash(stroke.dash ? [...stroke.dash] : []);
};

const roundRectPath = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void => {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
};

const tracePolygon = (ctx: CanvasRenderingContext2D, points: readonly ScenePoint[]): void => {
  ctx.beginPath();
  points.forEach((point, index) => {
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.closePath();
};

const drawCommand = (ctx: CanvasRenderingContext2D, command: SceneCommand): void => {
  switch (command.kind) {
    case 'fillRect':
      ctx.fillStyle = command.color;
      ctx.fillRect(command.x, command.y, command.width, command.height);
      return;
    case 'fillRoundRect':
      roundRectPath(ctx, command.x, command.y, command.width, command.height, command.radius);
      ctx.fillStyle = command.color;
      ctx.fill();
      return;
    case 'strokeRect':
      applyStroke(ctx, command.stroke);
      ctx.strokeRect(command.x, command.y, command.width, command.height);
      ctx.setLineDash([]);
      return;
    case 'strokeLines': {
      applyStroke(ctx, command.stroke);
      // Hvert linjestykke får sin egen sti. Det er ikke kosmetik: en stiplet streg
      // fortsætter sit dash-mønster hen over delstier i samme sti, så en samlet sti
      // ville forskyde stiplingen på alle linjer efter den første.
      for (const [from, to] of command.lines) {
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      return;
    }
    case 'strokeSubpaths': {
      applyStroke(ctx, command.stroke);
      ctx.beginPath();
      for (const subpath of command.subpaths) {
        subpath.forEach((point, index) => {
          if (index === 0) ctx.moveTo(point.x, point.y);
          else ctx.lineTo(point.x, point.y);
        });
      }
      ctx.stroke();
      ctx.setLineDash([]);
      return;
    }
    case 'fillPolygon':
      tracePolygon(ctx, command.points);
      ctx.fillStyle = command.color;
      ctx.fill();
      return;
    case 'fillPath': {
      ctx.beginPath();
      ctx.moveTo(command.start.x, command.start.y);
      for (const segment of command.segments) {
        if (segment.kind === 'lineTo') ctx.lineTo(segment.x, segment.y);
        else ctx.bezierCurveTo(segment.c1x, segment.c1y, segment.c2x, segment.c2y, segment.x, segment.y);
      }
      ctx.closePath();
      ctx.fillStyle = command.color;
      ctx.fill();
      return;
    }
    case 'text':
      ctx.font = command.font;
      ctx.fillStyle = command.color;
      ctx.textAlign = command.align;
      ctx.textBaseline = command.baseline;
      ctx.fillText(command.text, command.x, command.y);
      return;
    case 'clipRoundRect':
      ctx.save();
      roundRectPath(ctx, command.x, command.y, command.width, command.height, command.radius);
      ctx.clip();
      return;
    case 'restore':
      ctx.restore();
      return;
  }
};

/** Tegner hele scenen på det givne 2D-context. */
export const renderSceneToCanvas = (ctx: CanvasRenderingContext2D, scene: TafKravGrafScene): void => {
  ctx.fillStyle = scene.background;
  ctx.fillRect(0, 0, scene.width, scene.height);
  for (const command of scene.commands) drawCommand(ctx, command);
};
