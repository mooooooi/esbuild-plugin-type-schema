import {
    Plugin,
    PluginBuild,
    build as esbuild,
    BuildResult,
    BuildOptions,
} from "esbuild";
import { Project } from "ts-morph";
import {
    AccessorTypeInfo,
    ClassTypeInfo,
    MethodTypeInfo,
    PropTypeInfo,
} from "./type-info";
import * as path from "path";
import * as fs from "fs";

interface TypeSchemaOption {
    onStart?(o: BuildOptions): void;
    onProgress(o: BuildOptions, classTypeInfo: ClassTypeInfo): void;
    onEnd?(o: BuildOptions, result: BuildResult): void;
    decFileFilter?: RegExp;
}

export function TypeSchema(option: TypeSchemaOption): Plugin {
    return {
        name: "TypeSchema",
        async setup(build: PluginBuild) {
            const handingFiles = new Set<string>();
            const decFiles = new Set<string>();
            if (option) {
                option.onStart &&
                    build.onStart(() => option.onStart(build.initialOptions));
                option.onEnd &&
                    build.onEnd((result) =>
                        option.onEnd(build.initialOptions, result)
                    );
            }

            const tsconfigPath = path.join(process.cwd(), "tsconfig.json");
            if (!fs.existsSync(tsconfigPath)) {
                throw "Cannot find tsconfig in path: " + tsconfigPath;
            }
            console.log("Finding tsconfig's path is " + tsconfigPath);
            const project = new Project({
                compilerOptions: {
                    declaration: false,
                    sourceMap: false,
                },
                tsConfigFilePath: tsconfigPath,
            });
            const decNames = new Set<string>();
            await getDecFiles(
                build,
                handingFiles,
                decFiles,
                option.decFileFilter
            );

            const decSourceFiles = project.getSourceFiles(
                Array.from(decFiles.values())
            );

            for (let sf of decSourceFiles) {
                [...sf.getVariableDeclarations(), ...sf.getFunctions()].forEach(
                    (clr) => {
                        if (
                            clr.isExported ||
                            clr.isNamedExport ||
                            clr.isDefaultExport
                        ) {
                            decNames.add(clr.getName());
                        }
                        clr.forget();
                    }
                );
            }
            console.log(decNames);

            build.onLoad({ filter: /.+\.ts/ }, (args) => {
                if (handingFiles.has(args.path)) {
                    return project.forgetNodesCreatedInBlock((remember) => {
                        const sf = project.getSourceFileOrThrow(args.path);
                        var classes = sf.getClasses();
                        for (const cls of classes) {
                            console.log(cls.getName());
                            const clsDecors = cls
                                .getDecorators()
                                .filter((decor) =>
                                    decNames.has(decor.getName())
                                );
                            if (clsDecors.length <= 0) continue;

                            const props = cls.getProperties();
                            const propInfoArr: PropTypeInfo[] = [];
                            for (const prop of props) {
                                const propDecors = prop
                                    .getDecorators()
                                    .filter((propDecor) =>
                                        decNames.has(propDecor.getName())
                                    );
                                if (propDecors.length <= 0) continue;
                                propInfoArr.push({
                                    decors: propDecors,
                                    target: prop,
                                });
                            }

                            const methods = cls.getMethods();
                            const methodInfoArr: MethodTypeInfo[] = [];
                            for (const method of methods) {
                                const methodDecors = method
                                    .getDecorators()
                                    .filter((methodDecor) =>
                                        decNames.has(methodDecor.getName())
                                    );
                                if (methodDecors.length <= 0) continue;

                                methodInfoArr.push({
                                    decors: methodDecors,
                                    target: method,
                                    params: method
                                        .getParameters()
                                        .map((param) => {
                                            const paramDecors = param
                                                .getDecorators()
                                                .filter((paramDecor) =>
                                                    decNames.has(
                                                        paramDecor.getName()
                                                    )
                                                );
                                            return {
                                                target: param,
                                                decors: paramDecors,
                                            };
                                        }),
                                });
                            }

                            const accessores = [
                                ...cls.getGetAccessors(),
                                ...cls.getSetAccessors(),
                            ];
                            const accessorInfoArr: AccessorTypeInfo[] = [];
                            for (const accessor of accessores) {
                                const decors = accessor
                                    .getDecorators()
                                    .filter((dec) =>
                                        decNames.has(dec.getName())
                                    );
                                if (decors.length <= 0) continue;
                                accessorInfoArr.push({
                                    decors,
                                    target: accessor,
                                });
                            }

                            const classTypeInfo: ClassTypeInfo = {
                                decors: clsDecors,
                                target: cls,
                                properties: propInfoArr,
                                methods: methodInfoArr,
                                accessores: accessorInfoArr,
                            };
                            option.onProgress(
                                build.initialOptions,
                                classTypeInfo
                            );
                        }
                        return {
                            contents: sf.getFullText(),
                            loader: "ts",
                        };
                    });
                } else {
                    return undefined;
                }
            });
        },
    };
}

async function getDecFiles(
    build: PluginBuild,
    handingFiles: Set<string>,
    decFiles: Set<string>,
    decFilter: RegExp = /\.dec/
) {
    await esbuild({
        entryPoints: build.initialOptions.entryPoints,
        bundle: true,
        plugins: [
            {
                name: "get-idep",
                setup(build: PluginBuild) {
                    build.onResolve({ filter: decFilter }, (args) => {
                        handingFiles.add(args.importer);
                        return undefined;
                    });
                    build.onLoad({ filter: decFilter }, (args) => {
                        decFiles.add(args.path);
                        return undefined;
                    });
                },
            },
        ],
        write: false,
    });
}
