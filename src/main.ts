import { $$ } from "./dom";
import { initAccuracyTool } from "./accuracy";
import { initRankedTool } from "./ranked";

type Utility = "accuracy" | "ranked";

function initNavigation(): void {
  const links = $$("[data-utility-link]");
  const views = $$("[data-utility-view]");

  const update = (): void => {
    const utility: Utility =
      window.location.hash === "#ranked-maps" ? "ranked" : "accuracy";
    for (const view of views) {
      view.hidden = view.dataset["utilityView"] !== utility;
    }
    for (const link of links) {
      if (link.dataset["utilityLink"] === utility) {
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
    }
    document.title =
      utility === "ranked"
        ? "Ranked Maps Playlist | ScoreSaber Playlist Tools"
        : "Lowest Accuracy Playlist | ScoreSaber Playlist Tools";
  };

  for (const link of links) {
    link.addEventListener("click", () => {
      window.location.hash =
        link.dataset["utilityLink"] === "ranked"
          ? "ranked-maps"
          : "lowest-accuracy";
    });
  }
  window.addEventListener("hashchange", update);
  update();
}

initAccuracyTool();
initRankedTool();
initNavigation();
