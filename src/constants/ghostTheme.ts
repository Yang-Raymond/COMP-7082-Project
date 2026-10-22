// Central colour palette and shadow style for GhostRacer.
// Palette: https://coolors.co/d4dcff-7d83ff-007fff-1affd5-590925
// All screens/components must read colours from here instead of hardcoding hex values.

export const colors = {
  primary: '#590925',
  primaryDark: '#3d0619',
  onPrimary: '#fbfbfb',
  mint: '#1AFFD5',
  lavender: '#D4DCFF',
  accent: '#7D83FF',
  bg: '#fbfbfb',
  text: '#2a0412',
  muted: '#6b6370',
  border: '#e3e7ff',
  chipActive: '#D4DCFF',
  blue: '#007FFF',
  ahead: '#0f9d75',
  behind: '#c62828',
};

export const shadow = {
  shadowColor: '#000',
  shadowOpacity: 0.15,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 2 },
  elevation: 4,
};
