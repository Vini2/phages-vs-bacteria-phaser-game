export function bacteriaDrift(scene, b, dt) {
  const infected = b.getData("infected") === true;
  const max = infected ? 45 : 85;

  const v = b.body.velocity;
  const jitter = infected ? 10 : 18;

  b.body.setVelocity(
    Phaser.Math.Clamp(v.x + Phaser.Math.FloatBetween(-jitter, jitter) * dt, -max, max),
    Phaser.Math.Clamp(v.y + Phaser.Math.FloatBetween(-jitter, jitter) * dt, -max, max)
  );

  b.rotation += (infected ? 0.5 : 0.2) * dt;
}

export function helperBrain(scene, h, dt) {
  let target = null;
  let bestD2 = 999999;

  const hx = h.x, hy = h.y;

  scene.bacteria.children.iterate((b) => {
    if (!b || !b.active) return;
    if (b.getData("infected")) return;

    const d2 = Phaser.Math.Distance.Squared(hx, hy, b.x, b.y);
    if (d2 < bestD2) { bestD2 = d2; target = b; }
  });

  const isKiller = h.getData("killer") === true;
  let cooldown = h.getData("cooldown") || 0;
  cooldown = Math.max(0, cooldown - dt);
  h.setData("cooldown", cooldown);

  if (target && bestD2 < 320 * 320) {
    const to = new Phaser.Math.Vector2(target.x - hx, target.y - hy).normalize().scale(260);
    h.body.setAcceleration(to.x, to.y);

    if (bestD2 < 70 * 70) {
      const tangent = new Phaser.Math.Vector2(-(target.y - hy), target.x - hx).normalize().scale(160);
      h.body.setAcceleration(tangent.x, tangent.y);
    }

    h.rotation = Phaser.Math.Angle.RotateTo(
      h.rotation,
      Phaser.Math.Angle.Between(hx, hy, target.x, target.y),
      6 * dt
    );
  } else {
    let a = h.getData("wanderAngle") || 0;
    a += Phaser.Math.FloatBetween(-0.9, 0.9) * dt;
    h.setData("wanderAngle", a);

    const force = new Phaser.Math.Vector2(Math.cos(a), Math.sin(a)).scale(160);
    h.body.setAcceleration(force.x, force.y);
    h.rotation = Phaser.Math.Angle.RotateTo(h.rotation, a, 3.5 * dt);
  }

  if (isKiller && target && cooldown <= 0 && bestD2 < 34 * 34) {
    const p = Phaser.Math.Clamp(scene.killerLysisChancePerSec * dt, 0, 1);
    if (Math.random() < p) {
      scene.lysis(target);
      h.setData("cooldown", 1.5);

      const away = new Phaser.Math.Vector2(hx - target.x, hy - target.y).normalize().scale(220);
      h.body.setVelocity(away.x, away.y);
    }
  }
}
