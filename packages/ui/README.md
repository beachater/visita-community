# @visita/ui

The Visita UI kit, shared by the consumer app and the owner/admin app.

- `@visita/ui/tokens.css`: every colour, font and radius, as CSS variables and a
  Tailwind `@theme`. **Provisional** until the final branding arrives; the
  rebrand happens here.
- `@visita/ui/<component>`: the shadcn/ui primitives (`button`, `sheet`,
  `dialog`, and so on), owned by us, plus `bottom-sheet`.
- `@visita/ui/utils`: `cn()`.

Apps import the tokens after Tailwind and add `@source` pointing at this
package so Tailwind generates the classes it uses. Add shadcn components here
with `npx shadcn@latest add <name>` from this directory.
