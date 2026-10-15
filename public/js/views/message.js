import { h } from "../dom.js";

// "Not found" and "something went wrong" pages. They always say what to do next.
export async function messageView({ kind, detail = "" }) {
  const notFound = kind === "notfound";
  const title = notFound ? "We cannot find that page" : "Something went wrong";
  const text = notFound
    ? "The event or booking you asked for does not exist, or the link is wrong."
    : `${detail || "The page could not load."} Try again in a moment.`;
  return {
    title,
    element: h("section", { class: "page narrow" },
      h("h1", { text: title }),
      h("p", { text }),
      h("p", {}, h("a", { class: "button", href: "#/" }, "See all events"))),
  };
}
