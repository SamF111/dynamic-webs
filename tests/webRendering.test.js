import test from "node:test";
import assert from "node:assert/strict";

import {
  WebRenderService
} from "../scripts/rendering/webs/WebRenderService.js";

class MockDisplayObject {
  constructor() {
    this.parent =
      null;

    this.children =
      [];

    this.destroyed =
      false;

    this.name =
      null;

    this.label =
      null;

    this.zIndex =
      0;

    this.eventMode =
      "auto";

    this.interactive =
      true;

    this.interactiveChildren =
      true;

    this.cursor =
      "pointer";
  }

  addChild(
    child
  ) {
    child.parent =
      this;

    this.children.push(
      child
    );

    return child;
  }

  removeChild(
    child
  ) {
    const index =
      this.children.indexOf(
        child
      );

    if (
      index >=
        0
    ) {
      this.children.splice(
        index,
        1
      );

      child.parent =
        null;
    }

    return child;
  }

  sortChildren() {
    this.children.sort(
      (
        first,
        second
      ) =>
        Number(
          first.zIndex ??
          0
        ) -
        Number(
          second.zIndex ??
          0
        )
    );
  }

  destroy({
    children = false
  } = {}) {
    if (
      children
    ) {
      for (
        const child of
        [...this.children]
      ) {
        child.destroy?.({
          children:
            true
        });
      }
    }

    this.children =
      [];

    this.destroyed =
      true;
  }
}

class MockContainer extends MockDisplayObject {}

class MockGraphics extends MockDisplayObject {
  constructor() {
    super();

    this.commands =
      [];
  }

  moveTo(
    x,
    y
  ) {
    this.commands.push([
      "moveTo",
      x,
      y
    ]);
  }

  lineTo(
    x,
    y
  ) {
    this.commands.push([
      "lineTo",
      x,
      y
    ]);
  }

  stroke(
    style
  ) {
    this.commands.push([
      "stroke",
      style
    ]);
  }
}

function createWeb(
  id = "ground:scene:index-0",
  elevationBottom = 0
) {
  return Object.freeze({
    id,
    kind:
      "ground",
    elevationBand:
      Object.freeze({
        bottom:
          elevationBottom,
        top:
          elevationBottom +
          9
      }),
    strands:
      Object.freeze([
        Object.freeze({
          id:
            `${id}:structural-0`,
          points:
            Object.freeze([
              Object.freeze({
                x:
                  0,
                y:
                  0
              }),
              Object.freeze({
                x:
                  10,
                y:
                  10
              })
            ]),
          widthPx:
            1,
          alpha:
            0.8,
          colour:
            0xabcdef,
          underColour:
            0x123456
        })
      ])
  });
}

function createConfiguration(
  thicknessMultiplier = 1
) {
  return Object.freeze({
    layerMode:
      "under-tokens",
    zIndex:
      0,
    underWidthAdditionPx:
      1,
    underColour:
      0x111827,
    underAlphaMultiplier:
      0.4,
    silkColour:
      0xe8edf2,
    thicknessMultiplier
  });
}

function installPixi(
  {
    Graphics =
      MockGraphics
  } = {}
) {
  const previousPixi =
    globalThis.PIXI;

  const previousCanvas =
    globalThis.canvas;

  const primary =
    new MockContainer();

  primary.name =
    "PrimaryCanvasGroup";

  primary.sortableChildren =
    false;

  primary.sortDirty =
    false;

  primary.renderDirty =
    false;

  globalThis.PIXI = {
    Container:
      MockContainer,
    Graphics
  };

  globalThis.canvas = {
    primary
  };

  return {
    primary,
    restore() {
      globalThis.PIXI =
        previousPixi;

      globalThis.canvas =
        previousCanvas;
    }
  };
}

test(
  "rendering replaces the previous module container instead of stacking",
  () => {
    const environment =
      installPixi();

    try {
      const service =
        new WebRenderService();

      const firstContainer =
        service.render(
          [
            createWeb()
          ],
          createConfiguration()
        );

      assert.equal(
        environment.primary.children.length,
        1
      );

      assert.equal(
        firstContainer.name,
        "dynamic-webs.webs"
      );

      assert.equal(
        firstContainer.children.length,
        1
      );

      assert.equal(
        firstContainer.sortLayer,
        650
      );

      assert.equal(
        firstContainer.sort,
        0
      );

      assert.equal(
        firstContainer.zIndex,
        0
      );



      const strokeCommands =
        firstContainer.children[0].commands.filter(
          (
            command
          ) =>
            command[0] ===
              "stroke"
        );

      assert.equal(
        strokeCommands[0][1].color,
        0x123456
      );

      assert.equal(
        strokeCommands[1][1].color,
        0xabcdef
      );

      const secondContainer =
        service.render(
          [
            createWeb(
              "ground:scene:index-1"
            )
          ],
          createConfiguration()
        );

      assert.notEqual(
        secondContainer,
        firstContainer
      );

      assert.equal(
        firstContainer.destroyed,
        true
      );

      assert.equal(
        environment.primary.children.length,
        1
      );

      assert.equal(
        environment.primary.children[0],
        secondContainer
      );

      assert.equal(
        service.createDiagnosticSnapshot().renderRevision,
        2
      );
    } finally {
      environment.restore();
    }
  }
);

