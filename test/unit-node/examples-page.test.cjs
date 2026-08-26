const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "../..");

test("examples page links each live demo to its GitHub source", () => {
  const html = fs.readFileSync(path.join(root, "examples/index.html"), "utf8");

  const examples = [
    { title: "OpenUI5", demo: "ui5", source: "test/ui5/pdfme/demokit" },
    { title: "JavaScript", demo: "javascript", source: "examples/javascript" },
    { title: "React", demo: "react", source: "examples/react" }
  ];

  for (const { title, demo, source } of examples) {
    const article = html.match(new RegExp(`<article class="card"><h2>${title}</h2>[\\s\\S]*?</article>`));

    assert.ok(article, `missing card for ${title}`);
    assert.ok(article[0].includes(`href="${demo}/" aria-label="Abrir demo ${title}"`));
    assert.ok(
      article[0].includes(
        `href="https://github.com/jesusfrguz/ui5-pdfme/tree/main/${source}" target="_blank" rel="noopener noreferrer"`
      ),
      `missing safe GitHub source link for ${demo}`
    );
    assert.ok(article[0].includes("(se abre en una pestaña nueva)"));
    assert.ok(fs.existsSync(path.join(root, source)), `missing local source path for ${demo}`);
  }

  const deferred = html.match(/<article class="card"><h2>Generación diferida<\/h2>[\s\S]*?<\/article>/);
  assert.ok(deferred, "missing deferred-generation card");
  assert.ok(deferred[0].includes('href="../deferred/"'));
  assert.ok(deferred[0].includes('href="https://github.com/jesusfrguz/ui5-pdfme/tree/main/examples/deferred"'));
  assert.ok(fs.existsSync(path.join(root, "examples/deferred")));

  assert.equal((html.match(/>Ver código<\/a>/g) || []).length, 4);
});
