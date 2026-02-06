import { defineEventHandler } from "h3";

export default defineEventHandler(() =>
  new Response(null, { status: 204 }),
);
