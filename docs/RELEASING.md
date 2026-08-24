# E package release handoff

The first publishable package release is `0.1.1`. Version `0.1.0` was
unpublished and is reserved by npm, so it cannot be reused.

Publish from the repository root in dependency order:

```bash
cd packages/protocol
npm publish --access public
```

```bash
cd ../registry
npm publish --access public
```

```bash
cd ../knowledge
npm publish --access public
```

The packages are:

- `@vxnus/e@0.1.1`
- `@vxnus/e-registry@0.1.1`
- `@vxnus/e-knowledge@0.1.1`

After the packages are live, refresh the Hub lockfile so fresh Vercel clones
resolve the registry package from npm rather than the local monorepo path:

```bash
cd ../../apps/web
npm install @vxnus/e-registry@0.1.1 --save-exact
npm run lint
npm run build
```

Then commit `apps/web/package.json` and `apps/web/package-lock.json` and push.
Do not republish an existing version or use `--force`; npm package versions are
immutable.
