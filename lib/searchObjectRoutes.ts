import type { ObjectCategory, ObjectRoute } from "@/data/routes";

const haystack = (route: ObjectRoute) =>
  [
    route.title,
    route.category,
    route.aliases.join(" "),
    route.shortDescription,
    route.sourceLooksLike,
    route.buildAs,
    route.menuPath,
  ]
    .join(" ")
    .toLowerCase();

export function searchObjectRoutes(
  routes: ObjectRoute[],
  query: string,
  category: ObjectCategory | "all",
): ObjectRoute[] {
  const terms = query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);

  return routes.filter((route) => {
    const text = haystack(route);
    const matchesCategory =
      category === "all" ||
      route.category === category;
    const matchesQuery = terms.length === 0 || terms.every((term) => text.includes(term));

    return matchesCategory && matchesQuery;
  });
}
