// Settings are named LASTLY_*. The old HEIRLOOM_* names are still read so a host that has not been
// updated keeps working.
export const setting = (name: string): string | undefined =>
  process.env[`LASTLY_${name}`] ?? process.env[`HEIRLOOM_${name}`];
