import fs from "fs";
import path from "path";

// Scan routesDir and build URL -> file path maps.
export function scanRoutes(routesDir) {
    const routes = {};
    const layouts = {};

    function scan(dir, urlPath = "") {
        const entries = fs.readdirSync(dir, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);

            if (entry.isDirectory()) {
                // `[param]` -> `:param`
                let segment = entry.name;
                if (segment.startsWith("[") && segment.endsWith("]")) {
                    segment = ":" + segment.slice(1, -1);
                }
                const newUrlPath = urlPath + "/" + segment;
                scan(fullPath, newUrlPath);
            } else if (entry.name === "=page.html") {
                const routePath = urlPath || "/";
                routes[routePath] = fullPath;
            } else if (entry.name === "=layout.html") {
                const layoutPath = urlPath || "/";
                layouts[layoutPath] = fullPath;
            }
        }
    }

    scan(path.resolve(routesDir));

    return { routes, layouts };
}

// Compute layout chain (root -> leaf).
export function getLayoutChain(routePath, layouts) {
    const chain = [];
    const segments = routePath.split("/").filter(Boolean);

    if (layouts["/"]) {
        chain.push(layouts["/"]);
    }

    let currentPath = "";
    for (const segment of segments) {
        currentPath += "/" + segment;
        if (layouts[currentPath]) {
            chain.push(layouts[currentPath]);
        }
    }

    return chain;
}
