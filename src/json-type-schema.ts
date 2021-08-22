import { Plugin } from "esbuild";
import { ClassTypeInfo, SimpleClassTypeInfo } from "./type-info";
import * as fs from "fs";
import { TypeSchema } from "./type-schema";

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
