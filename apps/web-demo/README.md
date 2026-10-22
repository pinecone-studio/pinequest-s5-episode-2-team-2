# web-demo

Web proof of concept for the initial review. It runs the same `@app/core` measurement,
frame summary and decision policy as the app, in the phone's browser: nothing is uploaded
or stored. The product itself is the iPhone app; this branch is not merged into `main`.

Thresholds marked `TODO(tune)` are demo placeholders, not validated values.

```bash
npm install
npm run dev --workspace @app/web-demo
```

The illustrations in `public/img/` are not committed; copy them in before building.
