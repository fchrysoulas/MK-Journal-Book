/** Keep journal groups together and retain native ordering until an owner overrides it. */
export function orderedPages(rows, order) {
  if (!Array.isArray(order) || !order.length) return rows;
  const rank = new Map(order.filter(id => typeof id === "string").map((id, index) => [id, index]));
  const groups = new Map();
  for (const row of rows) {
    const key = row.journalUuid;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  const priority = row => rank.get(row.uuid) ?? Infinity;
  return [...groups.values()].sort((a, b) => Math.min(...a.map(priority)) - Math.min(...b.map(priority)))
    .flatMap(group => group.sort((a, b) => priority(a) - priority(b)));
}
export function reorderedUUIDs(rows, source, target, kind, after = false) {
  if (!["journal", "page"].includes(kind) || source === target) return rows.map(row => row.uuid);
  const key = row => kind === "journal" ? row.journalUuid : row.uuid;
  const from = rows.filter(row => key(row) === source), to = rows.filter(row => key(row) === target);
  if (!from.length || !to.length || (kind === "page" && from[0].journalUuid !== to[0].journalUuid)) throw new Error("Move pages within their journal, or move a whole journal group.");
  const rest = rows.filter(row => key(row) !== source);
  const index = after ? rest.findLastIndex(row => key(row) === target) + 1 : rest.findIndex(row => key(row) === target);
  rest.splice(index, 0, ...from);
  return rest.map(row => row.uuid);
}
/** Reordering readable entries never drops stored references to other pages. */
export function mergeVisibleOrder(existing, selected, visible) {
  const all = [...new Set([...existing, ...selected])].filter(uuid => selected.includes(uuid));
  const visibleSet = new Set(visible); let index = 0;
  return all.map(uuid => visibleSet.has(uuid) ? visible[index++] : uuid);
}
