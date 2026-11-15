/** Tunable numbers in one place. Distances in metres, times in seconds, stamina in points (100 = a full bar). */
export const B = {
  eye: 1.62, chest: 1.28, handRest: 0.5, gravity: 9.81,
  walkSpeed: 2.6, reach: 1.15,
  // stamina per second
  drain: 1.5, oneHandMul: 2.2, hangMul: 0.6, wetMul: 1.4, gustMul: 1.1, iceMul: 1.6, iceGloveMul: 1.15,
  regenPlatform: 12, regenGround: 25,
  // falls
  stumbleVel: 8, catchCost: 22, arresterDrop: 0.6, arresterCost: 12, regrabVel: 4.5,
  // lanyard
  leash: 3.4, clipReach: 1.35,
  // career
  rankXp: [0, 250, 700, 1500, 3000],
  xp: { metre: 1, restore: 150, clean: 50, par: 50, medal: 40, page: 25, fragment: 40, photo: 40 },
  photoReward: 60, maxPhotos: 16,
} as const;
