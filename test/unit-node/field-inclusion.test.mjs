import test from "node:test";
import assert from "node:assert/strict";
import { getIncludedDataPaths } from "../../src-web/studio.mjs";

test("data field inclusion only follows mappings used by current PDF schemas", () => {
  const template = {
    schemas: [[
      { name: "customerName", type: "text" },
      { name: "summary", type: "text" },
      { name: "rows", type: "table" }
    ]]
  };
  const included = getIncludedDataPaths(template, {
    fields: {
      customerName: "order.customer.name",
      summary: { template: "{order.number} · {brand.name}" },
      rows: { path: "order.items", formatter: "table" },
      deletedSchema: "order.internalNote"
    }
  });

  assert.deepEqual([...included].sort(), [
    "brand.name",
    "order.customer.name",
    "order.items",
    "order.number"
  ]);
  assert.equal(included.has("order.internalNote"), false);
});

test("data field inclusion expands repeat item paths to the visible sample row", () => {
  const included = getIncludedDataPaths({ schemas: [[{ name: "quantity" }]] }, {
    repeat: "order.items",
    fields: { quantity: "$item.quantity" }
  });

  assert.equal(included.has("order.items.0.quantity"), true);
});

test("data field inclusion follows multi-variable definitions", () => {
  const included = getIncludedDataPaths({ schemas: [[{ name: "summary" }]] }, {
    fields: { summary: { variables: { subtotal: "totals.subtotal" } } }
  });

  assert.equal(included.has("totals.subtotal"), true);
});
