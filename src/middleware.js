import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import chokidar from "chokidar";
import { getLayoutChain, scanRoutes } from "./routes.js";

/**
 * Check whether a URL path matches a route pattern.
 * @param {string} pattern - Route pattern (e.g. /blog/:slug)
 * @param {string} url - Actual URL path (e.g. /blog/hello)
 * @returns {object|null} Params object on match; otherwise null
 */
function matchRoute(pattern, url) {
    const patternParts = pattern.split("/").filter(Boolean);
    const urlParts = url.split("/").filter(Boolean);

    if (patternParts.length !== urlParts.length) {
        return null;
    }

    const params = {};

    for (let i = 0; i < patternParts.length; i++) {
        const patternPart = patternParts[i];
        const urlPart = urlParts[i];

        if (patternPart.startsWith(":")) {
            params[patternPart.slice(1)] = urlPart;
        } else if (patternPart !== urlPart) {
            return null;
        }
    }

    return params;
}

/**
 * Insert page content into a layout.
 * @param {string} layout - Layout HTML
 * @param {string} content - Page content to insert
 * @returns {string} Combined HTML
 */
function insertContent(layout, content) {
    const slot = "<!--slot-->";
    if (layout.includes(slot)) {
        return layout.replace(slot, content);
    }
    if (layout.includes("</body>")) {
        return layout.replace("</body>", `${content}\n</body>`);
    }
    return layout + "\n" + content;
}

function injectBeforeBodyEnd(html, snippet) {
    if (html.includes("</body>")) {
        return html.replace("</body>", `${snippet}\n</body>`);
    }
    return html + "\n" + snippet;
}

function routeSpecificity(pattern) {
    const parts = pattern.split("/").filter(Boolean);
    const dynamicCount = parts.filter((p) => p.startsWith(":")).length;
    const staticCount = parts.length - dynamicCount;
    return { dynamicCount, staticCount, length: parts.length };
}

function sortDynamicPatterns(patterns) {
    return patterns.slice().sort((a, b) => {
        const sa = routeSpecificity(a);
        const sb = routeSpecificity(b);

        if (sa.dynamicCount !== sb.dynamicCount) return sa.dynamicCount - sb.dynamicCount;
        if (sa.staticCount !== sb.staticCount) return sb.staticCount - sa.staticCount;
        if (sa.length !== sb.length) return sb.length - sa.length;
        return a.localeCompare(b);
    });
}

function resolveRouteFilePath(entryPath, routesRootAbs) {
    if (!entryPath) return null;
    if (path.isAbsolute(entryPath)) return entryPath;
    return path.resolve(routesRootAbs, entryPath);
}

/**
 * Render final HTML by applying a layout chain to a page.
 * @param {string[]} layoutChain - Layout file paths
 * @param {string} pagePath - Page file path
 * @returns {string} Final HTML
 */
function renderPage(layoutChain, pagePath, routesRootAbs) {
    const resolvedPagePath = resolveRouteFilePath(pagePath, routesRootAbs);
    if (!resolvedPagePath) {
        throw new Error("Missing page path");
    }

    let content = fs.readFileSync(resolvedPagePath, "utf-8");

    // Apply layouts in reverse order (innermost first)
    for (let i = layoutChain.length - 1; i >= 0; i--) {
        const layoutPath = resolveRouteFilePath(layoutChain[i], routesRootAbs);
        if (!layoutPath) continue;
        const layoutHtml = fs.readFileSync(layoutPath, "utf-8");
        content = insertContent(layoutHtml, content);
    }

    return content;
}

/**
 * ArmorPage Express middleware.
 * @param {object} options
 * @param {string} options.routesDir - Path to the routes folder
 * @param {boolean} options.watch - Watch routes dir and rescan on change
 * @param {boolean} options.rescanOnRequest - Rescan routes on every request
 * @param {boolean} options.log - Enable logs (default: true)
 * @returns {function} Express middleware
 */
