sap.ui.define([], function () {
  "use strict";

  return {
    apiVersion: 2,

    render: function (renderManager, control) {
      renderManager.openStart("section", control)
        .class("ui5PdfmeStudio")
        .style("height", control.getHeight())
        .accessibilityState(control, { role: "region", label: control.getTitle() })
        .openEnd();

      renderManager.renderControl(control.getAggregation("_toolbar"));

      renderManager.openStart("div", control.getId() + "-workspace")
        .class("ui5PdfmeStudioWorkspace")
        .openEnd();

      if (control.getShowDataPanel()) {
        renderManager.openStart("aside", control.getId() + "-dataPanel")
          .class("ui5PdfmeStudioDataPanel")
          .openEnd();
        renderManager.renderControl(control.getAggregation("_dataPanel"));
        renderManager.close("aside");
      }

      renderManager.openStart("main", control.getId() + "-designer")
        .class("ui5PdfmeStudioDesigner")
        .openEnd()
        .close("main");

      renderManager.close("div");
      renderManager.close("section");
    }
  };
});
