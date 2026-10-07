# ZombieOS Store

This is the official ZombieOS Store where you can download apps, games, and Z# dependency packages.

Publish a readable, unbytecoded `.zpackage` ZIP through the same source review flow as `.zapp` and `.zgame`. A source package needs `project.zsettings` and readable source files.

For a published package with project ID `discordz`, the latest download URL is:

```text
https://zos-store-api.zos-store-api.workers.dev/?action=download&project=discordz&release=latest
```

Dependency builds should pin a version instead:

```text
https://zos-store-api.zos-store-api.workers.dev/?action=download&project=discordz&release=1.0.0
```

`release=` accepts `latest`, a published version number, or a release ID. The older `version=` form also remains supported. `?action=public-project&id=discordz` returns the current release's URL, SHA-256, and file size. Replace `discordz` and `1.0.0` with the published project's ID and version.
