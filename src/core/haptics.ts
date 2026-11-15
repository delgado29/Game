/** Vibration feedback where the platform supports it (Android, some browsers). iOS Safari has no API; this is a no-op there. */
export const haptic = (pattern: number | number[]) => { try { navigator.vibrate?.(pattern); } catch { /* unsupported */ } };
