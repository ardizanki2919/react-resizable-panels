import { createRef } from "react";
import { Root, createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  DATA_ATTRIBUTES,
  ImperativePanelHandle,
  Panel,
  PanelGroup,
  PanelResizeHandle,
} from ".";
import { assert } from "./utils/assert";
import { getPanelElement } from "./utils/dom/getPanelElement";
import {
  mockPanelGroupOffsetWidthAndHeight,
  verifyAttribute,
  verifyExpandedPanelGroupLayout,
} from "./utils/test-utils";

describe("PanelGroup", () => {
  let expectedWarnings: string[] = [];
  let root: Root;
  let container: HTMLElement;
  let uninstallMockOffsetWidthAndHeight: () => void;

  function expectWarning(expectedMessage: string) {
    expectedWarnings.push(expectedMessage);
  }

  beforeEach(() => {
    // @ts-expect-error
    global.IS_REACT_ACT_ENVIRONMENT = true;

    uninstallMockOffsetWidthAndHeight = mockPanelGroupOffsetWidthAndHeight();

    container = document.createElement("div");
    document.body.appendChild(container);

    expectedWarnings = [];
    root = createRoot(container);

    vi.spyOn(console, "warn").mockImplementation((actualMessage: string) => {
      const match = expectedWarnings.findIndex((expectedMessage) => {
        return actualMessage.includes(expectedMessage);
      });

      if (match >= 0) {
        expectedWarnings.splice(match, 1);
        return;
      }

      throw Error(`Unexpected warning: ${actualMessage}`);
    });
  });

  afterEach(() => {
    uninstallMockOffsetWidthAndHeight();

    vi.clearAllMocks();
    vi.resetModules();

    act(() => {
      root.unmount();
    });

    expect(expectedWarnings).toHaveLength(0);
  });

  describe("imperative handle API", () => {
    describe("collapse and expand", () => {
      let leftPanelRef = createRef<ImperativePanelHandle>();
      let rightPanelRef = createRef<ImperativePanelHandle>();

      let mostRecentLayout: number[] | null;

      beforeEach(() => {
        leftPanelRef = createRef<ImperativePanelHandle>();
        rightPanelRef = createRef<ImperativePanelHandle>();

        mostRecentLayout = null;

        const onLayout = (layout: number[]) => {
          mostRecentLayout = layout;
        };

        act(() => {
          root.render(
            <PanelGroup direction="horizontal" onLayout={onLayout}>
              <Panel collapsible defaultSize={50} ref={leftPanelRef} />
              <PanelResizeHandle />
              <Panel collapsible defaultSize={50} ref={rightPanelRef} />
            </PanelGroup>
          );
        });
      });

      test("should expand and collapse the first panel in a group", () => {
        assert(mostRecentLayout, "");

        verifyExpandedPanelGroupLayout(mostRecentLayout, [50, 50]);
        expect(leftPanelRef.current?.isCollapsed()).toBe(false);
        expect(rightPanelRef.current?.isCollapsed()).toBe(false);
        act(() => {
          leftPanelRef.current?.collapse();
        });
        expect(leftPanelRef.current?.isCollapsed()).toBe(true);
        expect(rightPanelRef.current?.isCollapsed()).toBe(false);
        verifyExpandedPanelGroupLayout(mostRecentLayout, [0, 100]);
        act(() => {
          leftPanelRef.current?.expand();
        });
        expect(leftPanelRef.current?.isCollapsed()).toBe(false);
        expect(rightPanelRef.current?.isCollapsed()).toBe(false);
        verifyExpandedPanelGroupLayout(mostRecentLayout, [50, 50]);
      });

      test("should expand and collapse the last panel in a group", () => {
        assert(mostRecentLayout, "");

        verifyExpandedPanelGroupLayout(mostRecentLayout, [50, 50]);
        expect(leftPanelRef.current?.isCollapsed()).toBe(false);
        expect(rightPanelRef.current?.isCollapsed()).toBe(false);
        act(() => {
          rightPanelRef.current?.collapse();
        });
        verifyExpandedPanelGroupLayout(mostRecentLayout, [100, 0]);
        expect(leftPanelRef.current?.isCollapsed()).toBe(false);
        expect(rightPanelRef.current?.isCollapsed()).toBe(true);
        act(() => {
          rightPanelRef.current?.expand();
        });
        verifyExpandedPanelGroupLayout(mostRecentLayout, [50, 50]);
        expect(leftPanelRef.current?.isCollapsed()).toBe(false);
        expect(rightPanelRef.current?.isCollapsed()).toBe(false);
      });

      test("should re-expand to the most recent size before collapsing", () => {
        assert(mostRecentLayout, "");

        verifyExpandedPanelGroupLayout(mostRecentLayout, [50, 50]);
        act(() => {
          leftPanelRef.current?.resize(30);
        });
        verifyExpandedPanelGroupLayout(mostRecentLayout, [30, 70]);
        act(() => {
          leftPanelRef.current?.collapse();
        });
        verifyExpandedPanelGroupLayout(mostRecentLayout, [0, 100]);
        act(() => {
          leftPanelRef.current?.expand();
        });
        verifyExpandedPanelGroupLayout(mostRecentLayout, [30, 70]);
      });

      test("should report the correct state with collapsedSizes that have many decimal places", () => {
        act(() => {
          root.render(
            <PanelGroup direction="horizontal">
              <Panel
                collapsedSize={3.8764385221078133}
                collapsible
                defaultSize={50}
                minSize={15}
                ref={leftPanelRef}
              />
              <PanelResizeHandle />
              <Panel collapsible defaultSize={50} ref={rightPanelRef} />
            </PanelGroup>
          );
        });

        act(() => {
          leftPanelRef.current?.collapse();
        });
        expect(leftPanelRef.current?.isCollapsed()).toBe(true);
        expect(leftPanelRef.current?.isExpanded()).toBe(false);

        act(() => {
          root.render(
            <PanelGroup direction="horizontal">
              <Panel
                collapsedSize={3.8764385221078132}
                collapsible
                defaultSize={50}
                minSize={15}
                ref={leftPanelRef}
              />
              <PanelResizeHandle />
              <Panel collapsible defaultSize={50} ref={rightPanelRef} />
            </PanelGroup>
          );
        });

        expect(leftPanelRef.current?.isCollapsed()).toBe(true);
        expect(leftPanelRef.current?.isExpanded()).toBe(false);

        act(() => {
          leftPanelRef.current?.expand();
        });
        expect(leftPanelRef.current?.isCollapsed()).toBe(false);
        expect(leftPanelRef.current?.isExpanded()).toBe(true);
      });

      describe("when a panel is mounted in a collapsed state", () => {
        beforeEach(() => {
          act(() => {
            root.unmount();
          });
        });

        test("should expand to the panel's minSize", () => {
          const panelRef = createRef<ImperativePanelHandle>();

          root = createRoot(container);

          function renderPanelGroup() {
            act(() => {
              root.render(
                <PanelGroup direction="horizontal">
                  <Panel
                    collapsible
                    defaultSize={0}
                    minSize={5}
                    ref={panelRef}
                  />
                  <PanelResizeHandle />
                  <Panel />
                </PanelGroup>
              );
            });
          }

          // Re-render and confirmed collapsed by default
          renderPanelGroup();
          act(() => {
            panelRef.current?.collapse();
          });
          expect(panelRef.current?.getSize()).toEqual(0);

          // Toggling a panel should expand to the minSize (since there's no previous size to restore to)
          act(() => {
            panelRef.current?.expand();
          });
          expect(panelRef.current?.getSize()).toEqual(5);

          // Collapse again
          act(() => {
            panelRef.current?.collapse();
          });
          expect(panelRef.current?.getSize()).toEqual(0);

          // Toggling the panel should expand to the minSize override if one is specified
          // Note this only works because the previous non-collapsed size is less than the minSize override
          act(() => {
            panelRef.current?.expand(15);
          });
          expect(panelRef.current?.getSize()).toEqual(15);
        });

        test("should support the (optional) default size", () => {
          const panelRef = createRef<ImperativePanelHandle>();

          root = createRoot(container);

          function renderPanelGroup() {
            act(() => {
              root.render(
                <PanelGroup autoSaveId="test" direction="horizontal">
                  <Panel
                    collapsible
                    defaultSize={0}
                    minSize={0}
                    ref={panelRef}
                  />
                  <PanelResizeHandle />
                  <Panel />
                </PanelGroup>
              );
            });
          }

          // Re-render and confirmed collapsed by default
          renderPanelGroup();
          act(() => {
            panelRef.current?.collapse();
          });
          expect(panelRef.current?.getSize()).toEqual(0);

          // In this case, toggling the panel to expanded will not change its size
          act(() => {
            panelRef.current?.expand();
          });
          expect(panelRef.current?.getSize()).toEqual(0);

          // But we can override the toggle behavior by passing an explicit min size
          act(() => {
            panelRef.current?.expand(10);
          });
          expect(panelRef.current?.getSize()).toEqual(10);

          // Toggling an already-expanded panel should not do anything even if we pass a default size
          act(() => {
            panelRef.current?.expand(15);
          });
          expect(panelRef.current?.getSize()).toEqual(10);
        });
      });
    });

    describe("resize", () => {
      let leftPanelRef = createRef<ImperativePanelHandle>();
      let middlePanelRef = createRef<ImperativePanelHandle>();
      let rightPanelRef = createRef<ImperativePanelHandle>();

      let mostRecentLayout: number[] | null;

      beforeEach(() => {
        leftPanelRef = createRef<ImperativePanelHandle>();
        middlePanelRef = createRef<ImperativePanelHandle>();
        rightPanelRef = createRef<ImperativePanelHandle>();

        mostRecentLayout = null;

        const onLayout = (layout: number[]) => {
          mostRecentLayout = layout;
        };

        act(() => {
          root.render(
            <PanelGroup direction="horizontal" onLayout={onLayout}>
              <Panel defaultSize={20} ref={leftPanelRef} />
              <PanelResizeHandle />
              <Panel defaultSize={60} ref={middlePanelRef} />
              <PanelResizeHandle />
              <Panel defaultSize={20} ref={rightPanelRef} />
            </PanelGroup>
          );
        });
      });

      test("should resize the first panel in a group", () => {
        assert(mostRecentLayout, "");

        verifyExpandedPanelGroupLayout(mostRecentLayout, [20, 60, 20]);
        act(() => {
          leftPanelRef.current?.resize(40);
        });
        verifyExpandedPanelGroupLayout(mostRecentLayout, [40, 40, 20]);
      });

      test("should resize the middle panel in a group", () => {
        assert(mostRecentLayout, "");

        verifyExpandedPanelGroupLayout(mostRecentLayout, [20, 60, 20]);
        act(() => {
          middlePanelRef.current?.resize(40);
        });
        verifyExpandedPanelGroupLayout(mostRecentLayout, [20, 40, 40]);
      });

      test("should resize the last panel in a group", () => {
        assert(mostRecentLayout, "");

        verifyExpandedPanelGroupLayout(mostRecentLayout, [20, 60, 20]);
        act(() => {
          rightPanelRef.current?.resize(40);
        });
        verifyExpandedPanelGroupLayout(mostRecentLayout, [20, 40, 40]);
      });
    });
  });

  describe("invariants", () => {
    beforeEach(() => {
      vi.spyOn(console, "error").mockImplementation(() => {
        // Noop
      });
    });

    test("should throw if default size is less than 0 or greater than 100", () => {
      expect(() => {
        act(() => {
          root.render(
            <PanelGroup direction="horizontal">
              <Panel defaultSize={-1} />
            </PanelGroup>
          );
        });
      }).toThrow("Invalid layout");

      expect(() => {
        act(() => {
          root.render(
            <PanelGroup direction="horizontal">
              <Panel defaultSize={101} />
            </PanelGroup>
          );
        });
      }).toThrow("Invalid layout");
    });

    test("should throw if rendered outside of a PanelGroup", () => {
      expect(() => {
        act(() => {
          root.render(<Panel />);
        });
      }).toThrow(
        "Panel components must be rendered within a PanelGroup container"
      );
    });
  });

  test("should support ...rest attributes", () => {
    act(() => {
      root.render(
        <PanelGroup direction="horizontal">
          <Panel data-test-name="foo" id="panel" tabIndex={123} title="bar" />
          <PanelResizeHandle />
          <Panel />
        </PanelGroup>
      );
    });

    const element = getPanelElement("panel", container);
    assert(element, "");
    expect(element.tabIndex).toBe(123);
    expect(element.getAttribute("data-test-name")).toBe("foo");
    expect(element.title).toBe("bar");
  });

  describe("constraints", () => {
    test("should resize a collapsed panel if the collapsedSize prop changes", () => {
      act(() => {
        root.render(
          <PanelGroup direction="horizontal">
            <Panel
              id="left"
              collapsedSize={10}
              collapsible
              defaultSize={10}
              minSize={25}
            />
            <PanelResizeHandle />
            <Panel id="middle" />
            <PanelResizeHandle />
            <Panel
              id="right"
              collapsedSize={10}
              collapsible
              defaultSize={10}
              minSize={25}
            />
          </PanelGroup>
        );
      });

      let leftElement = getPanelElement("left", container);
      let middleElement = getPanelElement("middle", container);
      let rightElement = getPanelElement("right", container);
      assert(leftElement, "");
      assert(middleElement, "");
      assert(rightElement, "");
      expect(leftElement.getAttribute(DATA_ATTRIBUTES.panelSize)).toBe("10.0");
      expect(middleElement.getAttribute(DATA_ATTRIBUTES.panelSize)).toBe(
        "80.0"
      );
      expect(rightElement.getAttribute(DATA_ATTRIBUTES.panelSize)).toBe("10.0");

      act(() => {
        root.render(
          <PanelGroup direction="horizontal">
            <Panel id="left" collapsedSize={5} collapsible minSize={25} />
            <PanelResizeHandle />
            <Panel id="middle" />
            <PanelResizeHandle />
            <Panel id="right" collapsedSize={5} collapsible minSize={25} />
          </PanelGroup>
        );
      });

      expect(leftElement.getAttribute(DATA_ATTRIBUTES.panelSize)).toBe("5.0");
      expect(middleElement.getAttribute(DATA_ATTRIBUTES.panelSize)).toBe(
        "90.0"
      );
      expect(rightElement.getAttribute(DATA_ATTRIBUTES.panelSize)).toBe("5.0");
    });

    test("it should not expand a collapsed panel if other constraints change", () => {
      act(() => {
        root.render(
          <PanelGroup direction="horizontal">
            <Panel
              id="left"
              collapsedSize={10}
              collapsible
              defaultSize={10}
              minSize={25}
            />
            <PanelResizeHandle />
            <Panel id="middle" />
            <PanelResizeHandle />
            <Panel
              id="right"
              collapsedSize={10}
              collapsible
              defaultSize={10}
              minSize={25}
            />
          </PanelGroup>
        );
      });

      let leftElement = getPanelElement("left", container);
      let middleElement = getPanelElement("middle", container);
      let rightElement = getPanelElement("right", container);
      assert(leftElement, "");
      assert(middleElement, "");
      assert(rightElement, "");
      expect(leftElement.getAttribute(DATA_ATTRIBUTES.panelSize)).toBe("10.0");
      expect(middleElement.getAttribute(DATA_ATTRIBUTES.panelSize)).toBe(
        "80.0"
      );
      expect(rightElement.getAttribute(DATA_ATTRIBUTES.panelSize)).toBe("10.0");

      act(() => {
        root.render(
          <PanelGroup direction="horizontal">
            <Panel id="left" collapsedSize={10} collapsible minSize={20} />
            <PanelResizeHandle />
            <Panel id="middle" />
            <PanelResizeHandle />
            <Panel id="right" collapsedSize={10} collapsible minSize={20} />
          </PanelGroup>
        );
      });

      expect(leftElement.getAttribute(DATA_ATTRIBUTES.panelSize)).toBe("10.0");
      expect(middleElement.getAttribute(DATA_ATTRIBUTES.panelSize)).toBe(
        "80.0"
      );
      expect(rightElement.getAttribute(DATA_ATTRIBUTES.panelSize)).toBe("10.0");
    });

    test("should resize a panel if the minSize prop changes", () => {
      act(() => {
        root.render(
          <PanelGroup direction="horizontal">
            <Panel id="left" defaultSize={15} minSize={10} />
            <PanelResizeHandle />
            <Panel id="middle" />
            <PanelResizeHandle />
            <Panel id="right" defaultSize={15} minSize={10} />
          </PanelGroup>
        );
      });

      let leftElement = getPanelElement("left", container);
      let middleElement = getPanelElement("middle", container);
      let rightElement = getPanelElement("right", container);
      assert(leftElement, "");
      assert(middleElement, "");
      assert(rightElement, "");
      expect(leftElement.getAttribute(DATA_ATTRIBUTES.panelSize)).toBe("15.0");
      expect(middleElement.getAttribute(DATA_ATTRIBUTES.panelSize)).toBe(
        "70.0"
      );
      expect(rightElement.getAttribute(DATA_ATTRIBUTES.panelSize)).toBe("15.0");

      act(() => {
        root.render(
          <PanelGroup direction="horizontal">
            <Panel id="left" minSize={20} />
            <PanelResizeHandle />
            <Panel id="middle" />
            <PanelResizeHandle />
            <Panel id="right" minSize={20} />
          </PanelGroup>
        );
      });

      expect(leftElement.getAttribute(DATA_ATTRIBUTES.panelSize)).toBe("20.0");
      expect(middleElement.getAttribute(DATA_ATTRIBUTES.panelSize)).toBe(
        "60.0"
      );
      expect(rightElement.getAttribute(DATA_ATTRIBUTES.panelSize)).toBe("20.0");
    });

    test("should resize a panel if the maxSize prop changes", () => {
      act(() => {
        root.render(
          <PanelGroup direction="horizontal">
            <Panel id="left" defaultSize={25} maxSize={30} />
            <PanelResizeHandle />
            <Panel id="middle" />
            <PanelResizeHandle />
            <Panel id="right" defaultSize={25} maxSize={30} />
          </PanelGroup>
        );
      });

      let leftElement = getPanelElement("left", container);
      let middleElement = getPanelElement("middle", container);
      let rightElement = getPanelElement("right", container);
      assert(leftElement, "");
      assert(middleElement, "");
      assert(rightElement, "");
      expect(leftElement.getAttribute(DATA_ATTRIBUTES.panelSize)).toBe("25.0");
      expect(middleElement.getAttribute(DATA_ATTRIBUTES.panelSize)).toBe(
        "50.0"
      );
      expect(rightElement.getAttribute(DATA_ATTRIBUTES.panelSize)).toBe("25.0");

      act(() => {
        root.render(
          <PanelGroup direction="horizontal">
            <Panel id="left" maxSize={20} />
            <PanelResizeHandle />
            <Panel id="middle" />
            <PanelResizeHandle />
            <Panel id="right" maxSize={20} />
          </PanelGroup>
        );
      });

      expect(leftElement.getAttribute(DATA_ATTRIBUTES.panelSize)).toBe("20.0");
      expect(middleElement.getAttribute(DATA_ATTRIBUTES.panelSize)).toBe(
        "60.0"
      );
      expect(rightElement.getAttribute(DATA_ATTRIBUTES.panelSize)).toBe("20.0");
    });
  });

  describe("callbacks", () => {
    describe("onCollapse", () => {
      test("should be called on mount if a panels initial size is 0", () => {
        let onCollapseLeft = vi.fn();
        let onCollapseRight = vi.fn();

        act(() => {
          root.render(
            <PanelGroup direction="horizontal">
              <Panel collapsible defaultSize={0} onCollapse={onCollapseLeft} />
              <PanelResizeHandle />
              <Panel collapsible onCollapse={onCollapseRight} />
            </PanelGroup>
          );
        });

        expect(onCollapseLeft).toHaveBeenCalledTimes(1);
        expect(onCollapseRight).not.toHaveBeenCalled();
      });

      test("should be called when a panel is collapsed", () => {
        let onCollapse = vi.fn();

        let panelRef = createRef<ImperativePanelHandle>();

        act(() => {
          root.render(
            <PanelGroup direction="horizontal">
              <Panel collapsible onCollapse={onCollapse} ref={panelRef} />
              <PanelResizeHandle />
              <Panel />
            </PanelGroup>
          );
        });

        expect(onCollapse).not.toHaveBeenCalled();

        act(() => {
          panelRef.current?.collapse();
        });

        expect(onCollapse).toHaveBeenCalledTimes(1);
      });

      test("should be called with collapsedSizes that have many decimal places", () => {
        let onCollapse = vi.fn();

        let panelRef = createRef<ImperativePanelHandle>();

        act(() => {
          root.render(
            <PanelGroup direction="horizontal">
              <Panel
                collapsible
                onCollapse={onCollapse}
                collapsedSize={3.8764385221078133}
                minSize={10}
                ref={panelRef}
              />
              <PanelResizeHandle />
              <Panel />
            </PanelGroup>
          );
        });
        expect(onCollapse).not.toHaveBeenCalled();

        act(() => {
          panelRef.current?.collapse();
        });
        expect(onCollapse).toHaveBeenCalledTimes(1);

        act(() => {
          panelRef.current?.expand();
        });
        expect(onCollapse).toHaveBeenCalledTimes(1);

        act(() => {
          panelRef.current?.collapse();
        });
        expect(onCollapse).toHaveBeenCalledTimes(2);
      });
    });

    describe("onExpand", () => {
      test("should be called on mount if a collapsible panels initial size is not 0", () => {
        let onExpandLeft = vi.fn();
        let onExpandRight = vi.fn();

        act(() => {
          root.render(
            <PanelGroup direction="horizontal">
              <Panel collapsible onExpand={onExpandLeft} />
              <PanelResizeHandle />
              <Panel onExpand={onExpandRight} />
            </PanelGroup>
          );
        });

        expect(onExpandLeft).toHaveBeenCalledTimes(1);
        expect(onExpandRight).not.toHaveBeenCalled();
      });

      test("should be called when a collapsible panel is expanded", () => {
        let onExpand = vi.fn();

        let panelRef = createRef<ImperativePanelHandle>();

        act(() => {
          root.render(
            <PanelGroup direction="horizontal">
              <Panel
                collapsible
                defaultSize={0}
                onExpand={onExpand}
                ref={panelRef}
              />
              <PanelResizeHandle />
              <Panel />
            </PanelGroup>
          );
        });

        expect(onExpand).not.toHaveBeenCalled();

        act(() => {
          panelRef.current?.resize(25);
        });

        expect(onExpand).toHaveBeenCalledTimes(1);
      });

      test("should be called with collapsedSizes that have many decimal places", () => {
        let onExpand = vi.fn();

        let panelRef = createRef<ImperativePanelHandle>();

        act(() => {
          root.render(
            <PanelGroup direction="horizontal">
              <Panel
                collapsible
                collapsedSize={3.8764385221078133}
                defaultSize={3.8764385221078133}
                minSize={10}
                onExpand={onExpand}
                ref={panelRef}
              />
              <PanelResizeHandle />
              <Panel />
            </PanelGroup>
          );
        });
        expect(onExpand).not.toHaveBeenCalled();

        act(() => {
          panelRef.current?.resize(25);
        });
        expect(onExpand).toHaveBeenCalledTimes(1);

        act(() => {
          panelRef.current?.collapse();
        });
        expect(onExpand).toHaveBeenCalledTimes(1);

        act(() => {
          panelRef.current?.expand();
        });
        expect(onExpand).toHaveBeenCalledTimes(2);
      });
    });

    describe("onResize", () => {
      test("should be called on mount", () => {
        let onResizeLeft = vi.fn();
        let onResizeMiddle = vi.fn();
        let onResizeRight = vi.fn();

        act(() => {
          root.render(
            <PanelGroup direction="horizontal">
              <Panel id="left" onResize={onResizeLeft} order={1} />
              <PanelResizeHandle />
              <Panel
                defaultSize={50}
                id="middle"
                onResize={onResizeMiddle}
                order={2}
              />
              <PanelResizeHandle />
              <Panel id="right" onResize={onResizeRight} order={3} />
            </PanelGroup>
          );
        });

        expect(onResizeLeft).toHaveBeenCalledTimes(1);
        expect(onResizeLeft).toHaveBeenCalledWith(25, undefined);
        expect(onResizeMiddle).toHaveBeenCalledTimes(1);
        expect(onResizeMiddle).toHaveBeenCalledWith(50, undefined);
        expect(onResizeRight).toHaveBeenCalledTimes(1);
        expect(onResizeRight).toHaveBeenCalledWith(25, undefined);
      });

      test("should be called when a panel is added or removed from the group", () => {
        let onResizeLeft = vi.fn();
        let onResizeMiddle = vi.fn();
        let onResizeRight = vi.fn();

        act(() => {
          root.render(
            <PanelGroup direction="horizontal">
              <Panel
                id="middle"
                key="middle"
                onResize={onResizeMiddle}
                order={2}
              />
            </PanelGroup>
          );
        });

        expect(onResizeLeft).not.toHaveBeenCalled();
        expect(onResizeMiddle).toHaveBeenCalledWith(100, undefined);
        expect(onResizeRight).not.toHaveBeenCalled();

        onResizeLeft.mockReset();
        onResizeMiddle.mockReset();
        onResizeRight.mockReset();

        act(() => {
          root.render(
            <PanelGroup direction="horizontal">
              <Panel
                id="left"
                key="left"
                maxSize={25}
                minSize={25}
                onResize={onResizeLeft}
                order={1}
              />
              <PanelResizeHandle />
              <Panel
                id="middle"
                key="middle"
                onResize={onResizeMiddle}
                order={2}
              />
              <PanelResizeHandle />
              <Panel
                id="right"
                key="right"
                maxSize={25}
                minSize={25}
                onResize={onResizeRight}
                order={3}
              />
            </PanelGroup>
          );
        });

        expect(onResizeLeft).toHaveBeenCalledTimes(1);
        expect(onResizeLeft).toHaveBeenCalledWith(25, undefined);
        expect(onResizeMiddle).toHaveBeenCalledTimes(1);
        expect(onResizeMiddle).toHaveBeenCalledWith(50, 100);
        expect(onResizeRight).toHaveBeenCalledTimes(1);
        expect(onResizeRight).toHaveBeenCalledWith(25, undefined);

        onResizeLeft.mockReset();
        onResizeMiddle.mockReset();
        onResizeRight.mockReset();

        act(() => {
          root.render(
            <PanelGroup direction="horizontal">
              <Panel
                id="left"
                key="left"
                maxSize={25}
                minSize={25}
                onResize={onResizeLeft}
                order={1}
              />
              <PanelResizeHandle />
              <Panel
                id="middle"
                key="middle"
                onResize={onResizeMiddle}
                order={2}
              />
            </PanelGroup>
          );
        });

        expect(onResizeLeft).not.toHaveBeenCalled();
        expect(onResizeMiddle).toHaveBeenCalledTimes(1);
        expect(onResizeMiddle).toHaveBeenCalledWith(75, 50);
        expect(onResizeRight).not.toHaveBeenCalled();
      });
    });

    test("should support sizes with many decimal places", () => {
      let panelRef = createRef<ImperativePanelHandle>();
      let onResize = vi.fn();

      act(() => {
        root.render(
          <PanelGroup direction="horizontal">
            <Panel onResize={onResize} ref={panelRef} />
            <PanelResizeHandle />
            <Panel />
          </PanelGroup>
        );
      });
      expect(onResize).toHaveBeenCalledTimes(1);

      act(() => {
        panelRef.current?.resize(3.8764385221078133);
      });
      expect(onResize).toHaveBeenCalledTimes(2);

      // An overly-high precision change should be ignored
      act(() => {
        panelRef.current?.resize(3.8764385221078132);
      });
      expect(onResize).toHaveBeenCalledTimes(2);
    });
  });

  describe("data attributes", () => {
    test("should initialize with the correct props based attributes", () => {
      act(() => {
        root.render(
          <PanelGroup direction="horizontal" id="test-group">
            <Panel defaultSize={75} id="left-panel" />
            <PanelResizeHandle />
            <Panel collapsible id="right-panel" />
          </PanelGroup>
        );
      });

      const leftElement = getPanelElement("left-panel", container);
      const rightElement = getPanelElement("right-panel", container);

      assert(leftElement, "");
      assert(rightElement, "");

      verifyAttribute(leftElement, DATA_ATTRIBUTES.panel, "");
      verifyAttribute(leftElement, DATA_ATTRIBUTES.panelId, "left-panel");
      verifyAttribute(leftElement, DATA_ATTRIBUTES.groupId, "test-group");
      verifyAttribute(leftElement, DATA_ATTRIBUTES.panelSize, "75.0");
      verifyAttribute(leftElement, DATA_ATTRIBUTES.panelCollapsible, null);

      verifyAttribute(rightElement, DATA_ATTRIBUTES.panel, "");
      verifyAttribute(rightElement, DATA_ATTRIBUTES.panelId, "right-panel");
      verifyAttribute(rightElement, DATA_ATTRIBUTES.groupId, "test-group");
      verifyAttribute(rightElement, DATA_ATTRIBUTES.panelSize, "25.0");
      verifyAttribute(rightElement, DATA_ATTRIBUTES.panelCollapsible, "true");
    });

    test("should update the data-panel-size attribute when the panel resizes", () => {
      const leftPanelRef = createRef<ImperativePanelHandle>();

      act(() => {
        root.render(
          <PanelGroup direction="horizontal" id="test-group">
            <Panel defaultSize={75} id="left-panel" ref={leftPanelRef} />
            <PanelResizeHandle />
            <Panel collapsible id="right-panel" />
          </PanelGroup>
        );
      });

      const leftElement = getPanelElement("left-panel", container);
      const rightElement = getPanelElement("right-panel", container);

      assert(leftElement, "");
      assert(rightElement, "");

      verifyAttribute(leftElement, DATA_ATTRIBUTES.panelSize, "75.0");
      verifyAttribute(rightElement, DATA_ATTRIBUTES.panelSize, "25.0");

      act(() => {
        leftPanelRef.current?.resize(30);
      });

      verifyAttribute(leftElement, DATA_ATTRIBUTES.panelSize, "30.0");
      verifyAttribute(rightElement, DATA_ATTRIBUTES.panelSize, "70.0");
    });
  });

  describe("a11y", () => {
    test("should pass explicit id prop to DOM", () => {
      act(() => {
        root.render(
          <PanelGroup direction="horizontal">
            <Panel id="explicit-id" />
          </PanelGroup>
        );
      });

      const element = container.querySelector("[data-panel]");

      expect(element).not.toBeNull();
      expect(element?.getAttribute("id")).toBe("explicit-id");
    });

    test("should pass auto-generated id prop to DOM", () => {
      act(() => {
        root.render(
          <PanelGroup direction="horizontal">
            <Panel />
          </PanelGroup>
        );
      });

      const element = container.querySelector("[data-panel]");

      expect(element).not.toBeNull();
      expect(element?.getAttribute("id")).not.toBeNull();
    });
  });

  describe("DEV warnings", () => {
    test("should warn if invalid sizes are specified declaratively", () => {
      expectWarning("default size should not be less than 0");

      act(() => {
        root.render(
          <PanelGroup direction="horizontal" key="collapsedSize">
            <Panel defaultSize={-1} />
            <PanelResizeHandle />
            <Panel />
          </PanelGroup>
        );
      });
    });
  });
});
