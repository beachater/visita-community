// One definition of the site's navigation, shared by the header, the mobile
// menu and the footer.

export interface NavLink {
  href: string;
  label: string;
}

/** Primary navigation, visitor-first. */
export const PRIMARY_NAV: NavLink[] = [
  { href: "/explore", label: "Explore" },
  { href: "/saved", label: "Saved" },
  { href: "/for-cafes", label: "For cafes" },
  { href: "/about", label: "About" },
];

export const FOOTER_NAV: { heading: string; links: NavLink[] }[] = [
  {
    heading: "Visita",
    links: [
      { href: "/explore", label: "Explore cafes" },
      { href: "/about", label: "About" },
      { href: "/faq", label: "FAQ" },
      { href: "/contact", label: "Contact" },
    ],
  },
  {
    heading: "For cafes",
    links: [
      { href: "/for-cafes", label: "List your cafe" },
      // The owner and admin app is a separate site (apps/admin); linked once deployed.
    ],
  },
  {
    heading: "Legal",
    links: [
      { href: "/privacy", label: "Privacy policy" },
      { href: "/terms", label: "Terms of use" },
    ],
  },
];

/** True when `href` is the current page or a section containing it. */
export function isCurrent(href: string, pathname: string): boolean {
  const path = pathname.replace(/(\/index)?\.html$/, "").replace(/\/+$/, "") || "/";
  return href === "/" ? path === "/" : path === href || path.startsWith(`${href}/`);
}
