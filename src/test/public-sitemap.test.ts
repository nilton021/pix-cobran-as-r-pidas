import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";
import { routeTree } from "@/routeTree.gen";
import { sitemapStaticPaths, sitemapXML } from "@/lib/sitemap";

describe("Public merchant discovery", () => {
  it("includes only the public information pages, never accounts or charges", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });
    expect(sitemapStaticPaths(router)).toEqual(["/", "/como-funciona"]);
  });
  it("keeps the merchant homepage separate from the private dashboard", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });
    expect(router.matchRoutes("/").at(-1)?.routeId).toBe("/");
    expect(router.matchRoutes("/painel").at(-1)?.routeId).toBe("/_authenticated/painel");
  });
  it("publishes the real origin without fabricated modification dates", () => {
    const xml = sitemapXML("https://pix-cobrancas-rapidas.lovable.app", [{ path: "/" }, { path: "/como-funciona" }]);
    expect(xml).toContain("<loc>https://pix-cobrancas-rapidas.lovable.app/como-funciona</loc>");
    expect(xml).not.toContain("<lastmod>");
  });
});