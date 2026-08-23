# UniLogs — Backend

Express and TypeScript. Serves the API the frontend consumes.

## Getting started

```bash
npm install
cp .env.example .env
npm run dev
```

Runs on `http://localhost:3000`. Check it is alive:

```bash
curl http://localhost:3000/api/health
```

## Scripts

| Command             | Does                                   |
| ------------------- | -------------------------------------- |
| `npm run dev`       | Development server, restarts on change |
| `npm run build`     | Compile TypeScript into `dist/`        |
| `npm start`         | Run the compiled build                 |
| `npm run lint`      | ESLint                                 |
| `npm run typecheck` | Type check without emitting            |

Run all of `typecheck`, `lint` and `build` before opening a pull request.

## Environment

| Variable       | Purpose                                 |
| -------------- | --------------------------------------- |
| `PORT`         | Port to listen on, defaults to 3000     |
| `CORS_ORIGIN`  | Frontend origin allowed to call the API |
| `DATABASE_URL` | PostgreSQL connection string from Neon  |

Never commit `.env`. Add new variables to `.env.example` with the value blank so
the rest of the team knows they exist.

## ESM imports — read this first

This package uses ESM (`"type": "module"`). Relative imports must carry a `.js`
extension even though the file on disk is `.ts`:

```ts
import { createApp } from './app.js'; // correct
import { createApp } from './app'; // fails at runtime
```

Package imports such as `express` do not need it. This looks wrong and catches
everybody once.

## Structure

```
src/
  index.ts        Server entry point, reads env and binds the port
  app.ts          Builds the Express app, mounts middleware and routes
  routes/         One file per resource
```

`createApp()` is deliberately separate from the server start. Tests can import the
app and make requests against it without binding a port.

## Endpoints

| Method | Path          | Purpose              |
| ------ | ------------- | -------------------- |
| `GET`  | `/`           | API name and version |
| `GET`  | `/api/health` | Liveness check       |

`/api/health` is not filler. Render uses it to decide whether the service is
healthy, and UptimeRobot pings it to stop the free tier spinning down.
