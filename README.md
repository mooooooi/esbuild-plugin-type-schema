# esbuild-plugin-type-schema

[![Version](https://img.shields.io/npm/v/esbuild-plugin-type-schema.svg)](https://npmjs.org/package/esbuild-plugin-type-schema)
[![Downloads/week](https://img.shields.io/npm/dw/esbuild-plugin-type-schema.svg)](https://npmjs.org/package/esbuild-plugin-type-schema)
[![License](https://img.shields.io/npm/l/esbuild-plugin-type-schema.svg)](https://github.com/mooooooi/esbuild-plugin-type-schema/blob/master/package.json)

-   [Install](#installation)
-   [Usage](#usage)
-   [Result](#result)

# Installation

```sh-session
$ npm install esbuild-plugin-type-schema --save-dev
$ yarn add esbuild-plugin-type-schema -D
```

# Usage

```javascript
const { build } = require("esbuild");
const { JSONTypeSchema } = require("esbuild-plugin-type-schema");

build({
    entryPoints: ["test/index.ts"],
    outfile: "test/dist/bundle.js",
    format: "esm",
    plugins: [JSONTypeSchema("./test/dist/type.json")],
    tsconfig: "./tsconfig.json",
});
```

**Custom**

```typescript
export function JSONTypeSchema(outJsonPath: string): Plugin {
    const json: SimpleClassTypeInfo[] = [];
    return TypeSchema({
        onProgress(_, classTypeInfo: ClassTypeInfo) {
            json.push({
                name: classTypeInfo.target.getName(),
                properties: classTypeInfo.properties.map((prop) => {
                    return {
                        name: prop.target.getName(),
                        type: prop.target.getTypeNode().getText(),
                    };
                }),
                methods: classTypeInfo.methods.map((method) => {
                    return {
                        name: method.target.getName(),
                        params: method.target
                            .getParameters()
                            .map((param) => param.getTypeNode().getText()),
                        return: method.target.getReturnType().getText(),
                    };
                }),
            });
        },

        onEnd() {
            fs.writeFileSync(outJsonPath, JSON.stringify(json, undefined, 4));
        },
    });
}
```

\_See src/json-type-schema.ts

## Result

```json
[
    {
        "name": "Abcf",
        "properties": [
            {
                "name": "a",
                "type": "Abce"
            }
        ],
        "methods": []
    },
    {
        "name": "Abc",
        "properties": [
            {
                "name": "a",
                "type": "number"
            },
            {
                "name": "b",
                "type": "u32[]"
            }
        ],
        "methods": []
    },
    {
        "name": "Abcd",
        "properties": [
            {
                "name": "a",
                "type": "number"
            }
        ],
        "methods": [
            {
                "name": "heihei",
                "params": [
                    "u32",
                    "number"
                ],
                "return": "void"
            }
        ]
    },
    {
        "name": "Abce",
        "properties": [
            {
                "name": "a",
                "type": "number"
            }
        ],
        "methods": []
    }
]
```