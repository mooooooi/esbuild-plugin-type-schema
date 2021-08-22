const { build } = require("esbuild");
const { TypeSchema } = require("../");

class TestTypeSchema extends TypeSchema {
    onProgress(clsInfo) {
        
    }
}

build({
    entryPoints: ["test/index.ts"],
    outfile: "test/dist/bundle.js",
    format: "esm",
    plugins: [new TestTypeSchema()],
    tsconfig: "./tsconfig.json",
});
