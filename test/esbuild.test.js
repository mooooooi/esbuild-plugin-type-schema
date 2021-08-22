const { build } = require("esbuild");
const { JSONTypeSchema } = require("../");

build({
    entryPoints: ["test/index.ts"],
    outfile: "test/dist/bundle.js",
    format: "esm",
    plugins: [JSONTypeSchema("test/dist/type.json")],
    tsconfig: "./tsconfig.json",
});
