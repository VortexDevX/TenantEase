/**
 * Format paisa (integer) to Indian Rupee display string.
 * e.g. 850000 → "₹8,500"
 */
export function formatPaisa(paisa: number): string {
  const rupees = paisa / 100;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(rupees);
}

/**
 * Format an ISO date string to a readable date.
 * e.g. "2023-10-12T..." → "12 Oct 2023"
 */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Returns a relative time string.
 * e.g. "2 hours ago", "Yesterday", "3 days ago"
 */
export function timeAgo(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin} min ago`;
  if (diffHr < 24) return `${diffHr} hour${diffHr > 1 ? "s" : ""} ago`;
  if (diffDay === 1) return "Yesterday";
  if (diffDay < 30) return `${diffDay} days ago`;
  return formatDate(iso);
}

/**
 * Format paisa to a short display like "3.4L" or "85K"
 */
export function formatPaisaShort(paisa: number): string {
  const rupees = paisa / 100;
  if (rupees >= 100000) {
    return `₹${(rupees / 100000).toFixed(1)}L`;
  }
  if (rupees >= 1000) {
    return `₹${(rupees / 1000).toFixed(rupees >= 10000 ? 0 : 1)}K`;
  }
  return formatPaisa(paisa);
}
