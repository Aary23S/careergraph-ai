export function parseYearMonth(value) {
  if (!value) return null;
  const match = String(value).trim().match(/^(\d{4})(?:-(\d{1,2}))?/);
  if (!match) return null;
  const year = parseInt(match[1], 10);
  const month = match[2] ? parseInt(match[2], 10) : 1;
  if (Number.isNaN(year)) return null;
  return year * 12 + (month - 1);
}

export function estimateYearsOfExperience(experienceEntries) {
  if (!Array.isArray(experienceEntries) || experienceEntries.length === 0) return null;
  const now = new Date();
  const nowIndex = now.getFullYear() * 12 + now.getMonth();
  let totalMonths = 0;
  let counted = 0;

  experienceEntries.forEach((entry) => {
    const startIdx = parseYearMonth(entry.startDate);
    if (startIdx === null) return;
    const endIdx = entry.isCurrent ? nowIndex : (parseYearMonth(entry.endDate) ?? nowIndex);
    const months = endIdx - startIdx;
    if (months > 0) {
      totalMonths += months;
      counted += 1;
    }
  });

  if (counted === 0) return null;
  return Math.max(0, Math.round(totalMonths / 12));
}
