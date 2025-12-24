# ArmorPage

A minimal file-based routing SPA library for Express.

## Installation

```bash
npm install armorpage
```

## Folder Structure

```
your-project/
  routes/
    =layout.html        ← Common layout
    =page.html          ← /
    about/
      =page.html        ← /about
    blog/
      =layout.html      ← Blog section layout
      =page.html        ← /blog
      [slug]/
        =page.html      ← /blog/:slug (dynamic routing)
  server.js
```

## Usage

### 1. Server Setup

```javascript
import express from "express";
import { armorpage, serveRouter } from "armorpage";

const app = express();

app.use(serveRouter());
app.use(
    armorpage({
        // default: "./routes"
        routesDir: "./routes",

        // dev: watch and hot-rescan on changes
        watch: true,
    })
);

app.listen(3000);
```

### 2. Development Mode (CLI)

```bash
npx armorpage dev
```

By default, `dev` also starts a simple Express dev server at `http://localhost:3000`.

```bash
# Change host/port
npx armorpage dev --host 0.0.0.0 --port 3001
```

## Layout

In `=layout.html`, page content is inserted at the `<!--slot-->` position.

```html
<!DOCTYPE html>
<html>
    <head>
        <title>My Site</title>
    </head>
    <body>
        <nav>...</nav>
        <!--slot-->
        <footer>...</footer>
    </body>
</html>
```

## Dynamic Routing

Folders named in the `[param]` format are used as dynamic parameters.

-   `routes/blog/[slug]/=page.html` → `/blog/:slug`
-   `routes/user/[id]/post/[postId]/=page.html` → `/user/:id/post/:postId`

## Client Router

Navigating between pages automatically works in SPA mode.

### Rapid Consecutive Navigation/Duplicate Navigation

To handle rapid multiple navigations or navigating to the same URL, previous requests are internally aborted, and only the last navigation is reflected.

### Disabling SPA

To disable SPA for specific links:

```html
<a href="/external" data-no-spa>Traditional Navigation</a>
```

### JavaScript API

```javascript
// Programmatic navigation
ArmorPage.navigate("/about");

// Refresh current page
ArmorPage.reload();
```

### Events

```javascript
window.addEventListener("armorpage:navigate", (e) => {
    console.log("Navigation:", e.detail.url);
});
```

## Options

### CLI

```bash
armorpage dev --routes ./routes --host 0.0.0.0 --port 3001
```

### Middleware

```javascript
app.use(
    armorpage({
        // default: "./routes"
        routesDir: "./routes",

        // Watch ./routes and hot-rescan on changes (default: false)
        watch: true,

        // Rescan routes on every request (default: false)
        rescanOnRequest: false,
    })
);
```

## License

MIT
