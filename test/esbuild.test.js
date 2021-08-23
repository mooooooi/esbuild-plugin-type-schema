const { build } = require("esbuild");
const { JSONTypeSchema, TypeSchema } = require("../");
const fs = require("fs");
const path = require("path");

build({
    entryPoints: ["test/index.ts"],
    outfile: "test/dist/bundle.js",
    format: "esm",
    plugins: [JSONTypeSchema("test/dist/type.json")],
    tsconfig: "./tsconfig.json",
});

function CustomTypeSchema(outJsonPath) {
    const outJson = [];
    return TypeSchema({
        onProgress(o, cls) {
            outJson.push({
                classname:
                    cls.decor.getName() === "cls"
                        ? JSON.parse(cls.decor.getArguments()[0].getText())
                        : cls.target.getName(),

                properties: cls.properties.map((prop) => {
                    return {
                        propname: prop.target.getName(),
                        type:
                            prop.decor.getName() === "prop"
                                ? JSON.parse(
                                      prop.decor.getArguments()[0].getText()
                                  )
                                : prop.target.getTypeNode().getText(),
                    };
                }),
            });
        },

        onEnd(o) {
            fs.writeFileSync(outJsonPath, JSON.stringify(outJson, undefined, 4));
        },
    });
}
build({
    entryPoints: ["test/index.ts"],
    outfile: "test/dist/bundle.js",
    format: "esm",
    plugins: [CustomTypeSchema("test/dist/type.custom.json")],
    tsconfig: "./tsconfig.json",
});
