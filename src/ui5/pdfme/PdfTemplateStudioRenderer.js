sap.ui.define([], function () {
  "use strict";

  return {
    apiVersion: 2,

    render: function (renderManager, control) {
      renderManager.openStart("section", control)
        .class("ui5PdfmeStudio");
      if (!control.getShowDataPanel()) {
        renderManager.class("ui5PdfmeStudioDataPanelHidden");
      }
      renderManager.style("height", control.getHeight())
        .accessibilityState(control, { role: "region", label: control._getStudioTitleText() })
        .openEnd();

      renderManager.renderControl(control.getAggregation("_toolbar"));

      renderManager.openStart("div", control.getId() + "-workspace")
        .class("ui5PdfmeStudioWorkspace")
        .openEnd();

      renderManager.openStart("aside", control.getId() + "-dataPanel")
        .class("ui5PdfmeStudioDataPanel")
        .attr("aria-hidden", String(!control.getShowDataPanel()))
        .openEnd();
      renderManager.renderControl(control.getAggregation("_dataPanel"));
      renderManager.close("aside");

      renderManager.openStart("main", control.getId() + "-designer")
        .class("ui5PdfmeStudioDesigner")
        .openEnd()
        .close("main");

      renderManager.close("div");
      renderManager.close("section");
    }
  };
});
