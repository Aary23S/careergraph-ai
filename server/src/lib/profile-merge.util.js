export function mergeStringListCaseInsensitive(existing = [], incoming = []) {
  const seen = new Set((existing || []).map((s) => String(s).toLowerCase()));
  const merged = [...(existing || [])];
  (incoming || []).forEach((item) => {
    const key = String(item).toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(item);
    }
  });
  return merged;
}

export function educationSignature(entry) {
  if (typeof entry === 'string') return entry.toLowerCase();
  return [entry?.institution, entry?.degree, entry?.field]
    .map((v) => String(v || '').toLowerCase().trim())
    .join('|');
}

export function certificationSignature(entry) {
  if (typeof entry === 'string') return entry.toLowerCase();
  return String(entry?.name || '').toLowerCase().trim();
}

export function mergeStructuredListByKey(existing = [], incoming = [], keyFn) {
  const seen = new Set((existing || []).map(keyFn));
  const merged = [...(existing || [])];
  (incoming || []).forEach((item) => {
    const key = keyFn(item);
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(item);
    }
  });
  return merged;
}
