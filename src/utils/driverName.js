// Normalise a driver name to "Firstname SURNAME" format.
// Handles any input: "Ashley Sutton", "Ashley SUTTON", "Daryl DE LEON", etc.
export function formatDriverName(name) {
  if (!name) return '';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return name.toUpperCase();
  const first = parts[0];
  const surname = parts.slice(1).join(' ').toUpperCase();
  return `${first} ${surname}`;
}
