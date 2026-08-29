/* A counter for gradient ids.

   The same icon is drawn in several places on one page (the dock, the phone's
   home screen, a desktop item, an About panel), and a duplicate id inside an
   SVG is not a cosmetic problem: a reference resolves to the first match in
   the document, and if that first match happens to sit inside a subtree the
   browser is not rendering, the fill silently comes out empty. Every instance
   gets its own number. */
let n = 0;
export const uid = () => `i${(n++).toString(36)}`;
