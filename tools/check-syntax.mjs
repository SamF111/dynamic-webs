import {
  readdirSync,
  statSync
} from "node:fs";

import {
  resolve
} from "node:path";

import {
  spawnSync
} from "node:child_process";

const ROOT_DIRECTORIES =
  Object.freeze([
    "scripts",
    "tests",
    "tools"
  ]);

const sourceFiles =
  ROOT_DIRECTORIES
    .flatMap(
      collectJavaScriptFiles
    )
    .sort();

const failures =
  [];

for (
  const sourceFile of
  sourceFiles
) {
  const result =
    spawnSync(
      process.execPath,
      [
        "--check",
        sourceFile
      ],
      {
        encoding:
          "utf8",
        windowsHide:
          true
      }
    );

  if (
    result.status !==
      0
  ) {
    failures.push({
      sourceFile,
      output:
        [
          result.stdout,
          result.stderr
        ]
          .filter(Boolean)
          .join("\n")
          .trim()
    });
  }
}

if (
  failures.length >
    0
) {
  for (
    const failure of
    failures
  ) {
    console.error(
      `\nSyntax check failed: ${failure.sourceFile}\n${failure.output}`
    );
  }

  process.exitCode =
    1;
} else {
  console.log(
    `Dynamic Webs | Syntax checks passed for ${sourceFiles.length} JavaScript files.`
  );
}

function collectJavaScriptFiles(
  rootDirectory
) {
  const absoluteRoot =
    resolve(
      rootDirectory
    );

  if (
    !existsAsDirectory(
      absoluteRoot
    )
  ) {
    return [];
  }

  const files =
    [];

  visitDirectory(
    absoluteRoot,
    files
  );

  return files;
}

function visitDirectory(
  directory,
  files
) {
  for (
    const entry of
    readdirSync(
      directory,
      {
        withFileTypes:
          true
      }
    )
  ) {
    const path =
      resolve(
        directory,
        entry.name
      );

    if (
      entry.isDirectory()
    ) {
      visitDirectory(
        path,
        files
      );

      continue;
    }

    if (
      entry.isFile() &&
      (
        path.endsWith(
          ".js"
        ) ||
        path.endsWith(
          ".mjs"
        )
      )
    ) {
      files.push(
        path
      );
    }
  }
}

function existsAsDirectory(
  path
) {
  try {
    return statSync(
      path
    ).isDirectory();
  } catch (_error) {
    return false;
  }
}