test(
  "rendering scales silk and under-stroke widths without mutating strand widths",
  () => {
    const environment =
      installPixi();

    try {
      const service =
        new WebRenderService();

      const web =
        createWeb();

      const container =
        service.render(
          [
            web
          ],
          createConfiguration(
            2.5
          )
        );

      const strokeCommands =
        container.children[0].commands.filter(
          (
            command
          ) =>
            command[0] ===
              "stroke"
        );

      assert.equal(
        strokeCommands[0][1].width,
        6
      );

      assert.equal(
        strokeCommands[1][1].width,
        3
      );

      assert.equal(
        web.strands[0].widthPx,
        1
      );

      assert.equal(
        service.createDiagnosticSnapshot().thicknessMultiplier,
        3
      );
    } finally {
      environment.restore();
    }
  }
);

test(
  "clear removes and destroys the active container",
  () => {
    const environment =
      installPixi();

    try {
      const service =
        new WebRenderService();

      const container =
        service.render(
          [
            createWeb()
          ],
          createConfiguration()
        );

      assert.equal(
        service.clear(),
        true
      );

      assert.equal(
        container.destroyed,
        true
      );

      assert.deepEqual(
        environment.primary.children,
        []
      );

      const snapshot =
        service.createDiagnosticSnapshot();

      assert.equal(
        snapshot.hasContainer,
        false
      );

      assert.equal(
        snapshot.renderedWebCount,
        0
      );

      assert.equal(
        Object.isFrozen(
          snapshot
        ),
        true
      );
    } finally {
      environment.restore();
    }
  }
);

test(
  "a drawing failure clears the partially created render state",
  () => {
    class FailingGraphics extends MockGraphics {
      stroke() {
        throw new Error(
          "simulated drawing failure"
        );
      }
    }

    const environment =
      installPixi({
        Graphics:
          FailingGraphics
      });

    try {
      const service =
        new WebRenderService();

      assert.throws(
        () =>
          service.render(
            [
              createWeb()
            ],
            createConfiguration()
          ),
        /simulated drawing failure/u
      );

      assert.deepEqual(
        environment.primary.children,
        []
      );

      assert.equal(
        service.createDiagnosticSnapshot().hasContainer,
        false
      );
    } finally {
      environment.restore();
    }
  }
);



test(
  "cumulative visible levels render as separate elevation-sorted sibling containers",
  () => {
    const environment =
      installPixi();

    try {
      const service =
        new WebRenderService();

      const returnedContainer =
        service.render(
          [
            createWeb(
              "ground:scene:lower",
              0
            ),
            createWeb(
              "ground:scene:upper",
              10
            )
          ],
          createConfiguration()
        );

      assert.equal(
        environment.primary.children.length,
        2
      );

      assert.deepEqual(
        environment.primary.children.map(
          (
            container
          ) =>
            container.elevation
        ),
        [
          0,
          10
        ]
      );

      assert.equal(
        environment.primary.children[0].children[0].elevation,
        0
      );

      assert.equal(
        environment.primary.children[1].children[0].elevation,
        10
      );

      assert.equal(
        returnedContainer,
        environment.primary.children[1]
      );

      const snapshot =
        service.createDiagnosticSnapshot();

      assert.equal(
        snapshot.containerCount,
        2
      );

      assert.deepEqual(
        snapshot.elevations,
        [
          0,
          10
        ]
      );

      assert.equal(
        snapshot.renderedWebCount,
        2
      );

      const containers =
        [...environment.primary.children];

      assert.equal(
        service.clear(),
        true
      );

      assert.deepEqual(
        environment.primary.children,
        []
      );

      assert.equal(
        containers.every(
          (
            container
          ) =>
            container.destroyed ===
              true
        ),
        true
      );
    } finally {
      environment.restore();
    }
  }
);

test(
  "rendering stamps the visible level elevation onto the web container and graphics",
  () => {
    const environment =
      installPixi();

    try {
      const service =
        new WebRenderService();

      const container =
        service.render(
          [
            createWeb(
              "ground:scene:upper",
              10
            )
          ],
          createConfiguration()
        );

      assert.equal(
        container.elevation,
        10
      );

      assert.equal(
        container.children[0].elevation,
        10
      );

      assert.equal(
        service.createDiagnosticSnapshot().elevation,
        10
      );
    } finally {
      environment.restore();
    }
  }
);

