// src/log.js
function log(text, system, type = "info", append = {}) {
  let system_colour;
  switch (system) {
    case "load":
      system_colour = "#8CB9D9";
      break;
    case "lotus":
      system_colour = "#8CD9A6";
      break;
    case "season":
      system_colour = "#65B6D8";
      break;
    case "page":
      system_colour = "#E4B381";
      break;
    case "page structure":
      system_colour = "#D88A69";
      break;
    case "style":
      system_colour = "#C9C678";
      break;
    case "profile":
      system_colour = "#D56854";
      break;
    case "settings":
      system_colour = "#6D6977";
      break;
    case "sponsor":
      system_colour = "#CE4E88";
      break;
    default:
      system_colour = "#C8DD88";
      break;
  }
  if (Object.keys(append).length > 0)
    console[type](
      `%c${system}%c ${text}`,
      `background: ${system_colour}; display: block; width: fit-content; font-weight: bold; color: #000; padding: 0 4px; border-radius: 4px`,
      "color: unset",
      append
    );
  else
    console[type](
      `%c${system}%c ${text}`,
      `background: ${system_colour}; display: block; width: fit-content; font-weight: bold; color: #000; padding: 0 4px; border-radius: 4px`,
      "color: unset"
    );
}

// src/index.js
var version = "2025.1019";
var last_page_type = {
  state: void 0
};
var last_page_subpage = {
  state: void 0
};
function florence({
  page,
  on_head_load,
  on_body_load,
  on_mutation,
  on_page_change,
  on_subpage_change,
  on_error
}) {
  log("starting florence", "load", "info", {
    page,
    on_head_load,
    on_body_load,
    on_mutation,
    on_page_change,
    on_subpage_change,
    on_error
  });
  let head_observer = new MutationObserver(() => {
    if (document.head) {
      document.documentElement.classList.add("florence-supports-loading");
      if (on_head_load) on_head_load();
      head_observer.disconnect();
    }
  });
  head_observer.observe(document.documentElement, {
    childList: true
  });
  let pre_observer = new MutationObserver((mutations) => {
    log("pre", "load", "info", { mutations });
    if (document.body) {
      log(`${JSON.stringify(document.body.classList)}`, "load");
      document.body.classList.add("florence");
    }
    if (document.body && document.body.querySelector(".adaptive-skin-container") && document.body.querySelector(".footer")) {
      main();
      pre_observer.disconnect();
    } else if (document.body && (document.body.querySelector(":scope > .container") || document.body.classList.contains("namespace--user_now"))) {
      document.body.classList.add("florence-loaded");
    }
  });
  pre_observer.observe(document.documentElement, {
    childList: true
  });
  function main() {
    log("main thread starting", "page", "log", {
      document,
      body: document.body
    });
    let performance_start = performance.now();
    try {
      if (on_body_load) on_body_load();
      flow();
      const observer = new MutationObserver((mutations) => {
        if (!mutations[0]) return;
        const nodes = [
          ...mutations[0].addedNodes,
          ...mutations[0].removedNodes
        ];
        if (nodes.length && nodes.every(
          (n) => n.nodeType == 1 && (n.hasAttribute("data-tippy-root") || (n.id || "").startsWith("tippy-"))
        )) {
          log("ignored", "mutation", "log", { mutations });
          return;
        }
        log("loop", "mutation", "log", { mutations });
        flow();
      });
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
      let performance_end = performance.now();
      log(
        `finished in ${(performance_end - performance_start) / 1e3} seconds`,
        "load"
      );
    } catch (e) {
      log(`florence ran into an error`, "load", "error", { e });
      if (on_error) on_error(e);
    }
  }
  function flow() {
    let performance_start = performance.now();
    assign_page();
    if (page.state.error) return;
    if (on_mutation) on_mutation();
    let performance_end = performance.now();
    log(
      `finished in ${(performance_end - performance_start) / 1e3} seconds`,
      "loop"
    );
  }
  function assign_page() {
    document.documentElement.classList.add("florence-supports-loading");
    if (!page.structure.wrapper)
      page.structure.wrapper = document.body.querySelector(".main-content");
    let main_content = page.structure.wrapper.querySelector(
      ":scope > :last-child:not([data-florence])"
    );
    if (main_content) {
      assign_page_type();
      if (on_page_change) on_page_change(main_content);
      main_content.setAttribute("data-florence", "true");
    } else {
      assign_page_subpage();
    }
    document.body.classList.add("florence-loaded");
  }
  function assign_page_type() {
    let page_classes = document.body.classList;
    page_classes.forEach((page_class, index) => {
      if (page_class.startsWith("namespace")) {
        page.initial = page_class.replace("namespace--", "");
        let page_split = page.initial.split("_");
        page.type = page_split[0];
        if (page.type == "music") {
          page.type = page_split[1];
        }
        if (page.type != last_page_type.state) {
          last_page_type.state = page.type;
          log(page.type, "page");
        }
        assign_page_subpage();
        return;
      }
      if (index > 4) return;
    });
  }
  function assign_page_subpage() {
    page.subpage = page.initial.replace(page.type, "").replace("_", "").replace("music_", "").replace("festival_", "event_");
    if (last_page_subpage.state != page.subpage) {
      last_page_subpage.state = page.subpage;
      log(`subpage of ${page.subpage}`, "page");
      if (on_subpage_change) on_subpage_change();
    }
  }
}
export {
  florence as default,
  log,
  version
};