export function armorpage(options = {}) {
    const routesDir = options.routesDir || "./routes";
    const routesDirAbs = path.resolve(routesDir);
    const rescanOnRequest = Boolean(options.rescanOnRequest);
    const watch = Boolean(options.watch);
    const log = options.log !== false;

    let cached = null;
    let watcher = null;
    let rescanTimer = null;

    function rescanRouteMapFromDisk() {
        if (!fs.existsSync(routesDirAbs)) {
            return null;
        }

        const scanned = scanRoutes(routesDirAbs);
        const routes = scanned.routes || {};
        const layouts = scanned.layouts || {};
        const dynamicPatterns = sortDynamicPatterns(Object.keys(routes).filter((p) => p.includes("/:") || p.includes(":")));

        cached = {
            source: "scan",
            routesRootAbs: routesDirAbs,
            routes,
            layouts,
            dynamicPatterns,
        };

        return cached;
    }

    function loadRouteMapFromScan() {
        if (cached && cached.source === "scan" && !rescanOnRequest) {
            return cached;
        }
        return rescanRouteMapFromDisk();
    }

    function ensureWatcher() {
        if (!watch) return;
        if (watcher) return;
        if (!fs.existsSync(routesDirAbs)) return;

        watcher = chokidar.watch(routesDirAbs, {
            ignored: /node_modules/,
            persistent: true,
        });

        const scheduleRescan = (changedPath) => {
            if (
                typeof changedPath === "string" &&
                !changedPath.endsWith("=page.html") &&
                !changedPath.endsWith("=layout.html")
            ) {
                return;
            }

            if (rescanTimer) clearTimeout(rescanTimer);
            rescanTimer = setTimeout(() => {
                try {
                    rescanRouteMapFromDisk();
                } catch (e) {
                    if (log) console.error("[armorpage] Failed to rescan routes:", e);
                }
            }, 50);
        };

        watcher.on("add", scheduleRescan);
        watcher.on("unlink", scheduleRescan);
        watcher.on("change", scheduleRescan);
        watcher.on("error", (e) => {
            if (log) console.error("[armorpage] routes watcher error:", e);
        });
    }

    function loadRouteMap() {
        return loadRouteMapFromScan();
    }

    const middleware = (req, res, next) => {
        // Only handle GET requests
        if (req.method !== "GET") {
            return next();
        }

        ensureWatcher();

        // Load route map
        const loaded = loadRouteMap();
        if (!loaded) {
            if (log) {
                console.error(
                    [
                        "[armorpage] Routes directory not found.",
                        `- routesDir: ${routesDirAbs}`,
                        "Provide a valid `routesDir`.",
                    ]
                        .filter(Boolean)
                        .join("\n")
                );
            }
            return next();
        }

        const { routes, layouts, dynamicPatterns, routesRootAbs } = loaded;
        const urlPath = req.path === "/" ? "/" : req.path.replace(/\/$/, "");

        // Route matching
        let matchedRoute = null;
        let params = {};

        // Exact match first
        if (routes[urlPath]) {
            matchedRoute = urlPath;
            params = {};
        } else {
            // Dynamic route match
            for (const pattern of dynamicPatterns) {
                const match = matchRoute(pattern, urlPath);
                if (match) {
                    matchedRoute = pattern;
                    params = match;
                    break;
                }
            }
        }

        if (!matchedRoute) {
            return next();
        }

        // Merge params into req.params
        req.params = { ...(req.params || {}), ...params };

        // Determine layout chain
        const layoutChain = getLayoutChain(matchedRoute, layouts);
        const pagePath = routes[matchedRoute];

        try {
            const html = renderPage(layoutChain, pagePath, routesRootAbs);

            // Inject SPA router script.
            // (Even if body scripts are re-run during SPA transitions, add a marker so router.js doesn't execute twice.)
            const routerScript = `<script src="/_armorpage/router.js" data-armorpage-router></script>`;
            const finalHtml = injectBeforeBodyEnd(html, routerScript);

            res.type("html").send(finalHtml);
        } catch (e) {
            console.error("Page render error:", e);
            next(e);
        }
    };

    middleware.close = async () => {
        if (!watcher) return;
        const w = watcher;
        watcher = null;
        try {
            const result = w.close();
            if (result && typeof result.then === "function") {
                await result;
            }
        } catch {}
    };

    return middleware;
}

/**
 * Middleware that serves the client router script.
 */
export function serveRouter() {
    const routerPath = fileURLToPath(new URL("./router.js", import.meta.url));

    return (req, res, next) => {
        if (req.path === "/_armorpage/router.js") {
            res.type("js").sendFile(routerPath);
        } else {
            next();
        }
    };
}
